const express = require('express');
const router = express.Router();
const seatService = require('../services/seatService');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

router.use(authenticate, enforceTenantIsolation);

router.get('/shifts', async (req, res, next) => {
  try {
    const shifts = await seatService.getShifts(req.tenantId);
    res.json(shifts);
  } catch (err) {
    next(err);
  }
});

router.put('/shifts/:id', async (req, res, next) => {
  try {
    const result = await seatService.updateShift(req.tenantId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/floor/:floorId', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const data = await seatService.getFloorSeatsWithShiftStatus(req.tenantId, req.params.floorId, date);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/allocate', async (req, res, next) => {
  try {
    const result = await seatService.allocateSeat(req.tenantId, req.body, req.user.userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/release', async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required.' });
    }
    const result = await seatService.releaseSeat(req.tenantId, bookingId, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/transfer', async (req, res, next) => {
  try {
    const { bookingId, targetSeatId, targetShiftId } = req.body;
    if (!bookingId || !targetSeatId || !targetShiftId) {
      return res.status(400).json({ error: 'bookingId, targetSeatId, and targetShiftId are required.' });
    }
    const result = await seatService.transferSeat(req.tenantId, bookingId, targetSeatId, targetShiftId, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
