const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

/**
 * Tenant Isolation Middleware
 * Enforces server-side tenant boundary for all tenant-scoped routes.
 *
 * Rules:
 * 1. Library Owner: req.tenantId is strictly bound to req.user.tenantId.
 *    Any mismatch between request params/body and req.user.tenantId is rejected.
 * 2. Supreme Admin:
 *    - Can specify target library via 'x-view-tenant-id' header or 'tenantId' query.
 *    - STRICT READ-ONLY MODE is enforced: Any non-GET method (POST, PUT, PATCH, DELETE)
 *      is strictly rejected with 403 Forbidden.
 *    - Sensitive administrative access is recorded in audit_logs.
 */
function enforceTenantIsolation(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
  }

  // 1. Library Owner
  if (req.user.role === 'library_owner') {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'NO_TENANT_ASSOCIATED', message: 'User is not associated with any active library.' });
    }

    // Verify tenant is active
    const tenant = db.queryOne('SELECT id, status FROM tenants WHERE id = ?', [req.user.tenantId]);
    if (!tenant) {
      return res.status(404).json({ error: 'TENANT_NOT_FOUND', message: 'Library tenant does not exist.' });
    }
    if (tenant.status === 'suspended') {
      return res.status(403).json({ error: 'TENANT_SUSPENDED', message: 'Library account has been suspended by platform administration.' });
    }

    req.tenantId = req.user.tenantId;
    req.isReadOnly = false;
    return next();
  }

  // 2. Supreme Admin
  if (req.user.role === 'supreme_admin') {
    const requestedTenantId = req.headers['x-view-tenant-id'] || req.query.tenantId || req.body?.tenantId;

    if (!requestedTenantId) {
      return res.status(400).json({
        error: 'TENANT_ID_REQUIRED',
        message: 'Supreme Admin must specify target library via x-view-tenant-id header or tenantId parameter.'
      });
    }

    // Verify tenant exists
    const tenant = db.queryOne('SELECT id, name, status FROM tenants WHERE id = ?', [requestedTenantId]);
    if (!tenant) {
      return res.status(404).json({ error: 'TENANT_NOT_FOUND', message: 'Target library tenant does not exist.' });
    }

    req.tenantId = requestedTenantId;
    req.isReadOnly = true;

    // STRICT READ-ONLY ENFORCEMENT: Mutation methods are forbidden for Supreme Admin in tenant view
    if (req.method !== 'GET') {
      // Audit blocked mutation attempt
      db.run(
        `INSERT INTO audit_logs (id, tenant_id, user_id, user_email, role, action, entity_type, details, ip_address, created_at)
         VALUES (?, ?, ?, ?, 'supreme_admin', 'BLOCKED_MUTATION_IN_READONLY_MODE', 'tenant', ?, ?, ?)`,
        [
          uuidv4(),
          req.tenantId,
          req.user.userId,
          req.user.email,
          JSON.stringify({ method: req.method, path: req.originalUrl }),
          req.ip || '127.0.0.1',
          new Date().toISOString()
        ]
      );

      return res.status(403).json({
        error: 'READ_ONLY_ACCESS_DENIED',
        message: 'Strict Read-Only Mode: Supreme Admin is restricted to view-only access. Modifying library operational data is prohibited by security policy.'
      });
    }

    // Audit view access on entry for sensitive transparency
    if (req.method === 'GET' && req.originalUrl.includes('/api/')) {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO audit_logs (id, tenant_id, user_id, user_email, role, action, entity_type, details, ip_address, created_at)
         VALUES (?, ?, ?, ?, 'supreme_admin', 'SUPER_ADMIN_VIEW_TENANT', 'tenant', ?, ?, ?)`,
        [
          uuidv4(),
          req.tenantId,
          req.user.userId,
          req.user.email,
          JSON.stringify({ path: req.originalUrl, libraryName: tenant.name }),
          req.ip || '127.0.0.1',
          now
        ]
      );
    }

    return next();
  }

  return res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied.' });
}

module.exports = {
  enforceTenantIsolation,
};
