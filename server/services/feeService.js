const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

async function getFeePlans(tenantId) {
  return db.query(
    'SELECT * FROM fee_plans WHERE tenant_id = ? AND is_active = 1 ORDER BY price ASC',
    [tenantId]
  );
}

async function createFeePlan(tenantId, data) {
  const { name, duration_days = 30, shifts_allowed = 1, price, admission_fee = 0, description = '' } = data;
  if (!name || price === undefined) {
    const error = new Error('Plan name and price are required.');
    error.statusCode = 400;
    throw error;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO fee_plans (id, tenant_id, name, duration_days, shifts_allowed, price, admission_fee, description, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [id, tenantId, name.trim(), duration_days, shifts_allowed, price, admission_fee, description.trim(), now]
  );

  return { id, name };
}

async function updateFeePlan(tenantId, planId, data) {
  const { name, duration_days, shifts_allowed, price, admission_fee, description, is_active } = data;
  const existing = db.queryOne('SELECT * FROM fee_plans WHERE id = ? AND tenant_id = ?', [planId, tenantId]);
  if (!existing) {
    const error = new Error('Fee plan not found.');
    error.statusCode = 404;
    throw error;
  }

  db.run(
    `UPDATE fee_plans SET
      name = COALESCE(?, name),
      duration_days = COALESCE(?, duration_days),
      shifts_allowed = COALESCE(?, shifts_allowed),
      price = COALESCE(?, price),
      admission_fee = COALESCE(?, admission_fee),
      description = COALESCE(?, description),
      is_active = COALESCE(?, is_active)
     WHERE id = ? AND tenant_id = ?`,
    [name, duration_days, shifts_allowed, price, admission_fee, description, is_active, planId, tenantId]
  );

  return { success: true };
}

async function getInvoices(tenantId, options = {}) {
  const { status = 'all', studentId = '', search = '', page = 1, limit = 25 } = options;
  const offset = (page - 1) * limit;

  let where = ['inv.tenant_id = ?'];
  let params = [tenantId];

  if (status && status !== 'all') {
    where.push('inv.status = ?');
    params.push(status);
  }

  if (studentId) {
    where.push('inv.student_id = ?');
    params.push(studentId);
  }

  if (search) {
    where.push('(inv.invoice_number LIKE ? OR st.name LIKE ? OR st.admission_number LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const whereSql = where.join(' AND ');

  const totalRow = db.queryOne(
    `SELECT COUNT(*) as count
     FROM invoices inv
     LEFT JOIN students st ON inv.student_id = st.id
     WHERE ${whereSql}`,
    params
  );
  const total = totalRow ? totalRow.count : 0;

  const invoices = db.query(
    `SELECT inv.*, st.name as student_name, st.admission_number, st.phone as student_phone,
            fp.name as plan_name
     FROM invoices inv
     LEFT JOIN students st ON inv.student_id = st.id
     LEFT JOIN fee_plans fp ON inv.fee_plan_id = fp.id
     WHERE ${whereSql}
     ORDER BY inv.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    invoices,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function createInvoice(tenantId, data, currentUserId) {
  const { studentId, feePlanId = null, title, totalAmount, dueDate, notes = '' } = data;

  if (!studentId || !title || totalAmount === undefined || !dueDate) {
    const error = new Error('Student ID, title, total amount, and due date are required.');
    error.statusCode = 400;
    throw error;
  }

  const student = db.queryOne('SELECT * FROM students WHERE id = ? AND tenant_id = ?', [studentId, tenantId]);
  if (!student) {
    const error = new Error('Student not found in this library.');
    error.statusCode = 404;
    throw error;
  }

  const year = new Date().getFullYear();
  const latestInv = db.queryOne(
    `SELECT invoice_number FROM invoices
     WHERE tenant_id = ? AND invoice_number LIKE ?
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, `INV-${year}-%`]
  );
  let invSeq = 1;
  if (latestInv && latestInv.invoice_number) {
    const parts = latestInv.invoice_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      invSeq = lastNum + 1;
    }
  }
  let invoiceNumber = `INV-${year}-${String(invSeq).padStart(4, '0')}`;
  while (db.queryOne('SELECT id FROM invoices WHERE tenant_id = ? AND invoice_number = ?', [tenantId, invoiceNumber])) {
    invSeq++;
    invoiceNumber = `INV-${year}-${String(invSeq).padStart(4, '0')}`;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO invoices (
      id, tenant_id, student_id, fee_plan_id, invoice_number, title,
      total_amount, paid_amount, balance_amount, due_date, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'unpaid', ?, ?, ?)`,
    [
      id,
      tenantId,
      studentId,
      feePlanId,
      invoiceNumber,
      title.trim(),
      totalAmount,
      totalAmount,
      dueDate,
      notes.trim(),
      now,
      now,
    ]
  );

  // Audit log
  db.run(
    `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
     VALUES (?, ?, ?, 'library_owner', 'INVOICE_GENERATED', 'invoice', ?, ?, '127.0.0.1', ?)`,
    [
      uuidv4(),
      tenantId,
      currentUserId,
      id,
      JSON.stringify({ invoiceNumber, studentName: student.name, totalAmount }),
      now,
    ]
  );

  return { id, invoiceNumber };
}

/**
 * Record a payment and issue an official receipt
 * Strictly validates no double payment or excess payment
 */
async function recordPayment(tenantId, payload, currentUserId) {
  const { invoiceId, amount, paymentMode = 'cash', transactionRef = '', notes = '', paymentDate = new Date().toISOString().split('T')[0] } = payload;

  const paymentNum = Number(amount);
  if (!paymentNum || paymentNum <= 0) {
    const error = new Error('Payment amount must be greater than zero.');
    error.statusCode = 400;
    throw error;
  }

  const invoice = db.queryOne('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?', [invoiceId, tenantId]);
  if (!invoice) {
    const error = new Error('Invoice not found.');
    error.statusCode = 404;
    throw error;
  }

  if (invoice.balance_amount <= 0) {
    const error = new Error('This invoice is already fully paid.');
    error.statusCode = 400;
    throw error;
  }

  if (paymentNum > invoice.balance_amount + 0.001) {
    const error = new Error(`Payment amount (₹${paymentNum}) cannot exceed remaining balance (₹${invoice.balance_amount}).`);
    error.statusCode = 400;
    throw error;
  }

  const year = new Date().getFullYear();
  const latestPayment = db.queryOne(
    `SELECT receipt_number FROM payments
     WHERE tenant_id = ? AND receipt_number LIKE ?
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, `REC-${year}-%`]
  );
  let nextSeq = 1;
  if (latestPayment && latestPayment.receipt_number) {
    const parts = latestPayment.receipt_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }
  let receiptNumber = `REC-${year}-${String(nextSeq).padStart(4, '0')}`;
  while (db.queryOne('SELECT id FROM payments WHERE tenant_id = ? AND receipt_number = ?', [tenantId, receiptNumber])) {
    nextSeq++;
    receiptNumber = `REC-${year}-${String(nextSeq).padStart(4, '0')}`;
  }

  const paymentId = uuidv4();
  const now = new Date().toISOString();

  return db.transaction(() => {
    // 1. Insert payment record
    db.run(
      `INSERT INTO payments (
        id, tenant_id, invoice_id, student_id, receipt_number, amount,
        payment_mode, transaction_ref, notes, payment_date, created_by_user_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [
        paymentId,
        tenantId,
        invoiceId,
        invoice.student_id,
        receiptNumber,
        paymentNum,
        paymentMode,
        transactionRef.trim(),
        notes.trim(),
        paymentDate,
        currentUserId,
        now,
      ]
    );

    // 2. Update invoice balance and status
    const newPaid = invoice.paid_amount + paymentNum;
    const newBalance = Math.max(0, invoice.total_amount - newPaid);
    const newStatus = newBalance === 0 ? 'paid' : 'partial';

    db.run(
      'UPDATE invoices SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
      [newPaid, newBalance, newStatus, now, invoiceId, tenantId]
    );

    // 3. Audit log
    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'PAYMENT_RECORDED', 'payment', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentUserId,
        paymentId,
        JSON.stringify({ receiptNumber, amount: paymentNum, paymentMode, invoiceNumber: invoice.invoice_number }),
        now,
      ]
    );

    return { success: true, paymentId, receiptNumber };
  });
}

/**
 * Reversal / Adjustment Workflow
 * Protects financial integrity: does not allow silent deletion!
 */
async function reversePayment(tenantId, paymentId, payload, currentUserId) {
  const { reason } = payload;
  if (!reason || !reason.trim()) {
    const error = new Error('A valid reason is required to reverse a payment.');
    error.statusCode = 400;
    throw error;
  }

  const payment = db.queryOne('SELECT * FROM payments WHERE id = ? AND tenant_id = ?', [paymentId, tenantId]);
  if (!payment) {
    const error = new Error('Payment record not found.');
    error.statusCode = 404;
    throw error;
  }

  if (payment.status === 'reversed') {
    const error = new Error('This payment has already been reversed.');
    error.statusCode = 400;
    throw error;
  }

  const invoice = db.queryOne('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?', [payment.invoice_id, tenantId]);
  if (!invoice) {
    const error = new Error('Associated invoice not found.');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();

  return db.transaction(() => {
    // 1. Mark payment as reversed
    db.run(
      `UPDATE payments SET
        status = 'reversed',
        reversal_reason = ?,
        reversed_at = ?,
        reversed_by_user_id = ?
       WHERE id = ? AND tenant_id = ?`,
      [reason.trim(), now, currentUserId, paymentId, tenantId]
    );

    // 2. Restore invoice balance
    const newPaid = Math.max(0, invoice.paid_amount - payment.amount);
    const newBalance = invoice.total_amount - newPaid;
    const newStatus = newPaid === 0 ? 'unpaid' : 'partial';

    db.run(
      'UPDATE invoices SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
      [newPaid, newBalance, newStatus, now, invoice.id, tenantId]
    );

    // 3. Audit log
    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'PAYMENT_REVERSED', 'payment', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentUserId,
        paymentId,
        JSON.stringify({
          receiptNumber: payment.receipt_number,
          amountReversed: payment.amount,
          reason: reason.trim(),
        }),
        now,
      ]
    );

    return { success: true };
  });
}

/**
 * Get Official Printable / Downloadable Receipt with full library branding
 */
async function getReceiptData(tenantId, paymentId) {
  const payment = db.queryOne(
    `SELECT p.*, inv.invoice_number, inv.title as invoice_title, inv.total_amount as invoice_total,
            inv.balance_amount as invoice_balance, st.name as student_name, st.admission_number,
            st.phone as student_phone, st.email as student_email, st.address as student_address,
            u.name as collector_name
     FROM payments p
     JOIN invoices inv ON p.invoice_id = inv.id
     LEFT JOIN students st ON p.student_id = st.id
     LEFT JOIN users u ON p.created_by_user_id = u.id
     WHERE p.id = ? AND p.tenant_id = ?`,
    [paymentId, tenantId]
  );

  if (!payment) {
    const error = new Error('Receipt not found.');
    error.statusCode = 404;
    throw error;
  }

  // Get tenant library branding
  const tenant = db.queryOne(
    `SELECT name, logo_url, address, city, state, postal_code, country, phone, email,
            receipt_header, receipt_footer, business_tax_id, currency
     FROM tenants WHERE id = ?`,
    [tenantId]
  );

  // Get active seat booking for this student if any
  let seatInfo = null;
  if (payment.student_id) {
    seatInfo = db.queryOne(
      `SELECT s.seat_number, sh.name as shift_name, f.name as floor_name
       FROM seat_bookings sb
       JOIN seats s ON sb.seat_id = s.id
       JOIN shifts sh ON sb.shift_id = sh.id
       JOIN floors f ON s.floor_id = f.id
       WHERE sb.student_id = ? AND sb.status = 'active'
       LIMIT 1`,
      [payment.student_id]
    );
  }

  return {
    payment,
    library: tenant,
    seatInfo,
  };
}

module.exports = {
  getFeePlans,
  createFeePlan,
  updateFeePlan,
  getInvoices,
  createInvoice,
  recordPayment,
  reversePayment,
  getReceiptData,
};
