const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/database');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    // Verify user still exists and is active in DB
    const user = db.queryOne('SELECT id, tenant_id, role, name, email, status FROM users WHERE id = ?', [decoded.userId]);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User account not found or suspended.' });
    }

    req.user = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session expired or invalid token.' });
  }
}

function requireSupremeAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'supreme_admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Supreme Admin privileges required.' });
  }
  next();
}

function requireLibraryOwner(req, res, next) {
  if (!req.user || (req.user.role !== 'library_owner' && req.user.role !== 'supreme_admin')) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Library Owner privileges required.' });
  }
  next();
}

module.exports = {
  authenticate,
  requireSupremeAdmin,
  requireLibraryOwner,
};
