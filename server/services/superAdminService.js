const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

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
    where.push('(t.name LIKE ? OR t.owner_name LIKE ? OR t.email LIKE ? OR t.city LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const whereSql = where.join(' AND ');

  const libraries = db.query(
    `SELECT t.*, p.name as plan_name, p.price_monthly,
            (SELECT COUNT(*) FROM students s WHERE s.tenant_id = t.id AND s.status != 'anonymized') as total_students,
            (SELECT COUNT(*) FROM seats st WHERE st.tenant_id = t.id AND st.is_active = 1) as total_seats,
            (SELECT COALESCE(SUM(pm.amount), 0) FROM payments pm WHERE pm.tenant_id = t.id AND pm.status = 'completed') as total_revenue,
            (SELECT COUNT(*) FROM seat_bookings sb WHERE sb.tenant_id = t.id AND sb.status = 'active') as active_bookings
     FROM tenants t
     LEFT JOIN saas_plans p ON t.plan_id = p.id
     WHERE ${whereSql}
     ORDER BY t.created_at DESC`,
    params
  );

  return libraries;
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
  updateLibraryStatus,
  getPlatformAnalytics,
  getPlatformAuditLogs,
};
