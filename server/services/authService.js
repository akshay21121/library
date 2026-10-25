const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/database');

async function login(email, password) {
  const user = db.queryOne(
    `SELECT u.*, t.name as library_name, t.slug as library_slug, t.logo_url as library_logo, t.status as tenant_status
     FROM users u
     LEFT JOIN tenants t ON u.tenant_id = t.id
     WHERE u.email = ?`,
    [email.toLowerCase().trim()]
  );

  if (!user) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  if (user.status !== 'active') {
    const error = new Error('Your user account has been deactivated. Please contact support.');
    error.statusCode = 403;
    throw error;
  }

  if (user.tenant_id && user.tenant_status === 'suspended') {
    const error = new Error('Your library subscription has been suspended. Please contact platform administration.');
    error.statusCode = 403;
    throw error;
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const now = new Date().toISOString();
  db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [now, now, user.id]);

  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenant_id,
      libraryName: user.library_name || null,
      librarySlug: user.library_slug || null,
      libraryLogo: user.library_logo || null,
    },
  };
}

async function getMe(userId) {
  const user = db.queryOne(
    `SELECT u.id, u.tenant_id, u.role, u.name, u.email, u.phone, u.status, u.last_login_at,
            t.name as library_name, t.slug as library_slug, t.logo_url as library_logo, t.currency
     FROM users u
     LEFT JOIN tenants t ON u.tenant_id = t.id
     WHERE u.id = ?`,
    [userId]
  );
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }
  return user;
}

module.exports = {
  login,
  getMe,
};
