const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

async function getStudents(tenantId, options = {}) {
  const { search = '', status = 'all', planId = '', page = 1, limit = 25 } = options;
  const offset = (page - 1) * limit;

  let whereClauses = ['s.tenant_id = ?'];
  let params = [tenantId];

  if (status && status !== 'all') {
    whereClauses.push('s.status = ?');
    params.push(status);
  } else {
    // By default exclude deleted/anonymized unless explicitly asked
    whereClauses.push("s.status != 'anonymized'");
  }

  if (planId) {
    whereClauses.push('s.membership_plan_id = ?');
    params.push(planId);
  }

  if (search) {
    whereClauses.push('(s.name LIKE ? OR s.admission_number LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereSql = whereClauses.join(' AND ');

  const countQuery = `SELECT COUNT(*) as total FROM students s WHERE ${whereSql}`;
  const totalRow = db.queryOne(countQuery, params);
  const total = totalRow ? totalRow.total : 0;

  const dataQuery = `
    SELECT s.*, fp.name as plan_name, fp.price as plan_price,
           (SELECT COUNT(*) FROM invoices inv WHERE inv.student_id = s.id AND inv.balance_amount > 0) as pending_invoices_count,
           (SELECT COALESCE(SUM(inv.balance_amount), 0) FROM invoices inv WHERE inv.student_id = s.id) as total_due_amount,
           (SELECT GROUP_CONCAT(st.seat_number || ' (' || sh.name || ')', ', ')
            FROM seat_bookings sb
            JOIN seats st ON sb.seat_id = st.id
            JOIN shifts sh ON sb.shift_id = sh.id
            WHERE sb.student_id = s.id AND sb.status = 'active') as assigned_seats
    FROM students s
    LEFT JOIN fee_plans fp ON s.membership_plan_id = fp.id
    WHERE ${whereSql}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const students = db.query(dataQuery, [...params, limit, offset]);

  return {
    students,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function getStudentById(tenantId, studentId) {
  const student = db.queryOne(
    `SELECT s.*, fp.name as plan_name, fp.price as plan_price, fp.duration_days
     FROM students s
     LEFT JOIN fee_plans fp ON s.membership_plan_id = fp.id
     WHERE s.id = ? AND s.tenant_id = ?`,
    [studentId, tenantId]
  );

  if (!student) {
    const error = new Error('Student not found.');
    error.statusCode = 404;
    throw error;
  }

  // Active Seat Bookings
  const bookings = db.query(
    `SELECT sb.*, st.seat_number, fl.name as floor_name, rm.name as room_name,
            sh.shift_number, sh.name as shift_name, sh.start_time, sh.end_time
     FROM seat_bookings sb
     JOIN seats st ON sb.seat_id = st.id
     JOIN shifts sh ON sb.shift_id = sh.id
     JOIN floors fl ON st.floor_id = fl.id
     LEFT JOIN rooms rm ON st.room_id = rm.id
     WHERE sb.student_id = ? AND sb.tenant_id = ?
     ORDER BY sb.start_date DESC`,
    [studentId, tenantId]
  );

  // Invoices
  const invoices = db.query(
    `SELECT inv.*, fp.name as fee_plan_name
     FROM invoices inv
     LEFT JOIN fee_plans fp ON inv.fee_plan_id = fp.id
     WHERE inv.student_id = ? AND inv.tenant_id = ?
     ORDER BY inv.created_at DESC`,
    [studentId, tenantId]
  );

  // Payments / Receipts
  const payments = db.query(
    `SELECT p.*, inv.invoice_number
     FROM payments p
     JOIN invoices inv ON p.invoice_id = inv.id
     WHERE p.student_id = ? AND p.tenant_id = ?
     ORDER BY p.payment_date DESC`,
    [studentId, tenantId]
  );

  // Reminder Logs
  const reminderLogs = db.query(
    `SELECT * FROM whatsapp_logs
     WHERE student_id = ? AND tenant_id = ?
     ORDER BY created_at DESC`,
    [studentId, tenantId]
  );

  return {
    ...student,
    bookings,
    invoices,
    payments,
    reminderLogs,
  };
}

async function createStudent(tenantId, data, currentUserId) {
  const {
    name,
    email = '',
    phone,
    emergency_contact_name = '',
    emergency_contact_phone = '',
    id_proof_type = '',
    id_proof_number = '',
    address = '',
    admission_date = new Date().toISOString().split('T')[0],
    membership_plan_id = null,
    membership_start = null,
    membership_expiry = null,
    photo_url = null,
    notes = '',
    initial_payment_amount = 0,
    payment_mode = 'cash',
  } = data;

  if (!name || !phone) {
    const error = new Error('Student name and phone number are required.');
    error.statusCode = 400;
    throw error;
  }

  // Generate sequential admission number: ADM-YYYY-XXXX
  const year = new Date().getFullYear();
  const countRow = db.queryOne('SELECT COUNT(*) as count FROM students WHERE tenant_id = ?', [tenantId]);
  const seq = (countRow ? countRow.count : 0) + 1;
  const admissionNumber = `ADM-${year}-${String(seq).padStart(4, '0')}`;

  const studentId = uuidv4();
  const now = new Date().toISOString();

  // Calculate membership expiry if plan is provided but expiry is not
  let calcStart = membership_start || admission_date;
  let calcExpiry = membership_expiry;
  let planPrice = 0;
  let admissionFee = 0;

  if (membership_plan_id) {
    const plan = db.queryOne('SELECT * FROM fee_plans WHERE id = ? AND tenant_id = ?', [membership_plan_id, tenantId]);
    if (plan) {
      planPrice = plan.price;
      admissionFee = plan.admission_fee || 0;
      if (!calcExpiry) {
        const d = new Date(calcStart);
        d.setDate(d.getDate() + (plan.duration_days || 30));
        calcExpiry = d.toISOString().split('T')[0];
      }
    }
  }

  return db.transaction(() => {
    db.run(
      `INSERT INTO students (
        id, tenant_id, admission_number, name, email, phone,
        emergency_contact_name, emergency_contact_phone, id_proof_type, id_proof_number,
        photo_url, address, status, admission_date, membership_plan_id,
        membership_start, membership_expiry, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        tenantId,
        admissionNumber,
        name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        emergency_contact_name.trim(),
        emergency_contact_phone.trim(),
        id_proof_type,
        id_proof_number.trim(),
        photo_url,
        address.trim(),
        admission_date,
        membership_plan_id || null,
        calcStart,
        calcExpiry,
        notes.trim(),
        now,
        now,
      ]
    );

    // If a plan was selected, generate initial invoice
    const totalFee = planPrice + admissionFee;
    let createdInvoiceId = null;
    if (totalFee > 0) {
      createdInvoiceId = uuidv4();
      const invCount = db.queryOne('SELECT COUNT(*) as count FROM invoices WHERE tenant_id = ?', [tenantId]);
      const invNum = `INV-${year}-${String((invCount?.count || 0) + 1).padStart(4, '0')}`;
      const paid = Math.min(Number(initial_payment_amount) || 0, totalFee);
      const balance = totalFee - paid;
      const invStatus = balance === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

      db.run(
        `INSERT INTO invoices (
          id, tenant_id, student_id, fee_plan_id, invoice_number, title,
          total_amount, paid_amount, balance_amount, due_date, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'Admission & Membership Fee', ?, ?, ?, ?, ?, 'Initial admission invoice', ?, ?)`,
        [
          createdInvoiceId,
          tenantId,
          studentId,
          membership_plan_id,
          invNum,
          totalFee,
          paid,
          balance,
          calcStart,
          invStatus,
          now,
          now,
        ]
      );

      // If initial payment was collected, record payment and receipt
      if (paid > 0) {
        const payCount = db.queryOne('SELECT COUNT(*) as count FROM payments WHERE tenant_id = ?', [tenantId]);
        const recNum = `REC-${year}-${String((payCount?.count || 0) + 1).padStart(4, '0')}`;
        db.run(
          `INSERT INTO payments (
            id, tenant_id, invoice_id, student_id, receipt_number, amount,
            payment_mode, transaction_ref, notes, payment_date, created_by_user_id, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Initial Admission Payment', 'Paid during admission', ?, ?, 'completed', ?)`,
          [
            uuidv4(),
            tenantId,
            createdInvoiceId,
            studentId,
            recNum,
            paid,
            payment_mode,
            admission_date,
            currentUserId,
            now,
          ]
        );
      }
    }

    // Audit log
    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'STUDENT_ADMISSION', 'student', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentUserId,
        studentId,
        JSON.stringify({ name, admissionNumber, phone, feePlanId: membership_plan_id }),
        now,
      ]
    );

    return { id: studentId, admissionNumber };
  });
}

async function updateStudent(tenantId, studentId, data, currentUserId) {
  const existing = db.queryOne('SELECT * FROM students WHERE id = ? AND tenant_id = ?', [studentId, tenantId]);
  if (!existing) {
    const error = new Error('Student not found.');
    error.statusCode = 404;
    throw error;
  }

  const {
    name = existing.name,
    email = existing.email,
    phone = existing.phone,
    emergency_contact_name = existing.emergency_contact_name,
    emergency_contact_phone = existing.emergency_contact_phone,
    id_proof_type = existing.id_proof_type,
    id_proof_number = existing.id_proof_number,
    photo_url = existing.photo_url,
    address = existing.address,
    status = existing.status,
    membership_plan_id = existing.membership_plan_id,
    membership_start = existing.membership_start,
    membership_expiry = existing.membership_expiry,
    notes = existing.notes,
  } = data;

  const now = new Date().toISOString();

  db.run(
    `UPDATE students SET
      name = ?, email = ?, phone = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
      id_proof_type = ?, id_proof_number = ?, photo_url = ?, address = ?, status = ?,
      membership_plan_id = ?, membership_start = ?, membership_expiry = ?, notes = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      name.trim(),
      email ? email.trim().toLowerCase() : '',
      phone.trim(),
      emergency_contact_name ? emergency_contact_name.trim() : '',
      emergency_contact_phone ? emergency_contact_phone.trim() : '',
      id_proof_type,
      id_proof_number ? id_proof_number.trim() : '',
      photo_url,
      address ? address.trim() : '',
      status,
      membership_plan_id || null,
      membership_start,
      membership_expiry,
      notes ? notes.trim() : '',
      now,
      studentId,
      tenantId,
    ]
  );

  // Audit log
  db.run(
    `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
     VALUES (?, ?, ?, 'library_owner', 'STUDENT_UPDATED', 'student', ?, ?, '127.0.0.1', ?)`,
    [uuidv4(), tenantId, currentUserId, studentId, JSON.stringify({ name, status }), now]
  );

  return { success: true };
}

/**
 * Permanent Deletion of Student Record
 * Meets Master Prompt requirement:
 * 1. Immediately releases active seat bookings so seats are available.
 * 2. Depending on policy / choice:
 *    - 'compliance_anonymize': Anonymizes all personally identifiable information (PII)
 *      (wiping name, phone, email, photo, emergency contacts) while retaining financial transaction
 *      ids to ensure accounting ledger integrity and GST/Tax report compliance.
 *    - 'hard_purge': Completely removes student personal records and associated data.
 */
async function deleteStudent(tenantId, studentId, deleteMode = 'compliance_anonymize', currentUserId) {
  const existing = db.queryOne('SELECT * FROM students WHERE id = ? AND tenant_id = ?', [studentId, tenantId]);
  if (!existing) {
    const error = new Error('Student not found.');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();

  return db.transaction(() => {
    // 1. Release all active seat bookings for this student
    db.run(
      `UPDATE seat_bookings SET status = 'cancelled', updated_at = ?
       WHERE student_id = ? AND tenant_id = ? AND status = 'active'`,
      [now, studentId, tenantId]
    );

    if (deleteMode === 'compliance_anonymize') {
      // Anonymize PII
      db.run(
        `UPDATE students SET
          name = '[Deleted Student]',
          email = NULL,
          phone = '[REDACTED]',
          emergency_contact_name = NULL,
          emergency_contact_phone = NULL,
          id_proof_type = NULL,
          id_proof_number = NULL,
          photo_url = NULL,
          address = NULL,
          status = 'anonymized',
          notes = 'Personal data permanently erased as per data privacy and deletion request.',
          updated_at = ?
         WHERE id = ? AND tenant_id = ?`,
        [now, studentId, tenantId]
      );
    } else {
      // Hard purge student
      // First clean up whatsapp logs for this student
      db.run('DELETE FROM whatsapp_logs WHERE student_id = ? AND tenant_id = ?', [studentId, tenantId]);
      // Remove bookings
      db.run('DELETE FROM seat_bookings WHERE student_id = ? AND tenant_id = ?', [studentId, tenantId]);
      // Nullify references in payments and invoices to preserve financial ledger amounts
      db.run('UPDATE payments SET student_id = NULL WHERE student_id = ? AND tenant_id = ?', [studentId, tenantId]);
      db.run('UPDATE invoices SET student_id = NULL WHERE student_id = ? AND tenant_id = ?', [studentId, tenantId]);
      // Delete student row permanently
      db.run('DELETE FROM students WHERE id = ? AND tenant_id = ?', [studentId, tenantId]);
    }

    // Record deletion in audit logs
    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'PERMANENT_STUDENT_DELETION', 'student', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentUserId,
        studentId,
        JSON.stringify({
          originalAdmissionNumber: existing.admission_number,
          deleteMode,
          reason: 'Permanent deletion requested by Library Owner'
        }),
        now,
      ]
    );

    return { success: true, deleteMode };
  });
}

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
};
