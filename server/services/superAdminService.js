const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const emailService = require('./emailService');

/**
 * Get all registered libraries with aggregate statistics
 */
async function getAllLibraries(options = {}) {
  const { search = '', status = 'all' } = options;

  let where = ['1=1'];
  let params = [];

  if (status && status !== 'all') {
    where.push('t.status = ?');
    params.push(status);
  }

  if (search) {
    where.push('(t.name LIKE ? OR t.owner_name LIKE ? OR t.email LIKE ? OR t.city LIKE ? OR t.library_code LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  const whereSql = where.join(' AND ');

  const libraries = db.query(
    `SELECT t.*, p.name as plan_name, p.price_monthly,
            u.account_id as owner_account_id, u.is_activated as owner_is_activated,
            (SELECT COUNT(*) FROM students s WHERE s.tenant_id = t.id AND s.status != 'anonymized') as total_students,
            (SELECT COUNT(*) FROM seats st WHERE st.tenant_id = t.id AND st.is_active = 1) as total_seats,
            (SELECT COALESCE(SUM(pm.amount), 0) FROM payments pm WHERE pm.tenant_id = t.id AND pm.status = 'completed') as total_revenue,
            (SELECT COUNT(*) FROM seat_bookings sb WHERE sb.tenant_id = t.id AND sb.status = 'active') as active_bookings
     FROM tenants t
     LEFT JOIN saas_plans p ON t.plan_id = p.id
     LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'library_owner'
     WHERE ${whereSql}
     ORDER BY t.created_at DESC`,
    params
  );

  return libraries;
}

/**
 * Create a new Library Tenant with automated Library Owner account creation and activation email dispatch
 */
async function createLibrary(payload, currentAdminId, originUrl) {
  const {
    name,
    ownerName,
    ownerEmail,
    ownerPhone,
    address = '',
    city = '',
    state = '',
    postalCode = '',
    planId,
    status = 'active',
  } = payload;

  if (!name || !ownerName || !ownerEmail || !ownerPhone || !planId) {
    const error = new Error('Library Name, Owner Name, Owner Email, Owner Phone, and Subscription Plan are required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanEmail = ownerEmail.toLowerCase().trim();
  const existingUser = db.queryOne('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
  if (existingUser) {
    const error = new Error(`An account with email "${cleanEmail}" already exists. Please use a distinct email address.`);
    error.statusCode = 409;
    throw error;
  }

  const plan = db.queryOne('SELECT * FROM saas_plans WHERE id = ?', [planId]);
  if (!plan) {
    const error = new Error('Selected SaaS plan does not exist.');
    error.statusCode = 400;
    throw error;
  }

  // Generate unique slug
  let baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'library';
  let slug = baseSlug;
  let counter = 1;
  while (db.queryOne('SELECT id FROM tenants WHERE slug = ?', [slug])) {
    slug = `${baseSlug}-${counter++}`;
  }

  // Generate unique library code: LIB-YYYY-XXXX
  const year = new Date().getFullYear();
  const countTenants = db.queryOne('SELECT COUNT(*) as count FROM tenants')?.count || 0;
  let seq = countTenants + 1;
  let libraryCode = `LIB-${year}-${String(seq).padStart(4, '0')}`;
  while (db.queryOne('SELECT id FROM tenants WHERE library_code = ?', [libraryCode])) {
    seq++;
    libraryCode = `LIB-${year}-${String(seq).padStart(4, '0')}`;
  }

  // Generate unique owner account ID: OWN-YYYY-XXXX
  let accountId = `OWN-${year}-${String(seq).padStart(4, '0')}`;
  while (db.queryOne('SELECT id FROM users WHERE account_id = ?', [accountId])) {
    seq++;
    accountId = `OWN-${year}-${String(seq).padStart(4, '0')}`;
  }

  const tenantId = uuidv4();
  const ownerId = uuidv4();
  const now = new Date().toISOString();

  // Cryptographically secure activation token (single use, 48h expiry)
  const rawActivationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  // Secure dummy placeholder hash (owner must set their real password via activation link)
  const dummyPlaceholderHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
  const initialUserStatus = status === 'active' ? 'active' : status;

  db.transaction(() => {
    // 1. Insert tenant
    db.run(
      `INSERT INTO tenants (
        id, name, slug, library_code, owner_name, email, phone,
        address, city, state, postal_code, country, plan_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'India', ?, ?, ?, ?)`,
      [
        tenantId,
        name.trim(),
        slug,
        libraryCode,
        ownerName.trim(),
        cleanEmail,
        ownerPhone.trim(),
        (address || '').trim(),
        (city || '').trim(),
        (state || '').trim(),
        (postalCode || '').trim(),
        planId,
        status,
        now,
        now,
      ]
    );

    // 2. Insert owner user
    db.run(
      `INSERT INTO users (
        id, tenant_id, account_id, role, name, email, password_hash,
        phone, status, is_activated, activation_token_hash, activation_token_expires_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'library_owner', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        ownerId,
        tenantId,
        accountId,
        ownerName.trim(),
        cleanEmail,
        dummyPlaceholderHash,
        ownerPhone.trim(),
        initialUserStatus,
        tokenHash,
        expiresAt,
        now,
        now,
      ]
    );

    // 3. Insert SaaS subscription
    const subId = uuidv4();
    const periodStart = now.split('T')[0];
    const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    db.run(
      `INSERT INTO saas_subscriptions (
        id, tenant_id, plan_id, status, billing_cycle, amount,
        current_period_start, current_period_end, created_at
      ) VALUES (?, ?, ?, ?, 'monthly', ?, ?, ?, ?)`,
      [subId, tenantId, planId, status === 'active' ? 'active' : 'pending', plan.price_monthly, periodStart, periodEnd, now]
    );

    // 4. Initialize 3 shifts
    const defaultShifts = [
      { num: 1, name: 'Shift 1 (Morning)', start: '06:00', end: '12:00' },
      { num: 2, name: 'Shift 2 (Afternoon)', start: '12:00', end: '18:00' },
      { num: 3, name: 'Shift 3 (Evening)', start: '18:00', end: '23:30' },
    ];
    for (const sh of defaultShifts) {
      db.run(
        `INSERT INTO shifts (id, tenant_id, shift_number, name, start_time, end_time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), tenantId, sh.num, sh.name, sh.start, sh.end, now]
      );
    }

    // 5. Initialize default notification templates
    const templates = [
      {
        key: 'fee_reminder_upcoming',
        title: 'Upcoming Fee Reminder',
        text: 'Dear {{student_name}}, gentle reminder that your membership renewal fee of {{amount}} for {{library_name}} is due on {{due_date}}. Contact {{phone}} for queries.',
      },
      {
        key: 'fee_overdue_notice',
        title: 'Overdue Fee Notice',
        text: 'URGENT: Dear {{student_name}}, your study seat fee of {{amount}} is overdue since {{due_date}}. Please clear your dues immediately to retain your reserved seat at {{library_name}}.',
      },
      {
        key: 'admission_welcome',
        title: 'Admission Welcome',
        text: 'Welcome {{student_name}} to {{library_name}}! Your admission number is {{admission_number}}. We wish you the best in your exam preparation.',
      },
    ];
    for (const t of templates) {
      db.run(
        `INSERT INTO whatsapp_templates (id, tenant_id, template_key, title, body_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), tenantId, t.key, t.title, t.text, now]
      );
    }

    // 6. Audit log (never log raw tokens)
    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, user_email, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'admin@librarysaas.com', 'supreme_admin', 'LIBRARY_CREATED', 'tenant', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentAdminId,
        tenantId,
        JSON.stringify({ libraryName: name.trim(), libraryCode, ownerEmail: cleanEmail, accountId, planId, status }),
        now,
      ]
    );
  });

  // Construct activation link
  const host = (originUrl || 'http://localhost:5000').replace(/\/$/, '');
  const activationLink = `${host}/activate-account?token=${rawActivationToken}`;

  // Send activation email
  const emailResult = await emailService.sendOwnerActivationEmail({
    to: cleanEmail,
    ownerName: ownerName.trim(),
    libraryName: name.trim(),
    libraryCode,
    accountId,
    planName: plan.name,
    status,
    activationLink,
    loginUrl: host,
  });

  return {
    success: true,
    library: {
      id: tenantId,
      name: name.trim(),
      slug,
      libraryCode,
      status,
      planName: plan.name,
    },
    owner: {
      id: ownerId,
      accountId,
      name: ownerName.trim(),
      email: cleanEmail,
    },
    emailDelivery: {
      sent: emailResult.sent,
      status: emailResult.status,
      messageId: emailResult.messageId || null,
      error: emailResult.failureReason || null,
      activationLink,
    },
  };
}

/**
 * Resend Activation Email to Library Owner
 */
async function resendActivationEmail(tenantId, currentAdminId, originUrl) {
  const tenant = db.queryOne(
    `SELECT t.*, p.name as plan_name
     FROM tenants t
     LEFT JOIN saas_plans p ON t.plan_id = p.id
     WHERE t.id = ?`,
    [tenantId]
  );
  if (!tenant) {
    const error = new Error('Library tenant not found.');
    error.statusCode = 404;
    throw error;
  }

  const owner = db.queryOne(
    `SELECT * FROM users WHERE tenant_id = ? AND role = 'library_owner'`,
    [tenantId]
  );
  if (!owner) {
    const error = new Error('No library owner account found for this tenant.');
    error.statusCode = 404;
    throw error;
  }

  const rawActivationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.run(
      `UPDATE users SET
        activation_token_hash = ?,
        activation_token_expires_at = ?,
        is_activated = 0,
        updated_at = ?
       WHERE id = ?`,
      [tokenHash, expiresAt, now, owner.id]
    );

    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, user_email, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'admin@librarysaas.com', 'supreme_admin', 'ACTIVATION_EMAIL_RESENT', 'user', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentAdminId,
        owner.id,
        JSON.stringify({ ownerEmail: owner.email, accountId: owner.account_id }),
        now,
      ]
    );
  });

  const host = (originUrl || 'http://localhost:5000').replace(/\/$/, '');
  const activationLink = `${host}/activate-account?token=${rawActivationToken}`;

  const emailResult = await emailService.sendOwnerActivationEmail({
    to: owner.email,
    ownerName: owner.name,
    libraryName: tenant.name,
    libraryCode: tenant.library_code || `LIB-${tenant.id.slice(0, 8)}`,
    accountId: owner.account_id || `OWN-${owner.id.slice(0, 8)}`,
    planName: tenant.plan_name || 'Standard Plan',
    status: tenant.status,
    activationLink,
    loginUrl: host,
  });

  return {
    success: true,
    emailDelivery: {
      sent: emailResult.sent,
      status: emailResult.status,
      messageId: emailResult.messageId || null,
      error: emailResult.failureReason || null,
      activationLink,
    },
  };
}

/**
 * Update library tenant status (e.g. 'active', 'suspended') or plan
 */
async function updateLibraryStatus(tenantId, status, currentAdminId) {
  const tenant = db.queryOne('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) {
    const error = new Error('Library tenant not found.');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();
  db.run('UPDATE tenants SET status = ?, updated_at = ? WHERE id = ?', [status, now, tenantId]);

  // Also update owner user status if suspended or reactivated
  if (status === 'suspended') {
    db.run("UPDATE users SET status = 'suspended', updated_at = ? WHERE tenant_id = ? AND role = 'library_owner'", [now, tenantId]);
  } else if (status === 'active') {
    // Only set user to active if they have already completed activation
    db.run("UPDATE users SET status = 'active', updated_at = ? WHERE tenant_id = ? AND role = 'library_owner' AND is_activated = 1", [now, tenantId]);
  }

  // Log in audit
  db.run(
    `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
     VALUES (?, ?, ?, 'supreme_admin', 'TENANT_STATUS_CHANGED', 'tenant', ?, ?, '127.0.0.1', ?)`,
    [uuidv4(), tenantId, currentAdminId, tenantId, JSON.stringify({ previousStatus: tenant.status, newStatus: status }), now]
  );

  return { success: true, status };
}

/**
 * Get SaaS Platform Revenue and Subscription Analytics
 */
async function getPlatformAnalytics() {
  const totalLibraries = db.queryOne('SELECT COUNT(*) as count FROM tenants')?.count || 0;
  const activeLibraries = db.queryOne("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'")?.count || 0;
  const suspendedLibraries = totalLibraries - activeLibraries;

  const totalStudentsAcrossPlatform = db.queryOne(
    "SELECT COUNT(*) as count FROM students WHERE status != 'anonymized'"
  )?.count || 0;

  const totalSeatsAcrossPlatform = db.queryOne(
    'SELECT COUNT(*) as count FROM seats WHERE is_active = 1'
  )?.count || 0;

  const totalPlatformSaaSSubscriptionRevenue = db.queryOne(
    "SELECT COALESCE(SUM(amount), 0) as total FROM saas_subscriptions WHERE status = 'active'"
  )?.total || 0;

  const totalTenantCollectedRevenue = db.queryOne(
    "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'"
  )?.total || 0;

  const recentSubscriptions = db.query(
    `SELECT sub.*, t.name as library_name, t.owner_name, p.name as plan_name
     FROM saas_subscriptions sub
     JOIN tenants t ON sub.tenant_id = t.id
     JOIN saas_plans p ON sub.plan_id = p.id
     ORDER BY sub.created_at DESC
     LIMIT 10`
  );

  const plans = db.query('SELECT * FROM saas_plans ORDER BY price_monthly ASC');

  return {
    overview: {
      totalLibraries,
      activeLibraries,
      suspendedLibraries,
      totalStudentsAcrossPlatform,
      totalSeatsAcrossPlatform,
      totalPlatformSaaSSubscriptionRevenue,
      totalTenantCollectedRevenue,
    },
    plans,
    recentSubscriptions,
  };
}

/**
 * Platform Audit Logs (including sensitive read-only views and administrative events)
 */
async function getPlatformAuditLogs(options = {}) {
  const { tenantId = '', action = '', page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  let params = [];

  if (tenantId) {
    where.push('a.tenant_id = ?');
    params.push(tenantId);
  }

  if (action) {
    where.push('a.action LIKE ?');
    params.push(`%${action}%`);
  }

  const whereSql = where.join(' AND ');

  const totalRow = db.queryOne(`SELECT COUNT(*) as count FROM audit_logs a WHERE ${whereSql}`, params);
  const total = totalRow ? totalRow.count : 0;

  const logs = db.query(
    `SELECT a.*, t.name as library_name, u.email as user_email_ref
     FROM audit_logs a
     LEFT JOIN tenants t ON a.tenant_id = t.id
     LEFT JOIN users u ON a.user_id = u.id
     WHERE ${whereSql}
     ORDER BY a.created_at DESC
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
  getAllLibraries,
  createLibrary,
  resendActivationEmail,
  updateLibraryStatus,
  getPlatformAnalytics,
  getPlatformAuditLogs,
};
