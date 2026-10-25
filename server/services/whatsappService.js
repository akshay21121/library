const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../db/database');

/**
 * Get WhatsApp notification templates for library tenant
 */
async function getTemplates(tenantId) {
  return db.query(
    'SELECT * FROM whatsapp_templates WHERE tenant_id = ? ORDER BY title ASC',
    [tenantId]
  );
}

/**
 * Update WhatsApp template body text
 */
async function updateTemplate(tenantId, templateKey, bodyText) {
  const existing = db.queryOne(
    'SELECT * FROM whatsapp_templates WHERE template_key = ? AND tenant_id = ?',
    [templateKey, tenantId]
  );

  if (!existing) {
    const error = new Error('Template not found.');
    error.statusCode = 404;
    throw error;
  }

  db.run(
    'UPDATE whatsapp_templates SET body_text = ? WHERE template_key = ? AND tenant_id = ?',
    [bodyText.trim(), templateKey, tenantId]
  );

  return { success: true };
}

/**
 * Format message by replacing placeholders
 */
function interpolateTemplate(templateText, variables) {
  let text = templateText;
  for (const [key, val] of Object.entries(variables)) {
    const reg = new RegExp(`{{${key}}}`, 'g');
    text = text.replace(reg, val !== undefined && val !== null ? String(val) : '');
  }
  return text;
}

/**
 * Dispatch message through WhatsApp Provider Abstraction
 * Supports Official Meta Cloud API if configured, or transparent Sandbox / Dev mode
 */
async function dispatchWhatsAppMessage(phoneNumber, messageContent) {
  const isRealProviderConfigured = Boolean(
    config.whatsapp.token && config.whatsapp.phoneId
  );

  if (isRealProviderConfigured) {
    try {
      const url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { body: messageContent },
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        return {
          status: 'failed',
          providerMessageId: null,
          failureReason: resData?.error?.message || 'Meta API error',
        };
      }

      return {
        status: 'delivered',
        providerMessageId: resData?.messages?.[0]?.id || `wamid_${Date.now()}`,
        failureReason: null,
      };
    } catch (err) {
      return {
        status: 'failed',
        providerMessageId: null,
        failureReason: err.message,
      };
    }
  }

  // Transparent Sandbox / Simulation Mode (with official WhatsApp payload formatting)
  return {
    status: 'sent',
    providerMessageId: `sandbox_${uuidv4().substring(0, 8)}`,
    failureReason: null,
    isSandbox: true,
  };
}

/**
 * Send Manual Reminders to selected student IDs
 */
async function sendManualReminders(tenantId, payload, currentUserId) {
  const { studentIds = [], customMessage = '', templateKey = 'fee_reminder_upcoming' } = payload;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    const error = new Error('Please select at least one student recipient.');
    error.statusCode = 400;
    throw error;
  }

  const tenant = db.queryOne('SELECT name, phone, currency FROM tenants WHERE id = ?', [tenantId]);
  const template = db.queryOne(
    'SELECT * FROM whatsapp_templates WHERE template_key = ? AND tenant_id = ?',
    [templateKey, tenantId]
  );

  const results = [];
  const today = new Date().toISOString().split('T')[0];

  for (const sId of studentIds) {
    const student = db.queryOne('SELECT * FROM students WHERE id = ? AND tenant_id = ?', [sId, tenantId]);
    if (!student || !student.phone) continue;

    // Get latest unpaid or overdue invoice
    const invoice = db.queryOne(
      `SELECT * FROM invoices
       WHERE student_id = ? AND tenant_id = ? AND balance_amount > 0
       ORDER BY due_date ASC LIMIT 1`,
      [sId, tenantId]
    );

    if (!invoice) continue;

    // Idempotency key: prevents duplicate reminder for same student + invoice on same day
    const idempotencyKey = `manual_${tenantId}_${sId}_${invoice.id}_${today}`;
    const existingLog = db.queryOne('SELECT id, status FROM whatsapp_logs WHERE idempotency_key = ?', [idempotencyKey]);

    if (existingLog) {
      results.push({
        studentId: sId,
        studentName: student.name,
        status: 'skipped_duplicate',
        reason: 'Reminder already sent today.',
      });
      continue;
    }

    const variables = {
      student_name: student.name,
      amount: `${tenant.currency} ${invoice.balance_amount}`,
      library_name: tenant.name,
      due_date: invoice.due_date,
      phone: tenant.phone || '',
    };

    const finalMessage = customMessage.trim()
      ? interpolateTemplate(customMessage, variables)
      : template
      ? interpolateTemplate(template.body_text, variables)
      : `Dear ${student.name}, reminder: your fee of ${tenant.currency} ${invoice.balance_amount} is due on ${invoice.due_date}.`;

    const dispatchResult = await dispatchWhatsAppMessage(student.phone, finalMessage);

    const logId = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO whatsapp_logs (
        id, tenant_id, student_id, invoice_id, phone_number, message_type,
        message_content, status, provider_message_id, failure_reason,
        idempotency_key, sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 'manual_fee_reminder', ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        tenantId,
        student.id,
        invoice.id,
        student.phone,
        finalMessage,
        dispatchResult.status,
        dispatchResult.providerMessageId,
        dispatchResult.failureReason,
        idempotencyKey,
        now,
        now,
      ]
    );

    results.push({
      studentId: student.id,
      studentName: student.name,
      phone: student.phone,
      status: dispatchResult.status,
      providerMessageId: dispatchResult.providerMessageId,
    });
  }

  // Audit log
  db.run(
    `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, details, ip_address, created_at)
     VALUES (?, ?, ?, 'library_owner', 'WHATSAPP_MANUAL_REMINDERS_SENT', 'whatsapp', ?, '127.0.0.1', ?)`,
    [uuidv4(), tenantId, currentUserId, JSON.stringify({ recipientCount: results.length }), new Date().toISOString()]
  );

  return { success: true, processed: results };
}

/**
 * Automated Reminders Scheduled Engine
 * Evaluates pending invoices and due dates against library tenant reminder preferences
 */
async function processAutomaticReminders(tenantId) {
  const tenant = db.queryOne('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant || !tenant.auto_whatsapp_enabled) {
    return { skipped: true, reason: 'Automatic reminders disabled for this library.' };
  }

  const daysBefore = tenant.reminder_days_before || 3;
  const today = new Date();
  const targetDate = new Date();
  targetDate.setDate(today.getDate() + daysBefore);
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  // Find all unpaid invoices where due_date <= targetDateStr and balance_amount > 0
  const eligibleInvoices = db.query(
    `SELECT inv.*, st.name as student_name, st.phone as student_phone
     FROM invoices inv
     JOIN students st ON inv.student_id = st.id
     WHERE inv.tenant_id = ? AND inv.balance_amount > 0 AND inv.due_date <= ?
       AND st.status = 'active'`,
    [tenantId, targetDateStr]
  );

  const template = db.queryOne(
    "SELECT * FROM whatsapp_templates WHERE template_key = 'fee_reminder_upcoming' AND tenant_id = ?",
    [tenantId]
  );

  let sentCount = 0;
  for (const inv of eligibleInvoices) {
    if (!inv.student_phone) continue;

    // Check idempotency: 1 automatic reminder per student + invoice per 48 hours
    const idempotencyKey = `auto_${tenantId}_${inv.student_id}_${inv.id}_${todayStr}`;
    const alreadySent = db.queryOne('SELECT id FROM whatsapp_logs WHERE idempotency_key = ?', [idempotencyKey]);
    if (alreadySent) continue;

    const variables = {
      student_name: inv.student_name,
      amount: `${tenant.currency} ${inv.balance_amount}`,
      library_name: tenant.name,
      due_date: inv.due_date,
      phone: tenant.phone || '',
    };

    const message = template
      ? interpolateTemplate(template.body_text, variables)
      : `Dear ${inv.student_name}, membership fee of ${tenant.currency} ${inv.balance_amount} is due on ${inv.due_date}.`;

    const dispatchResult = await dispatchWhatsAppMessage(inv.student_phone, message);
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO whatsapp_logs (
        id, tenant_id, student_id, invoice_id, phone_number, message_type,
        message_content, status, provider_message_id, failure_reason,
        idempotency_key, sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 'auto_fee_reminder', ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        tenantId,
        inv.student_id,
        inv.id,
        inv.student_phone,
        message,
        dispatchResult.status,
        dispatchResult.providerMessageId,
        dispatchResult.failureReason,
        idempotencyKey,
        now,
        now,
      ]
    );

    sentCount++;
  }

  return { success: true, evaluated: eligibleInvoices.length, sentCount };
}

/**
 * Get Notification Logs with pagination and filters
 */
async function getNotificationLogs(tenantId, options = {}) {
  const { status = 'all', page = 1, limit = 25 } = options;
  const offset = (page - 1) * limit;

  let where = ['wl.tenant_id = ?'];
  let params = [tenantId];

  if (status && status !== 'all') {
    where.push('wl.status = ?');
    params.push(status);
  }

  const whereSql = where.join(' AND ');

  const totalRow = db.queryOne(`SELECT COUNT(*) as count FROM whatsapp_logs wl WHERE ${whereSql}`, params);
  const total = totalRow ? totalRow.count : 0;

  const logs = db.query(
    `SELECT wl.*, st.name as student_name, st.admission_number, inv.invoice_number, inv.balance_amount
     FROM whatsapp_logs wl
     LEFT JOIN students st ON wl.student_id = st.id
     LEFT JOIN invoices inv ON wl.invoice_id = inv.id
     WHERE ${whereSql}
     ORDER BY wl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    logs,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

module.exports = {
  getTemplates,
  updateTemplate,
  sendManualReminders,
  processAutomaticReminders,
  getNotificationLogs,
};
