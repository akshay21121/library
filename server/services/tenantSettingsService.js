const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

async function getTenantSettings(tenantId) {
  const tenant = db.queryOne('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) {
    const error = new Error('Library tenant not found.');
    error.statusCode = 404;
    throw error;
  }

  // Parse JSON fields safely
  let weeklyHolidays = [];
  try {
    weeklyHolidays = JSON.parse(tenant.weekly_holidays || '[]');
  } catch (e) {
    weeklyHolidays = [];
  }

  let specialClosures = [];
  try {
    specialClosures = JSON.parse(tenant.special_closures || '[]');
  } catch (e) {
    specialClosures = [];
  }

  let facilities = [];
  try {
    facilities = JSON.parse(tenant.facilities || '[]');
  } catch (e) {
    facilities = [];
  }

  let photos = [];
  try {
    photos = JSON.parse(tenant.photos || '[]');
  } catch (e) {
    photos = [];
  }

  // Get active subscription info
  const subscription = db.queryOne(
    `SELECT s.*, p.name as plan_name, p.max_students, p.max_seats
     FROM saas_subscriptions s
     JOIN saas_plans p ON s.plan_id = p.id
     WHERE s.tenant_id = ? AND s.status = 'active'
     ORDER BY s.created_at DESC LIMIT 1`,
    [tenantId]
  );

  return {
    ...tenant,
    weekly_holidays: weeklyHolidays,
    special_closures: specialClosures,
    facilities,
    photos,
    subscription,
  };
}

async function updateTenantSettings(tenantId, data, currentUserId) {
  const existing = db.queryOne('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!existing) {
    const error = new Error('Library tenant not found.');
    error.statusCode = 404;
    throw error;
  }

  const {
    name = existing.name,
    owner_name = existing.owner_name,
    email = existing.email,
    phone = existing.phone,
    address = existing.address,
    city = existing.city,
    state = existing.state,
    postal_code = existing.postal_code,
    country = existing.country,
    opening_time = existing.opening_time,
    closing_time = existing.closing_time,
    weekly_holidays = existing.weekly_holidays,
    special_closures = existing.special_closures,
    description = existing.description,
    facilities = existing.facilities,
    receipt_header = existing.receipt_header,
    receipt_footer = existing.receipt_footer,
    business_tax_id = existing.business_tax_id,
    currency = existing.currency,
    timezone = existing.timezone,
    auto_whatsapp_enabled = existing.auto_whatsapp_enabled,
    reminder_days_before = existing.reminder_days_before,
    reminder_time = existing.reminder_time,
    logo_url = existing.logo_url,
    banner_url = existing.banner_url,
    photos = existing.photos,
  } = data;

  const now = new Date().toISOString();

  const holidaysJson = typeof weekly_holidays === 'string' ? weekly_holidays : JSON.stringify(weekly_holidays || []);
  const closuresJson = typeof special_closures === 'string' ? special_closures : JSON.stringify(special_closures || []);
  const facilitiesJson = typeof facilities === 'string' ? facilities : JSON.stringify(facilities || []);
  const photosJson = typeof photos === 'string' ? photos : JSON.stringify(photos || []);

  db.transaction(() => {
    db.run(
      `UPDATE tenants SET
        name = ?, owner_name = ?, email = ?, phone = ?, address = ?, city = ?, state = ?,
        postal_code = ?, country = ?, opening_time = ?, closing_time = ?, weekly_holidays = ?,
        special_closures = ?, description = ?, facilities = ?, receipt_header = ?,
        receipt_footer = ?, business_tax_id = ?, currency = ?, timezone = ?,
        auto_whatsapp_enabled = ?, reminder_days_before = ?, reminder_time = ?,
        logo_url = ?, banner_url = ?, photos = ?, updated_at = ?
       WHERE id = ?`,
      [
        (name || '').trim(),
        (owner_name || '').trim(),
        (email || '').trim().toLowerCase(),
        (phone || '').trim(),
        (address || '').trim(),
        (city || '').trim(),
        (state || '').trim(),
        (postal_code || '').trim(),
        (country || '').trim(),
        opening_time || '08:00',
        closing_time || '22:00',
        holidaysJson,
        closuresJson,
        (description || '').trim(),
        facilitiesJson,
        (receipt_header || '').trim(),
        (receipt_footer || '').trim(),
        (business_tax_id || '').trim(),
        (currency || 'INR').trim(),
        (timezone || 'Asia/Kolkata').trim(),
        auto_whatsapp_enabled ? 1 : 0,
        parseInt(reminder_days_before, 10) || 3,
        reminder_time || '10:00',
        logo_url || null,
        banner_url || null,
        photosJson,
        now,
        tenantId,
      ]
    );

    // Audit log
    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'SETTINGS_UPDATED', 'tenant', ?, ?, '127.0.0.1', ?)`,
      [uuidv4(), tenantId, currentUserId, tenantId, JSON.stringify({ name, email, phone }), now]
    );
  });

  return { success: true };
}

module.exports = {
  getTenantSettings,
  updateTenantSettings,
};
