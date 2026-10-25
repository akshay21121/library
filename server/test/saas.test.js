const assert = require('assert');
const { app } = require('../server');
const db = require('../db/database');
const { seed } = require('../db/seed');

let serverInstance;
let baseUrl;

async function request(method, path, options = {}) {
  const { headers = {}, body = null } = options;
  const url = `${baseUrl}${path}`;
  const reqOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    reqOptions.body = JSON.stringify(body);
  }
  const res = await fetch(url, reqOptions);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, body: data };
}

async function runTests() {
  console.log('--- Starting Comprehensive SaaS Test Suite ---');
  await db.initDb();
  await seed();

  const http = require('http');
  serverInstance = http.createServer(app);
  await new Promise((resolve) => serverInstance.listen(0, resolve));
  const port = serverInstance.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // 1. Test Health Check
    console.log('Test 1: Health check...');
    const health = await request('GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'ok');

    // 2. Test Login Authentication
    console.log('Test 2: Authentication (Supreme Admin & Library Owner)...');
    // Admin login
    const adminRes = await request('POST', '/api/auth/login', {
      body: { email: 'admin@librarysaas.com', password: 'Admin@12345' },
    });
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.body.user.role, 'supreme_admin');
    const adminToken = adminRes.body.token;

    // Apex Owner login
    const apexOwnerRes = await request('POST', '/api/auth/login', {
      body: { email: 'apex.owner@gmail.com', password: 'Owner@12345' },
    });
    assert.strictEqual(apexOwnerRes.status, 200);
    assert.strictEqual(apexOwnerRes.body.user.role, 'library_owner');
    const apexToken = apexOwnerRes.body.token;
    const apexTenantId = apexOwnerRes.body.user.tenantId;

    // Zenith Owner login
    const zenithOwnerRes = await request('POST', '/api/auth/login', {
      body: { email: 'zenith.owner@gmail.com', password: 'Owner@12345' },
    });
    assert.strictEqual(zenithOwnerRes.status, 200);
    const zenithToken = zenithOwnerRes.body.token;
    const zenithTenantId = zenithOwnerRes.body.user.tenantId;
    assert.notStrictEqual(apexTenantId, zenithTenantId, 'Tenants must have different IDs');

    // Bad password login
    const badLogin = await request('POST', '/api/auth/login', {
      body: { email: 'apex.owner@gmail.com', password: 'WrongPassword' },
    });
    assert.strictEqual(badLogin.status, 401);

    // 3. Test Strict Tenant Isolation (Library Owner 1 cannot see or mutate Tenant 2)
    console.log('Test 3: Server-side Tenant Isolation...');
    const apexStudentsRes = await request('GET', '/api/students', {
      headers: { Authorization: `Bearer ${apexToken}` },
    });
    assert.strictEqual(apexStudentsRes.status, 200);
    const apexStudentList = apexStudentsRes.body.students;
    // All returned students MUST belong to Apex tenant
    for (const s of apexStudentList) {
      assert.strictEqual(s.tenant_id, apexTenantId);
    }

    const zenithStudentsRes = await request('GET', '/api/students', {
      headers: { Authorization: `Bearer ${zenithToken}` },
    });
    assert.strictEqual(zenithStudentsRes.status, 200);
    const zenithStudentList = zenithStudentsRes.body.students;
    for (const s of zenithStudentList) {
      assert.strictEqual(s.tenant_id, zenithTenantId);
    }

    // Attempting to access Zenith student using Apex owner token must fail (404 / not found in tenant)
    const zenithStudentId = zenithStudentList[0].id;
    const crossTenantAccess = await request('GET', `/api/students/${zenithStudentId}`, {
      headers: { Authorization: `Bearer ${apexToken}` },
    });
    assert.strictEqual(crossTenantAccess.status, 404, 'Cross-tenant access must return 404');

    // 4. Test Student Creation, Editing, and Privacy-Compliant Deletion
    console.log('Test 4: Student lifecycle and permanent deletion...');
    const newStudentRes = await request('POST', '/api/students', {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: {
        name: 'Dev Test Student',
        phone: '+919876540099',
        email: 'devtest@gmail.com',
        admission_date: '2026-10-25',
      },
    });
    assert.strictEqual(newStudentRes.status, 201);
    const createdStudentId = newStudentRes.body.id;

    // Edit student
    const editRes = await request('PUT', `/api/students/${createdStudentId}`, {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: { name: 'Dev Test Student Renamed' },
    });
    assert.strictEqual(editRes.status, 200);

    // Compliance Anonymize Deletion
    const deleteRes = await request('DELETE', `/api/students/${createdStudentId}?mode=compliance_anonymize`, {
      headers: { Authorization: `Bearer ${apexToken}` },
    });
    assert.strictEqual(deleteRes.status, 200);

    // Verify student is anonymized
    const anonymizedStudent = db.queryOne('SELECT * FROM students WHERE id = ?', [createdStudentId]);
    assert.strictEqual(anonymizedStudent.status, 'anonymized');
    assert.strictEqual(anonymizedStudent.name, '[Deleted Student]');
    assert.strictEqual(anonymizedStudent.phone, '[REDACTED]');

    // 5. Test 3-Shift Status Calculation on Floor Plan
    console.log('Test 5: 3-Shift Seat Status Calculation...');
    const floorsRes = await request('GET', '/api/floors', {
      headers: { Authorization: `Bearer ${apexToken}` },
    });
    assert.strictEqual(floorsRes.status, 200);
    const apexFloor = floorsRes.body[0];

    const seatMapRes = await request('GET', `/api/seats/floor/${apexFloor.id}`, {
      headers: { Authorization: `Bearer ${apexToken}` },
    });
    assert.strictEqual(seatMapRes.status, 200);
    assert.ok(seatMapRes.body.seats.length > 0);

    // Check that every seat has exactly 3 shift segments
    for (const seat of seatMapRes.body.seats) {
      assert.strictEqual(seat.shifts.length, 3, `Seat ${seat.seat_number} must have 3 shifts`);
      for (const shift of seat.shifts) {
        assert.ok(['BOOKED', 'AVAILABLE'].includes(shift.status));
        assert.ok(['#10b981', '#ef4444'].includes(shift.color));
      }
    }

    // 6. Test Booking Conflict Prevention
    console.log('Test 6: Booking Conflict Prevention...');
    // Find an already booked seat & shift
    const existingBooking = db.queryOne(
      'SELECT * FROM seat_bookings WHERE tenant_id = ? AND status = "active" LIMIT 1',
      [apexTenantId]
    );
    assert.ok(existingBooking, 'Active booking should exist');

    // Attempting to book the SAME seat & shift for an overlapping period must fail with 409 Conflict
    const conflictRes = await request('POST', '/api/seats/allocate', {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: {
        seatId: existingBooking.seat_id,
        shiftId: existingBooking.shift_id,
        studentId: apexStudentList[0].id,
        startDate: existingBooking.start_date,
        endDate: existingBooking.end_date,
      },
    });
    assert.strictEqual(conflictRes.status, 409, 'Overlapping booking must return 409 Conflict');
    assert.ok(conflictRes.body.message.includes('Booking Conflict'));

    // 7. Test Fee Collection, Sequential Receipt, and Reversal Workflow
    console.log('Test 7: Financial Integrity (Receipt & Reversal)...');
    // Create an invoice
    const invRes = await request('POST', '/api/fees/invoices', {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: {
        studentId: apexStudentList[0].id,
        title: 'Test Monthly Library Fee',
        totalAmount: 1000,
        dueDate: '2026-11-01',
      },
    });
    assert.strictEqual(invRes.status, 201);
    const invoiceId = invRes.body.id;

    // Record Payment
    const payRes = await request('POST', '/api/fees/payments', {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: {
        invoiceId,
        amount: 1000,
        paymentMode: 'upi',
        transactionRef: 'UPI/TEST/12345',
      },
    });
    assert.strictEqual(payRes.status, 201);
    const paymentId = payRes.body.paymentId;
    assert.ok(payRes.body.receiptNumber.startsWith('REC-'));

    // Fetch printable receipt
    const receiptRes = await request('GET', `/api/fees/receipts/${paymentId}`, {
      headers: { Authorization: `Bearer ${apexToken}` },
    });
    assert.strictEqual(receiptRes.status, 200);
    assert.strictEqual(receiptRes.body.library.name, 'Apex Digital Study Library');
    assert.strictEqual(receiptRes.body.payment.amount, 1000);

    // Reverse payment
    const reverseRes = await request('POST', `/api/fees/payments/${paymentId}/reverse`, {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: { reason: 'Accidental payment entry for testing' },
    });
    assert.strictEqual(reverseRes.status, 200);

    // Verify invoice balance is restored
    const updatedInvoice = db.queryOne('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    assert.strictEqual(updatedInvoice.balance_amount, 1000);
    assert.strictEqual(updatedInvoice.status, 'unpaid');

    // 8. Test Supreme Admin STRICT READ-ONLY MODE on Tenant View
    console.log('Test 8: Supreme Admin Strict Read-Only Mode...');
    // Supreme admin viewing Apex library's students (GET) must succeed
    const adminViewRes = await request('GET', '/api/students', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-view-tenant-id': apexTenantId,
      },
    });
    assert.strictEqual(adminViewRes.status, 200);

    // Supreme admin attempting to mutate (POST/PUT/DELETE) tenant data must be REJECTED with 403 Forbidden!
    const adminMutationRes = await request('POST', '/api/students', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-view-tenant-id': apexTenantId,
      },
      body: {
        name: 'Unauthorized Student',
        phone: '+919999999999',
      },
    });
    assert.strictEqual(adminMutationRes.status, 403, 'Supreme Admin mutation in tenant mode must return 403');
    assert.strictEqual(adminMutationRes.body.error, 'READ_ONLY_ACCESS_DENIED');

    // 9. Test Manual WhatsApp Reminders & Idempotency
    console.log('Test 9: WhatsApp Reminders & Idempotency...');
    const reminderRes = await request('POST', '/api/whatsapp/remind-manual', {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: {
        studentIds: [apexStudentList[0].id],
      },
    });
    assert.strictEqual(reminderRes.status, 200);
    assert.ok(reminderRes.body.processed.length > 0);

    // Second immediate send should detect duplicate via idempotency key
    const dupReminderRes = await request('POST', '/api/whatsapp/remind-manual', {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: {
        studentIds: [apexStudentList[0].id],
      },
    });
    assert.strictEqual(dupReminderRes.status, 200);
    assert.strictEqual(dupReminderRes.body.processed[0].status, 'skipped_duplicate');

    // 10. Test Library Settings Isolation
    console.log('Test 10: Library Settings Tenant Isolation...');
    const updateApexSettings = await request('PUT', '/api/tenant/settings', {
      headers: { Authorization: `Bearer ${apexToken}` },
      body: {
        name: 'Apex Digital Study Library (Updated)',
        opening_time: '06:30',
      },
    });
    assert.strictEqual(updateApexSettings.status, 200);

    // Verify Zenith was NOT modified
    const zenithSettings = db.queryOne('SELECT * FROM tenants WHERE id = ?', [zenithTenantId]);
    assert.strictEqual(zenithSettings.name, 'Zenith Scholar Hub');
    assert.strictEqual(zenithSettings.opening_time, '07:00');

    console.log('\n ALL 10 CRITICAL BACKEND TESTS PASSED SUCCESSFULLY! \n');
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n TEST FAILED:\n', err);
      process.exit(1);
    });
}

module.exports = { runTests };
