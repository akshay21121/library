-- Multi-Tenant Library Management SaaS Database Schema
PRAGMA foreign_keys = ON;

-- Tenants (Libraries)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  banner_url TEXT,
  photos TEXT DEFAULT '[]',
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'India',
  opening_time TEXT DEFAULT '08:00',
  closing_time TEXT DEFAULT '22:00',
  weekly_holidays TEXT DEFAULT '["Sunday"]',
  special_closures TEXT DEFAULT '[]',
  description TEXT,
  facilities TEXT DEFAULT '["High-Speed WiFi","Air Conditioned","Ergonomic Chairs","Power Sockets","Silent Study Zone","RO Filtered Water","CCTV Security"]',
  receipt_header TEXT DEFAULT 'Official Fee Receipt',
  receipt_footer TEXT DEFAULT 'Thank you for your study time. Maintain quietness inside the library.',
  business_tax_id TEXT DEFAULT '',
  currency TEXT DEFAULT 'INR',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  auto_whatsapp_enabled INTEGER DEFAULT 1,
  reminder_days_before INTEGER DEFAULT 3,
  reminder_time TEXT DEFAULT '10:00',
  plan_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Users (Supreme Admin and Library Owners)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'supreme_admin', 'library_owner'
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'active',
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- SaaS Plans (Platform-level)
CREATE TABLE IF NOT EXISTS saas_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly REAL NOT NULL,
  price_annual REAL NOT NULL,
  max_students INTEGER NOT NULL,
  max_seats INTEGER NOT NULL,
  features TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- SaaS Subscriptions
CREATE TABLE IF NOT EXISTS saas_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES saas_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  amount REAL NOT NULL,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  payment_method TEXT DEFAULT 'upi',
  last_payment_date TEXT,
  created_at TEXT NOT NULL
);

-- Floors
CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level_index INTEGER DEFAULT 0,
  width INTEGER DEFAULT 1200,
  height INTEGER DEFAULT 800,
  grid_size INTEGER DEFAULT 20,
  created_at TEXT NOT NULL
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  x REAL DEFAULT 0,
  y REAL DEFAULT 0,
  width REAL DEFAULT 300,
  height REAL DEFAULT 200,
  created_at TEXT NOT NULL
);

-- Shifts (Fixed 3 shifts per library)
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_number INTEGER NOT NULL, -- 1, 2, 3
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, shift_number)
);

-- Seats
CREATE TABLE IF NOT EXISTS seats (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  seat_number TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL DEFAULT 64,
  height REAL DEFAULT 64,
  rotation REAL DEFAULT 0,
  seat_type TEXT DEFAULT 'standard',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, seat_number)
);

-- Floor Layout Elements (Walls, partitions, tables, doors, labels)
CREATE TABLE IF NOT EXISTS floor_elements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  element_type TEXT NOT NULL, -- 'wall', 'partition', 'table', 'door', 'entrance', 'label', 'pillar'
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  rotation REAL DEFAULT 0,
  label TEXT,
  color TEXT,
  properties TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

-- Fee Plans
CREATE TABLE IF NOT EXISTS fee_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_days INTEGER DEFAULT 30,
  shifts_allowed INTEGER DEFAULT 1,
  price REAL NOT NULL,
  admission_fee REAL DEFAULT 0,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  admission_number TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  id_proof_type TEXT,
  id_proof_number TEXT,
  photo_url TEXT,
  address TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'anonymized'
  admission_date TEXT NOT NULL,
  membership_plan_id TEXT REFERENCES fee_plans(id) ON DELETE SET NULL,
  membership_start TEXT,
  membership_expiry TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, admission_number)
);

-- Seat Bookings
CREATE TABLE IF NOT EXISTS seat_bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  seat_id TEXT NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'transferred'
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  fee_plan_id TEXT REFERENCES fee_plans(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  title TEXT NOT NULL,
  total_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  balance_amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT DEFAULT 'unpaid', -- 'paid', 'partial', 'unpaid', 'overdue'
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, invoice_number)
);

-- Payments & Receipts
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL, -- 'cash', 'upi', 'card', 'bank_transfer', 'cheque'
  transaction_ref TEXT,
  notes TEXT,
  payment_date TEXT NOT NULL,
  created_by_user_id TEXT,
  status TEXT DEFAULT 'completed', -- 'completed', 'reversed', 'adjusted'
  reversal_reason TEXT,
  reversed_at TEXT,
  reversed_by_user_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, receipt_number)
);

-- WhatsApp Templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  variables TEXT DEFAULT '[]',
  is_default INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, template_key)
);

-- WhatsApp Notification Logs
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  status TEXT DEFAULT 'queued', -- 'queued', 'sent', 'delivered', 'failed'
  provider_message_id TEXT,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  sent_at TEXT,
  created_at TEXT NOT NULL
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT,
  user_email TEXT,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seats_tenant_floor ON seats(tenant_id, floor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_seat_shift ON seat_bookings(seat_id, shift_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON seat_bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_whatsapp_tenant_status ON whatsapp_logs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON audit_logs(tenant_id, created_at);
