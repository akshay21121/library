const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

async function getFloors(tenantId) {
  return db.query(
    `SELECT f.*,
            (SELECT COUNT(*) FROM seats s WHERE s.floor_id = f.id AND s.is_active = 1) as total_seats,
            (SELECT COUNT(*) FROM rooms r WHERE r.floor_id = f.id) as total_rooms
     FROM floors f
     WHERE f.tenant_id = ?
     ORDER BY f.level_index ASC, f.created_at ASC`,
    [tenantId]
  );
}

async function createFloor(tenantId, data) {
  const { name, level_index = 0, width = 1200, height = 800, grid_size = 20 } = data;
  if (!name) {
    const error = new Error('Floor name is required.');
    error.statusCode = 400;
    throw error;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO floors (id, tenant_id, name, level_index, width, height, grid_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, name.trim(), level_index, width, height, grid_size, now]
  );

  return { id, name };
}

async function updateFloor(tenantId, floorId, data) {
  const { name, level_index, width, height, grid_size } = data;
  const existing = db.queryOne('SELECT * FROM floors WHERE id = ? AND tenant_id = ?', [floorId, tenantId]);
  if (!existing) {
    const error = new Error('Floor not found.');
    error.statusCode = 404;
    throw error;
  }

  db.run(
    `UPDATE floors SET
      name = COALESCE(?, name),
      level_index = COALESCE(?, level_index),
      width = COALESCE(?, width),
      height = COALESCE(?, height),
      grid_size = COALESCE(?, grid_size)
     WHERE id = ? AND tenant_id = ?`,
    [name ? name.trim() : null, level_index, width, height, grid_size, floorId, tenantId]
  );

  return { success: true };
}

async function deleteFloor(tenantId, floorId) {
  // Prevent removal if any seat on this floor has an active booking
  const activeBookings = db.queryOne(
    `SELECT COUNT(*) as count
     FROM seat_bookings sb
     JOIN seats s ON sb.seat_id = s.id
     WHERE s.floor_id = ? AND sb.tenant_id = ? AND sb.status = 'active'`,
    [floorId, tenantId]
  );

  if (activeBookings && activeBookings.count > 0) {
    const error = new Error(
      `Cannot delete floor: There are ${activeBookings.count} active seat bookings on this floor. Please resolve or transfer all bookings first.`
    );
    error.statusCode = 400;
    throw error;
  }

  db.transaction(() => {
    db.run('DELETE FROM seats WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
    db.run('DELETE FROM floor_elements WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
    db.run('DELETE FROM rooms WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
    db.run('DELETE FROM floors WHERE id = ? AND tenant_id = ?', [floorId, tenantId]);
  });

  return { success: true };
}

async function getFloorFullData(tenantId, floorId) {
  const floor = db.queryOne('SELECT * FROM floors WHERE id = ? AND tenant_id = ?', [floorId, tenantId]);
  if (!floor) {
    const error = new Error('Floor not found.');
    error.statusCode = 404;
    throw error;
  }

  const rooms = db.query('SELECT * FROM rooms WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
  const elements = db.query('SELECT * FROM floor_elements WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
  const seats = db.query(
    `SELECT s.*, r.name as room_name,
            (SELECT COUNT(*) FROM seat_bookings sb WHERE sb.seat_id = s.id AND sb.status = 'active') as active_bookings_count
     FROM seats s
     LEFT JOIN rooms r ON s.room_id = r.id
     WHERE s.floor_id = ? AND s.tenant_id = ?
     ORDER BY s.seat_number ASC`,
    [floorId, tenantId]
  );

  return {
    floor,
    rooms,
    elements,
    seats,
  };
}

/**
 * Save Full Floor Layout (seats, elements, rooms)
 * Validates that deleted seats do not have active bookings!
 */
async function saveFloorLayout(tenantId, floorId, payload, currentUserId) {
  const { seats = [], elements = [], rooms = [] } = payload;

  const floor = db.queryOne('SELECT * FROM floors WHERE id = ? AND tenant_id = ?', [floorId, tenantId]);
  if (!floor) {
    const error = new Error('Floor not found.');
    error.statusCode = 404;
    throw error;
  }

  // Check if any existing seat being deleted has an active booking
  const existingSeats = db.query('SELECT id, seat_number FROM seats WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
  const incomingSeatIds = new Set(seats.map(s => s.id).filter(Boolean));

  for (const es of existingSeats) {
    if (!incomingSeatIds.has(es.id)) {
      const activeBooking = db.queryOne(
        `SELECT sb.*, st.name as student_name
         FROM seat_bookings sb
         JOIN students st ON sb.student_id = st.id
         WHERE sb.seat_id = ? AND sb.status = 'active'`,
        [es.id]
      );
      if (activeBooking) {
        const error = new Error(
          `Cannot remove Seat ${es.seat_number}: It currently has an active booking by ${activeBooking.student_name}. Cancel or transfer the booking first.`
        );
        error.statusCode = 400;
        throw error;
      }
    }
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    // 1. Save Rooms
    db.run('DELETE FROM rooms WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
    for (const r of rooms) {
      const roomId = r.id || uuidv4();
      db.run(
        `INSERT INTO rooms (id, tenant_id, floor_id, name, color, x, y, width, height, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [roomId, tenantId, floorId, r.name || 'Room', r.color || '#3b82f6', r.x || 0, r.y || 0, r.width || 200, r.height || 150, now]
      );
    }

    // 2. Save Elements (walls, partitions, tables, doors)
    db.run('DELETE FROM floor_elements WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
    for (const el of elements) {
      const elId = el.id || uuidv4();
      db.run(
        `INSERT INTO floor_elements (id, tenant_id, floor_id, element_type, x, y, width, height, rotation, label, color, properties, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          elId,
          tenantId,
          floorId,
          el.element_type || 'wall',
          el.x || 0,
          el.y || 0,
          el.width || 100,
          el.height || 20,
          el.rotation || 0,
          el.label || '',
          el.color || '#64748b',
          typeof el.properties === 'string' ? el.properties : JSON.stringify(el.properties || {}),
          now,
        ]
      );
    }

    // 3. Save / Upsert Seats
    // Remove seats that are no longer in incoming list (we already verified no active bookings)
    const incomingIdsList = Array.from(incomingSeatIds);
    if (incomingIdsList.length > 0) {
      const placeholders = incomingIdsList.map(() => '?').join(',');
      db.run(
        `DELETE FROM seats WHERE floor_id = ? AND tenant_id = ? AND id NOT IN (${placeholders})`,
        [floorId, tenantId, ...incomingIdsList]
      );
    } else {
      db.run('DELETE FROM seats WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
    }

    // Upsert or insert each seat
    for (const s of seats) {
      const seatId = s.id || uuidv4();
      const existing = db.queryOne('SELECT id FROM seats WHERE id = ?', [seatId]);
      if (existing) {
        db.run(
          `UPDATE seats SET
            seat_number = ?, x = ?, y = ?, width = ?, height = ?, rotation = ?, seat_type = ?, room_id = ?
           WHERE id = ? AND tenant_id = ?`,
          [
            s.seat_number,
            s.x,
            s.y,
            s.width || 64,
            s.height || 64,
            s.rotation || 0,
            s.seat_type || 'standard',
            s.room_id || null,
            seatId,
            tenantId,
          ]
        );
      } else {
        db.run(
          `INSERT INTO seats (id, tenant_id, floor_id, room_id, seat_number, x, y, width, height, rotation, seat_type, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            seatId,
            tenantId,
            floorId,
            s.room_id || null,
            s.seat_number,
            s.x,
            s.y,
            s.width || 64,
            s.height || 64,
            s.rotation || 0,
            s.seat_type || 'standard',
            now,
          ]
        );
      }
    }

    // Audit log
    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, 'library_owner', 'FLOOR_PLAN_SAVED', 'floor', ?, ?, '127.0.0.1', ?)`,
      [uuidv4(), tenantId, currentUserId, floorId, JSON.stringify({ seatCount: seats.length }), now]
    );
  });

  return { success: true };
}

/**
 * Quick Setup Wizard: Generate structured grid layout
 */
async function generateQuickLayout(tenantId, floorId, options, currentUserId) {
  const { totalSeats = 20, prefix = 'S', seatsPerRow = 5, spacingX = 110, spacingY = 110, startX = 60, startY = 80 } = options;

  const floor = db.queryOne('SELECT * FROM floors WHERE id = ? AND tenant_id = ?', [floorId, tenantId]);
  if (!floor) {
    const error = new Error('Floor not found.');
    error.statusCode = 404;
    throw error;
  }

  // Check if any existing seat has active bookings
  const existingWithBookings = db.queryOne(
    `SELECT COUNT(*) as count FROM seat_bookings sb
     JOIN seats s ON sb.seat_id = s.id
     WHERE s.floor_id = ? AND sb.tenant_id = ? AND sb.status = 'active'`,
    [floorId, tenantId]
  );

  if (existingWithBookings && existingWithBookings.count > 0) {
    const error = new Error(
      `Cannot run Quick Setup: Current layout has ${existingWithBookings.count} active bookings. Please clear or reassign them before regenerating.`
    );
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();

  return db.transaction(() => {
    // Clear old elements and seats
    db.run('DELETE FROM seats WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);
    db.run('DELETE FROM floor_elements WHERE floor_id = ? AND tenant_id = ?', [floorId, tenantId]);

    // Add entrance & reception
    db.run(
      `INSERT INTO floor_elements (id, tenant_id, floor_id, element_type, x, y, width, height, rotation, label, color, properties, created_at)
       VALUES (?, ?, ?, 'entrance', 400, 560, 100, 24, 0, 'Main Door', '#10b981', '{}', ?)`,
      [uuidv4(), tenantId, floorId, now]
    );

    const generatedSeats = [];
    for (let i = 0; i < totalSeats; i++) {
      const row = Math.floor(i / seatsPerRow);
      const col = i % seatsPerRow;
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;
      const seatNumber = `${prefix}-${String(i + 1).padStart(2, '0')}`;
      const seatId = uuidv4();

      db.run(
        `INSERT INTO seats (id, tenant_id, floor_id, seat_number, x, y, width, height, rotation, seat_type, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 76, 76, 0, 'standard', 1, ?)`,
        [seatId, tenantId, floorId, seatNumber, x, y, now]
      );
      generatedSeats.push({ id: seatId, seatNumber, x, y });
    }

    return { success: true, count: generatedSeats.length };
  });
}

module.exports = {
  getFloors,
  createFloor,
  updateFloor,
  deleteFloor,
  getFloorFullData,
  saveFloorLayout,
  generateQuickLayout,
};
