const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
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

  // Check if owner has activated account yet
  if (user.role === 'library_owner' && user.is_activated === 0) {
    const error = new Error('Account not yet activated. Please use the activation link sent to your email to set your password.');
    error.statusCode = 403;
    throw error;
  }

  // Check library tenant status
  if (user.tenant_id && user.tenant_status === 'pending') {
    const error = new Error('Your library is currently pending approval by platform administration. You will be notified once activated.');
    error.statusCode = 403;
    throw error;
  }

  if (user.tenant_id && user.tenant_status === 'suspended') {
    const error = new Error('Your library subscription has been suspended. Please contact platform administration.');
    error.statusCode = 403;
    throw error;
  }

  if (user.status !== 'active') {
    const error = new Error('Your user account has been deactivated. Please contact support.');
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
      accountId: user.account_id,
      libraryName: user.library_name || null,
      librarySlug: user.library_slug || null,
      libraryLogo: user.library_logo || null,
    },
  };
}

async function getMe(userId) {
  const user = db.queryOne(
    `SELECT u.id, u.tenant_id, u.account_id, u.role, u.name, u.email, u.phone, u.status, u.last_login_at,
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

/**
 * Validate a single-use account activation token
 */
async function validateActivationToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    const error = new Error('Activation token is required.');
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = db.queryOne(
    `SELECT u.*, t.name as library_name, t.library_code, t.status as tenant_status
     FROM users u
     LEFT JOIN tenants t ON u.tenant_id = t.id
     WHERE u.activation_token_hash = ?`,
    [tokenHash]
  );

  if (!user) {
    const error = new Error('Invalid or unrecognized activation link. If you already activated your account, you can sign in directly.');
    error.statusCode = 400;
    throw error;
  }

  if (!user.activation_token_expires_at || new Date(user.activation_token_expires_at) < new Date()) {
    const error = new Error('This activation link has expired (validity is 48 hours). Please request a new activation link from your administrator.');
    error.statusCode = 400;
    throw error;
  }

  return {
    valid: true,
    email: user.email,
    name: user.name,
    accountId: user.account_id,
    libraryName: user.library_name,
    libraryCode: user.library_code,
    tenantStatus: user.tenant_status || 'active',
  };
}

/**
 * Set password and activate account
 */
async function activateAccount(rawToken, password) {
  if (!rawToken || typeof rawToken !== 'string') {
    const error = new Error('Activation token is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!password || password.length < 8) {
    const error = new Error('Password must be at least 8 characters long.');
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = db.queryOne(
    `SELECT u.*, t.name as library_name, t.status as tenant_status
     FROM users u
     LEFT JOIN tenants t ON u.tenant_id = t.id
     WHERE u.activation_token_hash = ?`,
    [tokenHash]
  );

  if (!user) {
    const error = new Error('Invalid or expired activation link.');
    error.statusCode = 400;
    throw error;
  }

  if (!user.activation_token_expires_at || new Date(user.activation_token_expires_at) < new Date()) {
    const error = new Error('This activation link has expired. Please request a new link from your administrator.');
    error.statusCode = 400;
    throw error;
  }

  if (user.tenant_status === 'suspended') {
    const error = new Error('This library has been suspended. Password creation is restricted until authorization is restored.');
    error.statusCode = 403;
    throw error;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const now = new Date().toISOString();
  const newUserStatus = user.tenant_status === 'pending' ? 'pending' : 'active';

  db.transaction(() => {
    db.run(
      `UPDATE users SET
        password_hash = ?,
        is_activated = 1,
        activation_token_hash = NULL,
        activation_token_expires_at = NULL,
        status = ?,
        updated_at = ?
       WHERE id = ?`,
      [passwordHash, newUserStatus, now, user.id]
    );

    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, user_email, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, 'library_owner', 'ACCOUNT_ACTIVATED', 'user', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        user.tenant_id,
        user.id,
        user.email,
        user.id,
        JSON.stringify({ accountId: user.account_id, tenantStatus: user.tenant_status }),
        now,
      ]
    );
  });

  return {
    success: true,
    message: 'Your password has been successfully set!',
    tenantStatus: user.tenant_status || 'active',
    email: user.email,
  };
}

module.exports = {
  login,
  getMe,
  validateActivationToken,
  activateAccount,
};
