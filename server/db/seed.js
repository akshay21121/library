const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

async function seed() {
  await db.initDb();

  // Check if already seeded
  const existingUsers = db.query('SELECT COUNT(*) as count FROM users');
  if (existingUsers[0]?.count > 0) {
    console.log('Database already has data. Skipping seed.');
    return;
  }

  console.log('Seeding initial SaaS data...');
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('Admin@12345', salt);
  const ownerPasswordHash = bcrypt.hashSync('Owner@12345', salt);
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];

  // 1. SaaS Plans
  const planStarterId = uuidv4();
  const planProId = uuidv4();
  const planEnterpriseId = uuidv4();

  db.run(
    `INSERT INTO saas_plans (id, name, price_monthly, price_annual, max_students, max_seats, features, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planStarterId,
      'Starter Library',
      1499,
      14990,
      100,
      60,
      JSON.stringify(['1 Floor Plan', '3 Shifts/Seat', 'WhatsApp Manual Reminders', 'Basic Reports']),
      now
    ]
  );

  db.run(
    `INSERT INTO saas_plans (id, name, price_monthly, price_annual, max_students, max_seats, features, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planProId,
      'Professional Hub',
      2999,
      29990,
      350,
      200,
      JSON.stringify(['Multi-Floor Builder', 'Automatic WhatsApp Reminders', 'Detailed Financial Reports', 'Custom Receipts & Branding']),
      now
    ]
  );

  db.run(
    `INSERT INTO saas_plans (id, name, price_monthly, price_annual, max_students, max_seats, features, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planEnterpriseId,
      'Enterprise Network',
      5999,
      59990,
      1000,
      600,
      JSON.stringify(['Unlimited Floors & Seats', 'Automated Scheduled WhatsApp', 'Full Audit Logging', 'Priority Support']),
      now
    ]
  );

  // 2. Supreme Admin
  const adminId = uuidv4();
  db.run(
    `INSERT INTO users (id, tenant_id, role, name, email, password_hash, phone, status, created_at, updated_at)
     VALUES (?, NULL, 'supreme_admin', 'Supreme Platform Admin', 'admin@librarysaas.com', ?, '+919876543210', 'active', ?, ?)`,
    [adminId, adminPasswordHash, now, now]
  );

  // 3. Tenant 1: Apex Digital Study Library
  const apexTenantId = uuidv4();
  db.run(
    `INSERT INTO tenants (
      id, name, slug, logo_url, banner_url, owner_name, email, phone,
      address, city, state, postal_code, country, opening_time, closing_time,
      weekly_holidays, facilities, receipt_header, receipt_footer,
      business_tax_id, currency, timezone, auto_whatsapp_enabled, reminder_days_before, reminder_time,
      plan_id, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      apexTenantId,
      'Apex Digital Study Library',
      'apex-study',
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&h=400&fit=crop',
      'Rajesh Sharma',
      'apex.owner@gmail.com',
      '+919823456781',
      'Plot 42, Knowledge Corridor, Near Metro Station',
      'Jaipur',
      'Rajasthan',
      '302015',
      'India',
      '06:00',
      '23:00',
      JSON.stringify(['Sunday']),
      JSON.stringify(['High-Speed Fiber 300 Mbps', 'Central Air Conditioning', 'Ergonomic Mesh Chairs', 'Individual Power Socket', 'Silent Pin-Drop Zone', 'UV Filtered Cold Water', 'CCTV 24x7 Security']),
      'APEX DIGITAL STUDY LIBRARY - OFFICIAL RECEIPT',
      'Please maintain strict discipline and silence. Keep your student card with you.',
      'GSTIN08AAACA1234A1Z5',
      'INR',
      'Asia/Kolkata',
      1,
      3,
      '10:30',
      planProId,
      'active',
      now,
      now
    ]
  );

  // Tenant 1 Owner User
  const apexOwnerId = uuidv4();
  db.run(
    `INSERT INTO users (id, tenant_id, role, name, email, password_hash, phone, status, created_at, updated_at)
     VALUES (?, ?, 'library_owner', 'Rajesh Sharma', 'apex.owner@gmail.com', ?, '+919823456781', 'active', ?, ?)`,
    [apexOwnerId, apexTenantId, ownerPasswordHash, now, now]
  );

  // Tenant 1 Subscription
  db.run(
    `INSERT INTO saas_subscriptions (id, tenant_id, plan_id, status, billing_cycle, amount, current_period_start, current_period_end, created_at)
     VALUES (?, ?, ?, 'active', 'monthly', 2999, '2026-10-01', '2026-11-01', ?)`,
    [uuidv4(), apexTenantId, planProId, now]
  );

  // Tenant 1 Shifts (3 Shifts)
  const apexShift1Id = uuidv4();
  const apexShift2Id = uuidv4();
  const apexShift3Id = uuidv4();

  db.run(
    `INSERT INTO shifts (id, tenant_id, shift_number, name, start_time, end_time, created_at)
     VALUES (?, ?, 1, 'Morning Shift', '06:00', '12:00', ?)`,
    [apexShift1Id, apexTenantId, now]
  );
  db.run(
    `INSERT INTO shifts (id, tenant_id, shift_number, name, start_time, end_time, created_at)
     VALUES (?, ?, 2, 'Afternoon Shift', '12:00', '18:00', ?)`,
    [apexShift2Id, apexTenantId, now]
  );
  db.run(
    `INSERT INTO shifts (id, tenant_id, shift_number, name, start_time, end_time, created_at)
     VALUES (?, ?, 3, 'Evening Shift', '18:00', '23:30', ?)`,
    [apexShift3Id, apexTenantId, now]
  );

  // Tenant 1 Fee Plans
  const apexPlan1Id = uuidv4();
  const apexPlan2Id = uuidv4();
  const apexPlan3Id = uuidv4();

  db.run(
    `INSERT INTO fee_plans (id, tenant_id, name, duration_days, shifts_allowed, price, admission_fee, description, created_at)
     VALUES (?, ?, 'Single Shift (Monthly)', 30, 1, 900, 200, 'Access to 1 dedicated shift daily for 30 days', ?)`,
    [apexPlan1Id, apexTenantId, now]
  );
  db.run(
    `INSERT INTO fee_plans (id, tenant_id, name, duration_days, shifts_allowed, price, admission_fee, description, created_at)
     VALUES (?, ?, 'Double Shift (Monthly)', 30, 2, 1600, 200, 'Access to any 2 shifts daily for 30 days', ?)`,
    [apexPlan2Id, apexTenantId, now]
  );
  db.run(
    `INSERT INTO fee_plans (id, tenant_id, name, duration_days, shifts_allowed, price, admission_fee, description, created_at)
     VALUES (?, ?, 'Full Day 3 Shifts (Monthly)', 30, 3, 2200, 200, 'Full day reserved access across all 3 shifts', ?)`,
    [apexPlan3Id, apexTenantId, now]
  );

  // Tenant 1 Floor & Room
  const apexFloorId = uuidv4();
  db.run(
    `INSERT INTO floors (id, tenant_id, name, level_index, width, height, grid_size, created_at)
     VALUES (?, ?, 'Main Hall (Ground Floor)', 0, 1000, 650, 20, ?)`,
    [apexFloorId, apexTenantId, now]
  );

  const apexRoom1Id = uuidv4();
  const apexRoom2Id = uuidv4();
  db.run(
    `INSERT INTO rooms (id, tenant_id, floor_id, name, color, x, y, width, height, created_at)
     VALUES (?, ?, ?, 'Silent Reading Wing', '#3b82f6', 40, 40, 440, 560, ?)`,
    [apexRoom1Id, apexTenantId, apexFloorId, now]
  );
  db.run(
    `INSERT INTO rooms (id, tenant_id, floor_id, name, color, x, y, width, height, created_at)
     VALUES (?, ?, ?, 'Executive Cabin Area', '#8b5cf6', 520, 40, 440, 560, ?)`,
    [apexRoom2Id, apexTenantId, apexFloorId, now]
  );

  // Tenant 1 Floor Elements (Structural walls, door, entrance, desk)
  db.run(
    `INSERT INTO floor_elements (id, tenant_id, floor_id, element_type, x, y, width, height, rotation, label, color, properties, created_at)
     VALUES (?, ?, ?, 'entrance', 450, 600, 100, 30, 0, 'Main Entrance', '#10b981', '{}', ?)`,
    [uuidv4(), apexTenantId, apexFloorId, now]
  );
  db.run(
    `INSERT INTO floor_elements (id, tenant_id, floor_id, element_type, x, y, width, height, rotation, label, color, properties, created_at)
     VALUES (?, ?, ?, 'table', 440, 50, 120, 50, 0, 'Reception Desk', '#64748b', '{}', ?)`,
    [uuidv4(), apexTenantId, apexFloorId, now]
  );
  db.run(
    `INSERT INTO floor_elements (id, tenant_id, floor_id, element_type, x, y, width, height, rotation, label, color, properties, created_at)
     VALUES (?, ?, ?, 'partition', 490, 120, 10, 460, 0, 'Center Partition Wall', '#cbd5e1', '{}', ?)`,
    [uuidv4(), apexTenantId, apexFloorId, now]
  );

  // Tenant 1 Seats (16 seats with grid layout: 8 in Wing A, 8 in Wing B)
  const seatIds = [];
  // Wing A: Seats A-01 to A-08
  const wingAPos = [
    { num: 'A-01', x: 80, y: 100 },
    { num: 'A-02', x: 190, y: 100 },
    { num: 'A-03', x: 300, y: 100 },
    { num: 'A-04', x: 80, y: 230 },
    { num: 'A-05', x: 190, y: 230 },
    { num: 'A-06', x: 300, y: 230 },
    { num: 'A-07', x: 80, y: 360 },
    { num: 'A-08', x: 190, y: 360 },
  ];

  for (const pos of wingAPos) {
    const sId = uuidv4();
    seatIds.push({ id: sId, num: pos.num });
    db.run(
      `INSERT INTO seats (id, tenant_id, floor_id, room_id, seat_number, x, y, width, height, rotation, seat_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 80, 80, 0, 'standard', ?)`,
      [sId, apexTenantId, apexFloorId, apexRoom1Id, pos.num, pos.x, pos.y, now]
    );
  }

  // Wing B: Seats B-01 to B-08
  const wingBPos = [
    { num: 'B-01', x: 560, y: 100 },
    { num: 'B-02', x: 670, y: 100 },
    { num: 'B-03', x: 780, y: 100 },
    { num: 'B-04', x: 560, y: 230 },
    { num: 'B-05', x: 670, y: 230 },
    { num: 'B-06', x: 780, y: 230 },
    { num: 'B-07', x: 560, y: 360 },
    { num: 'B-08', x: 670, y: 360 },
  ];

  for (const pos of wingBPos) {
    const sId = uuidv4();
    seatIds.push({ id: sId, num: pos.num });
    db.run(
      `INSERT INTO seats (id, tenant_id, floor_id, room_id, seat_number, x, y, width, height, rotation, seat_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 80, 80, 0, 'premium', ?)`,
      [sId, apexTenantId, apexFloorId, apexRoom2Id, pos.num, pos.x, pos.y, now]
    );
  }

  // Tenant 1 Students (8 realistic students)
  const studentsData = [
    { name: 'Aarav Patel', phone: '+919876500001', email: 'aarav.patel@gmail.com', adm: 'APX-001', seatNum: 'A-01', shiftId: apexShift1Id, planId: apexPlan1Id, fee: 900, paid: 900 },
    { name: 'Pooja Verma', phone: '+919876500002', email: 'pooja.verma@gmail.com', adm: 'APX-002', seatNum: 'A-01', shiftId: apexShift2Id, planId: apexPlan1Id, fee: 900, paid: 900 },
    { name: 'Vikram Singh', phone: '+919876500003', email: 'vikram.singh@gmail.com', adm: 'APX-003', seatNum: 'A-02', shiftId: apexShift1Id, planId: apexPlan1Id, fee: 900, paid: 500 }, // Partial
    { name: 'Ananya Sharma', phone: '+919876500004', email: 'ananya.s@gmail.com', adm: 'APX-004', seatNum: 'A-02', shiftId: apexShift3Id, planId: apexPlan1Id, fee: 900, paid: 0 }, // Unpaid/Overdue
    { name: 'Rohan Gupta', phone: '+919876500005', email: 'rohan.gupta@gmail.com', adm: 'APX-005', seatNum: 'A-03', shiftId: apexShift2Id, planId: apexPlan1Id, fee: 900, paid: 900 },
    { name: 'Kavita Joshi', phone: '+919876500006', email: 'kavita.j@gmail.com', adm: 'APX-006', seatNum: 'B-01', shiftId: apexShift1Id, planId: apexPlan2Id, fee: 1600, paid: 1600 },
    { name: 'Siddharth Roy', phone: '+919876500007', email: 'siddharth.roy@gmail.com', adm: 'APX-007', seatNum: 'B-01', shiftId: apexShift2Id, planId: apexPlan2Id, fee: 1600, paid: 1600 },
    { name: 'Meera Nair', phone: '+919876500008', email: 'meera.nair@gmail.com', adm: 'APX-008', seatNum: 'B-02', shiftId: apexShift3Id, planId: apexPlan3Id, fee: 2200, paid: 0 }, // Unpaid
  ];

  let receiptSeq = 1;

  for (const s of studentsData) {
    const studentId = uuidv4();
    const expiryDate = '2026-11-24';
    db.run(
      `INSERT INTO students (
        id, tenant_id, admission_number, name, email, phone,
        emergency_contact_name, emergency_contact_phone, id_proof_type, id_proof_number,
        address, status, admission_date, membership_plan_id, membership_start, membership_expiry, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Parent/Guardian', '+919811223344', 'Aadhaar', '9876-5432-1098', 'Civil Lines, Jaipur', 'active', '2026-10-25', ?, '2026-10-25', ?, ?, ?)`,
      [studentId, apexTenantId, s.adm, s.name, s.email, s.phone, s.planId, expiryDate, now, now]
    );

    // Book seat
    const targetSeat = seatIds.find(item => item.num === s.seatNum);
    if (targetSeat) {
      db.run(
        `INSERT INTO seat_bookings (id, tenant_id, seat_id, shift_id, student_id, start_date, end_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '2026-10-25', ?, 'active', ?, ?)`,
        [uuidv4(), apexTenantId, targetSeat.id, s.shiftId, studentId, expiryDate, now, now]
      );
    }

    // Invoice
    const invoiceId = uuidv4();
    const invNum = `INV-2026-${String(receiptSeq).padStart(4, '0')}`;
    const balance = s.fee - s.paid;
    const invStatus = balance === 0 ? 'paid' : s.paid > 0 ? 'partial' : 'unpaid';

    db.run(
      `INSERT INTO invoices (id, tenant_id, student_id, fee_plan_id, invoice_number, title, total_amount, paid_amount, balance_amount, due_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'Monthly Library Membership Fee', ?, ?, ?, '2026-10-28', ?, ?, ?)`,
      [invoiceId, apexTenantId, studentId, s.planId, invNum, s.fee, s.paid, balance, invStatus, now, now]
    );

    // If paid, create payment & receipt
    if (s.paid > 0) {
      const recNum = `REC-2026-${String(receiptSeq).padStart(4, '0')}`;
      db.run(
        `INSERT INTO payments (id, tenant_id, invoice_id, student_id, receipt_number, amount, payment_mode, transaction_ref, notes, payment_date, created_by_user_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'upi', 'UPI/2026/TXN88992', 'Membership payment received via UPI', '2026-10-25', ?, 'completed', ?)`,
        [uuidv4(), apexTenantId, invoiceId, studentId, recNum, s.paid, apexOwnerId, now]
      );
    }

    receiptSeq++;
  }

  // Tenant 1 Default WhatsApp Templates
  db.run(
    `INSERT INTO whatsapp_templates (id, tenant_id, template_key, title, body_text, variables, is_default, created_at)
     VALUES (?, ?, 'fee_reminder_upcoming', 'Upcoming Fee Reminder', 'Dear {{student_name}},\n\nThis is a gentle reminder that your membership fee of {{amount}} for {{library_name}} is due on {{due_date}}.\n\nPlease complete the payment to maintain your reserved seat.\n\nWarm regards,\n{{library_name}}\nContact: {{phone}}', '["student_name","amount","library_name","due_date","phone"]', 1, ?)`,
    [uuidv4(), apexTenantId, now]
  );
  db.run(
    `INSERT INTO whatsapp_templates (id, tenant_id, template_key, title, body_text, variables, is_default, created_at)
     VALUES (?, ?, 'payment_receipt', 'Payment Receipt Confirmation', 'Dear {{student_name}},\n\nWe have received your payment of {{amount}} for {{library_name}}. Receipt No: {{receipt_number}}.\n\nThank you for choosing {{library_name}}.\n\nBest wishes for your studies!', '["student_name","amount","library_name","receipt_number"]', 1, ?)`,
    [uuidv4(), apexTenantId, now]
  );

  // 4. Tenant 2: Zenith Scholar's Hub (To test strict multi-tenant isolation)
  const zenithTenantId = uuidv4();
  db.run(
    `INSERT INTO tenants (
      id, name, slug, logo_url, banner_url, owner_name, email, phone,
      address, city, state, postal_code, country, opening_time, closing_time,
      weekly_holidays, facilities, receipt_header, receipt_footer,
      business_tax_id, currency, timezone, auto_whatsapp_enabled, reminder_days_before, reminder_time,
      plan_id, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      zenithTenantId,
      'Zenith Scholar Hub',
      'zenith-hub',
      'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&h=400&fit=crop',
      'Vikramaditya Roy',
      'zenith.owner@gmail.com',
      '+919833445566',
      '5th Floor, IT Tower, Cyber City',
      'Gurugram',
      'Haryana',
      '122002',
      'India',
      '07:00',
      '22:00',
      JSON.stringify([]),
      JSON.stringify(['Cafeteria Lounge', 'Air Conditioned', 'Soundproof Cubicles', 'High-Speed LAN & WiFi', 'Locker Facility']),
      'ZENITH SCHOLAR HUB RECEIPT',
      'Keep learning and growing with Zenith Hub.',
      'GSTIN07BBBCB5678B1Z9',
      'INR',
      'Asia/Kolkata',
      1,
      2,
      '09:00',
      planStarterId,
      'active',
      now,
      now
    ]
  );

  const zenithOwnerId = uuidv4();
  db.run(
    `INSERT INTO users (id, tenant_id, role, name, email, password_hash, phone, status, created_at, updated_at)
     VALUES (?, ?, 'library_owner', 'Vikramaditya Roy', 'zenith.owner@gmail.com', ?, '+919833445566', 'active', ?, ?)`,
    [zenithOwnerId, zenithTenantId, ownerPasswordHash, now, now]
  );

  // Tenant 2 Subscription
  db.run(
    `INSERT INTO saas_subscriptions (id, tenant_id, plan_id, status, billing_cycle, amount, current_period_start, current_period_end, created_at)
     VALUES (?, ?, ?, 'active', 'monthly', 1499, '2026-10-15', '2026-11-15', ?)`,
    [uuidv4(), zenithTenantId, planStarterId, now]
  );

  // Tenant 2 Shifts
  db.run(
    `INSERT INTO shifts (id, tenant_id, shift_number, name, start_time, end_time, created_at)
     VALUES (?, ?, 1, 'Early Bird Shift', '07:00', '12:00', ?)`,
    [uuidv4(), zenithTenantId, now]
  );
  db.run(
    `INSERT INTO shifts (id, tenant_id, shift_number, name, start_time, end_time, created_at)
     VALUES (?, ?, 2, 'Core Study Shift', '12:00', '17:00', ?)`,
    [uuidv4(), zenithTenantId, now]
  );
  db.run(
    `INSERT INTO shifts (id, tenant_id, shift_number, name, start_time, end_time, created_at)
     VALUES (?, ?, 3, 'Night Owl Shift', '17:00', '22:00', ?)`,
    [uuidv4(), zenithTenantId, now]
  );

  // Tenant 2 Floor & Seats
  const zenithFloorId = uuidv4();
  db.run(
    `INSERT INTO floors (id, tenant_id, name, level_index, width, height, grid_size, created_at)
     VALUES (?, ?, 'Level 5 - Main Wing', 0, 900, 600, 20, ?)`,
    [zenithFloorId, zenithTenantId, now]
  );

  for (let i = 1; i <= 6; i++) {
    db.run(
      `INSERT INTO seats (id, tenant_id, floor_id, seat_number, x, y, width, height, rotation, seat_type, created_at)
       VALUES (?, ?, ?, ?, ?, 100, 80, 80, 0, 'standard', ?)`,
      [uuidv4(), zenithTenantId, zenithFloorId, `Z-${String(i).padStart(2, '0')}`, 60 + (i - 1) * 120, now]
    );
  }

  // Tenant 2 Fee Plan
  const zenithPlanId = uuidv4();
  db.run(
    `INSERT INTO fee_plans (id, tenant_id, name, duration_days, shifts_allowed, price, admission_fee, description, created_at)
     VALUES (?, ?, 'Monthly Pass (1 Shift)', 30, 1, 1200, 300, 'Zenith single shift membership', ?)`,
    [zenithPlanId, zenithTenantId, now]
  );

  // Tenant 2 Student
  const zenithStudentId = uuidv4();
  db.run(
    `INSERT INTO students (
      id, tenant_id, admission_number, name, email, phone,
      emergency_contact_name, emergency_contact_phone, id_proof_type, id_proof_number,
      address, status, admission_date, membership_plan_id, membership_start, membership_expiry, created_at, updated_at
    ) VALUES (?, ?, 'ZNT-001', 'Kunal Sengupta', 'kunal.s@gmail.com', '+919988776655', 'Father', '+919988776600', 'Passport', 'P9876543', 'Cyber City, Gurugram', 'active', '2026-10-25', ?, '2026-10-25', '2026-11-25', ?, ?)`,
    [zenithStudentId, zenithTenantId, zenithPlanId, now, now]
  );

  // Tenant 2 Invoice
  db.run(
    `INSERT INTO invoices (id, tenant_id, student_id, fee_plan_id, invoice_number, title, total_amount, paid_amount, balance_amount, due_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'INV-ZNT-001', 'Zenith Membership Fee', 1200, 1200, 0, '2026-10-28', 'paid', ?, ?)`,
    [uuidv4(), zenithTenantId, zenithStudentId, zenithPlanId, now, now]
  );

  // Tenant 2 Audit Log
  db.run(
    `INSERT INTO audit_logs (id, tenant_id, user_id, user_email, role, action, entity_type, entity_id, details, ip_address, created_at)
     VALUES (?, ?, ?, 'zenith.owner@gmail.com', 'library_owner', 'TENANT_INITIALIZED', 'tenant', ?, '{}', '127.0.0.1', ?)`,
    [uuidv4(), zenithTenantId, zenithOwnerId, zenithTenantId, now]
  );

  // Tenant 1 Audit Log
  db.run(
    `INSERT INTO audit_logs (id, tenant_id, user_id, user_email, role, action, entity_type, entity_id, details, ip_address, created_at)
     VALUES (?, ?, ?, 'apex.owner@gmail.com', 'library_owner', 'TENANT_INITIALIZED', 'tenant', ?, '{}', '127.0.0.1', ?)`,
    [uuidv4(), apexTenantId, apexOwnerId, apexTenantId, now]
  );

  db.saveToDisk();
  console.log('Seeding completed successfully!');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seed };
