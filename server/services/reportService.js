const db = require('../db/database');

async function getDashboardStats(tenantId) {
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonth = `${todayStr.substring(0, 7)}-01`;

  // 1. Students
  const totalStudents = db.queryOne(
    "SELECT COUNT(*) as count FROM students WHERE tenant_id = ? AND status != 'anonymized'",
    [tenantId]
  )?.count || 0;

  const activeStudents = db.queryOne(
    "SELECT COUNT(*) as count FROM students WHERE tenant_id = ? AND status = 'active'",
    [tenantId]
  )?.count || 0;

  const inactiveStudents = totalStudents - activeStudents;

  // 2. Seats & Shifts
  const totalSeats = db.queryOne(
    'SELECT COUNT(*) as count FROM seats WHERE tenant_id = ? AND is_active = 1',
    [tenantId]
  )?.count || 0;

  const shifts = db.query(
    'SELECT * FROM shifts WHERE tenant_id = ? ORDER BY shift_number ASC',
    [tenantId]
  );

  // Shift-wise seat occupancy for today
  const shiftStats = shifts.map((shift) => {
    const bookedCount = db.queryOne(
      `SELECT COUNT(DISTINCT sb.seat_id) as count
       FROM seat_bookings sb
       JOIN seats s ON sb.seat_id = s.id
       WHERE sb.tenant_id = ? AND sb.shift_id = ? AND sb.status = 'active'
         AND sb.start_date <= ? AND sb.end_date >= ?`,
      [tenantId, shift.id, todayStr, todayStr]
    )?.count || 0;

    const availableCount = Math.max(0, totalSeats - bookedCount);
    const occupancyPercent = totalSeats > 0 ? Math.round((bookedCount / totalSeats) * 100) : 0;

    return {
      shiftId: shift.id,
      shiftNumber: shift.shift_number,
      shiftName: shift.name,
      startTime: shift.start_time,
      endTime: shift.end_time,
      totalSeats,
      bookedSeats: bookedCount,
      availableSeats: availableCount,
      occupancyPercent,
    };
  });

  // 3. Financial Collections
  const todayCollection = db.queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM payments
     WHERE tenant_id = ? AND status = 'completed' AND payment_date = ?`,
    [tenantId, todayStr]
  )?.total || 0;

  const monthlyCollection = db.queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM payments
     WHERE tenant_id = ? AND status = 'completed' AND payment_date >= ?`,
    [tenantId, firstOfMonth]
  )?.total || 0;

  const pendingFeesTotal = db.queryOne(
    `SELECT COALESCE(SUM(balance_amount), 0) as total
     FROM invoices
     WHERE tenant_id = ? AND balance_amount > 0`,
    [tenantId]
  )?.total || 0;

  // 4. Memberships Expiring Soon (within 7 days)
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in7DaysStr = in7Days.toISOString().split('T')[0];

  const expiringSoon = db.query(
    `SELECT s.id, s.name, s.phone, s.membership_expiry, fp.name as plan_name
     FROM students s
     LEFT JOIN fee_plans fp ON s.membership_plan_id = fp.id
     WHERE s.tenant_id = ? AND s.status = 'active'
       AND s.membership_expiry >= ? AND s.membership_expiry <= ?
     ORDER BY s.membership_expiry ASC
     LIMIT 5`,
    [tenantId, todayStr, in7DaysStr]
  );

  // 5. Recent Admissions & Recent Payments
  const recentAdmissions = db.query(
    `SELECT s.id, s.name, s.admission_number, s.phone, s.admission_date, fp.name as plan_name
     FROM students s
     LEFT JOIN fee_plans fp ON s.membership_plan_id = fp.id
     WHERE s.tenant_id = ? AND s.status != 'anonymized'
     ORDER BY s.created_at DESC
     LIMIT 5`,
    [tenantId]
  );

  const recentPayments = db.query(
    `SELECT p.*, st.name as student_name, st.admission_number
     FROM payments p
     LEFT JOIN students st ON p.student_id = st.id
     WHERE p.tenant_id = ? AND p.status = 'completed'
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT 5`,
    [tenantId]
  );

  // 6. WhatsApp Reminder Statistics
  const whatsappStats = {
    totalSent: db.queryOne("SELECT COUNT(*) as count FROM whatsapp_logs WHERE tenant_id = ? AND status IN ('sent','delivered')", [tenantId])?.count || 0,
    delivered: db.queryOne("SELECT COUNT(*) as count FROM whatsapp_logs WHERE tenant_id = ? AND status = 'delivered'", [tenantId])?.count || 0,
    queued: db.queryOne("SELECT COUNT(*) as count FROM whatsapp_logs WHERE tenant_id = ? AND status = 'queued'", [tenantId])?.count || 0,
    failed: db.queryOne("SELECT COUNT(*) as count FROM whatsapp_logs WHERE tenant_id = ? AND status = 'failed'", [tenantId])?.count || 0,
  };

  return {
    students: {
      total: totalStudents,
      active: activeStudents,
      inactive: inactiveStudents,
    },
    seats: {
      total: totalSeats,
      shifts: shiftStats,
    },
    financial: {
      todayCollection,
      monthlyCollection,
      pendingFeesTotal,
    },
    expiringSoon,
    recentAdmissions,
    recentPayments,
    whatsappStats,
  };
}

/**
 * Detailed Collections & Revenue Report
 */
async function getCollectionReport(tenantId, startDate, endDate) {
  let where = ['p.tenant_id = ? AND p.status = "completed"'];
  let params = [tenantId];

  if (startDate) {
    where.push('p.payment_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    where.push('p.payment_date <= ?');
    params.push(endDate);
  }

  const whereSql = where.join(' AND ');

  const payments = db.query(
    `SELECT p.*, st.name as student_name, st.admission_number, inv.invoice_number, inv.title as fee_title
     FROM payments p
     LEFT JOIN students st ON p.student_id = st.id
     JOIN invoices inv ON p.invoice_id = inv.id
     WHERE ${whereSql}
     ORDER BY p.payment_date DESC, p.created_at DESC`,
    params
  );

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  // Group by payment mode
  const modeBreakdown = payments.reduce((acc, p) => {
    acc[p.payment_mode] = (acc[p.payment_mode] || 0) + p.amount;
    return acc;
  }, {});

  return {
    payments,
    totalCollected,
    modeBreakdown,
  };
}

/**
 * Defaulters / Outstanding Fees Report
 */
async function getDefaultersReport(tenantId) {
  return db.query(
    `SELECT inv.*, st.name as student_name, st.phone as student_phone, st.email as student_email,
            st.admission_number, fp.name as plan_name,
            (SELECT MAX(created_at) FROM whatsapp_logs wl WHERE wl.student_id = st.id) as last_reminder_sent_at
     FROM invoices inv
     JOIN students st ON inv.student_id = st.id
     LEFT JOIN fee_plans fp ON inv.fee_plan_id = fp.id
     WHERE inv.tenant_id = ? AND inv.balance_amount > 0 AND st.status = 'active'
     ORDER BY inv.due_date ASC`,
    [tenantId]
  );
}

module.exports = {
  getDashboardStats,
  getCollectionReport,
  getDefaultersReport,
};
