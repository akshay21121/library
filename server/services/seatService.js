const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

/**
 * Get all 3 shifts configured for the library tenant
 */
async function getShifts(tenantId) {
  const shifts = db.query(
    'SELECT * FROM shifts WHERE tenant_id = ? ORDER BY shift_number ASC',
    [tenantId]
  );

  // If shifts don't exist yet for some reason, ensure default 3 shifts
  if (shifts.length === 0) {
    const now = new Date().toISOString();
    const defaults = [
      { num: 1, name: 'Shift 1 (Morning)', start: '06:00', end: '12:00' },
      { num: 2, name: 'Shift 2 (Afternoon)', start: '12:00', end: '18:00' },
      { num: 3, name: 'Shift 3 (Evening)', start: '18:00', end: '23:30' },
    ];
    for (const d of defaults) {
      db.run(
        `INSERT INTO shifts (id, tenant_id, shift_number, name, start_time, end_time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), tenantId, d.num, d.name, d.start, d.end, now]
      );
    }
    return db.query('SELECT * FROM shifts WHERE tenant_id = ? ORDER BY shift_number ASC', [tenantId]);
  }

  return shifts;
}

/**
 * Update Shift times and names
 */
async function updateShift(tenantId, shiftId, data) {
  const { name, start_time, end_time } = data;
  const existing = db.queryOne('SELECT * FROM shifts WHERE id = ? AND tenant_id = ?', [shiftId, tenantId]);
  if (!existing) {
    const error = new Error('Shift not found.');
    error.statusCode = 404;
    throw error;
  }

  db.run(
    'UPDATE shifts SET name = ?, start_time = ?, end_time = ? WHERE id = ? AND tenant_id = ?',
    [name.trim(), start_time, end_time, shiftId, tenantId]
  );

  return { success: true };
}

/**
 * Get all seats on a floor with full 3-shift real-time booking statuses
 */
async function getFloorSeatsWithShiftStatus(tenantId, floorId, date = new Date().toISOString().split('T')[0]) {
  const shifts = await getShifts(tenantId);

  // Get all seats on floor
  const seats = db.query(
    `SELECT s.*, r.name as room_name, r.color as room_color
     FROM seats s
     LEFT JOIN rooms r ON s.room_id = r.id
     WHERE s.tenant_id = ? AND s.floor_id = ? AND s.is_active = 1
     ORDER BY s.seat_number ASC`,
    [tenantId, floorId]
  );

  // Get all active bookings for this date on this floor
  const activeBookings = db.query(
    `SELECT sb.*, st.name as student_name, st.admission_number, st.phone as student_phone
     FROM seat_bookings sb
     JOIN seats s ON sb.seat_id = s.id
     JOIN students st ON sb.student_id = st.id
     WHERE sb.tenant_id = ? AND s.floor_id = ? AND sb.status = 'active'
       AND sb.start_date <= ? AND sb.end_date >= ?`,
    [tenantId, floorId, date, date]
  );

  // Map each seat to include shift_1, shift_2, shift_3 statuses
  const result = seats.map((seat) => {
    const shiftSegments = shifts.map((shift) => {
      const booking = activeBookings.find(
        (b) => b.seat_id === seat.id && b.shift_id === shift.id
      );

      if (booking) {
        return {
          shiftNumber: shift.shift_number,
          shiftId: shift.id,
          shiftName: shift.name,
          startTime: shift.start_time,
          endTime: shift.end_time,
          isBooked: true,
          status: 'BOOKED',
          color: '#10b981', // GREEN
          bookingId: booking.id,
          studentId: booking.student_id,
          studentName: booking.student_name,
          admissionNumber: booking.admission_number,
          studentPhone: booking.student_phone,
          startDate: booking.start_date,
          endDate: booking.end_date,
        };
      } else {
        return {
          shiftNumber: shift.shift_number,
          shiftId: shift.id,
          shiftName: shift.name,
          startTime: shift.start_time,
          endTime: shift.end_time,
          isBooked: false,
          status: 'AVAILABLE',
          color: '#ef4444', // RED
          bookingId: null,
          studentId: null,
          studentName: null,
        };
      }
    });

    return {
      ...seat,
      shifts: shiftSegments,
    };
  });

  return {
    shifts,
    seats: result,
  };
}

/**
 * Allocate a seat to a student for a specific shift and date range
 * Strictly enforces CONFLICT PREVENTION
 */
async function allocateSeat(tenantId, payload, currentUserId) {
  const { seatId, shiftId, studentId, startDate, endDate, notes = '' } = payload;

  if (!seatId || !shiftId || !studentId || !startDate || !endDate) {
    const error = new Error('Seat ID, Shift ID, Student ID, Start Date, and End Date are required.');
    error.statusCode = 400;
    throw error;
  }

  if (new Date(startDate) > new Date(endDate)) {
    const error = new Error('Start date cannot be after end date.');
    error.statusCode = 400;
    throw error;
  }

  // Verify seat belongs to tenant
  const seat = db.queryOne('SELECT * FROM seats WHERE id = ? AND tenant_id = ?', [seatId, tenantId]);
  if (!seat) {
    const error = new Error('Seat not found in this library.');
    error.statusCode = 404;
    throw error;
  }

  // Verify shift belongs to tenant
  const shift = db.queryOne('SELECT * FROM shifts WHERE id = ? AND tenant_id = ?', [shiftId, tenantId]);
  if (!shift) {
    const error = new Error('Shift not found in this library.');
    error.statusCode = 404;
    throw error;
  }

  // Verify student belongs to tenant
  const student = db.queryOne('SELECT * FROM students WHERE id = ? AND tenant_id = ?', [studentId, tenantId]);
  if (!student) {
    const error = new Error('Student not found in this library.');
    error.statusCode = 404;
    throw error;
  }

  // Check for CONFLICT: any active booking for the SAME seat & shift that overlaps in date range
  const conflict = db.queryOne(
    `SELECT sb.*, st.name as student_name, st.admission_number
     FROM seat_bookings sb
     JOIN students st ON sb.student_id = st.id
     WHERE sb.tenant_id = ? AND sb.seat_id = ? AND sb.shift_id = ? AND sb.status = 'active'
       AND NOT (sb.end_date < ? OR sb.start_date > ?)`,
    [tenantId, seatId, shiftId, startDate, endDate]
  );

  if (conflict) {
    const error = new Error(
      `Booking Conflict: Seat ${seat.seat_number} for ${shift.name} is already booked by ${conflict.student_name} (${conflict.admission_number}) from ${conflict.start_date} to ${conflict.end_date}.`
    );
    error.statusCode = 409;
    throw error;
  }

  const bookingId = uuidv4();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.run(
      `INSERT INTO seat_bookings (id, tenant_id, seat_id, shift_id, student_id, start_date, end_date, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [bookingId, tenantId, seatId, shiftId, studentId, startDate, endDate, notes, now, now]
    );

    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'SEAT_ALLOCATED', 'seat_booking', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentUserId,
        bookingId,
        JSON.stringify({
          seatNumber: seat.seat_number,
          shiftName: shift.name,
          studentName: student.name,
          startDate,
          endDate,
        }),
        now,
      ]
    );
  });

  return { success: true, bookingId };
}

/**
 * Release an active seat booking
 */
async function releaseSeat(tenantId, bookingId, currentUserId) {
  const booking = db.queryOne(
    `SELECT sb.*, s.seat_number, sh.name as shift_name, st.name as student_name
     FROM seat_bookings sb
     JOIN seats s ON sb.seat_id = s.id
     JOIN shifts sh ON sb.shift_id = sh.id
     JOIN students st ON sb.student_id = st.id
     WHERE sb.id = ? AND sb.tenant_id = ?`,
    [bookingId, tenantId]
  );

  if (!booking) {
    const error = new Error('Seat booking not found.');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.run(
      "UPDATE seat_bookings SET status = 'cancelled', updated_at = ? WHERE id = ? AND tenant_id = ?",
      [now, bookingId, tenantId]
    );

    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'SEAT_RELEASED', 'seat_booking', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentUserId,
        bookingId,
        JSON.stringify({
          seatNumber: booking.seat_number,
          shiftName: booking.shift_name,
          studentName: booking.student_name,
        }),
        now,
      ]
    );
  });

  return { success: true };
}

/**
 * Transfer an active seat booking to a different seat or shift
 */
async function transferSeat(tenantId, bookingId, targetSeatId, targetShiftId, currentUserId) {
  const currentBooking = db.queryOne(
    'SELECT * FROM seat_bookings WHERE id = ? AND tenant_id = ? AND status = "active"',
    [bookingId, tenantId]
  );

  if (!currentBooking) {
    const error = new Error('Active booking not found.');
    error.statusCode = 404;
    throw error;
  }

  // Validate target seat & shift
  const targetSeat = db.queryOne('SELECT * FROM seats WHERE id = ? AND tenant_id = ?', [targetSeatId, tenantId]);
  if (!targetSeat) {
    const error = new Error('Target seat not found.');
    error.statusCode = 404;
    throw error;
  }

  const targetShift = db.queryOne('SELECT * FROM shifts WHERE id = ? AND tenant_id = ?', [targetShiftId, tenantId]);
  if (!targetShift) {
    const error = new Error('Target shift not found.');
    error.statusCode = 404;
    throw error;
  }

  // Check conflict on target seat & shift
  const conflict = db.queryOne(
    `SELECT sb.*, st.name as student_name
     FROM seat_bookings sb
     JOIN students st ON sb.student_id = st.id
     WHERE sb.tenant_id = ? AND sb.seat_id = ? AND sb.shift_id = ? AND sb.status = 'active' AND sb.id != ?
       AND NOT (sb.end_date < ? OR sb.start_date > ?)`,
    [tenantId, targetSeatId, targetShiftId, bookingId, currentBooking.start_date, currentBooking.end_date]
  );

  if (conflict) {
    const error = new Error(
      `Target Seat Conflict: Seat ${targetSeat.seat_number} (${targetShift.name}) is occupied by ${conflict.student_name}.`
    );
    error.statusCode = 409;
    throw error;
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.run(
      `UPDATE seat_bookings SET seat_id = ?, shift_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
      [targetSeatId, targetShiftId, now, bookingId, tenantId]
    );

    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'SEAT_TRANSFERRED', 'seat_booking', ?, ?, '127.0.0.1', ?)`,
      [
        uuidv4(),
        tenantId,
        currentUserId,
        bookingId,
        JSON.stringify({
          previousSeatId: currentBooking.seat_id,
          targetSeatNumber: targetSeat.seat_number,
          targetShiftName: targetShift.name,
        }),
        now,
      ]
    );
  });

  return { success: true };
}

module.exports = {
  getShifts,
  updateShift,
  getFloorSeatsWithShiftStatus,
  allocateSeat,
  releaseSeat,
  transferSeat,
};
