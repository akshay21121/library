const express = require('express');
const router = express.Router();
const floorService = require('../services/floorService');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

router.use(authenticate, enforceTenantIsolation);

router.get('/', async (req, res, next) => {
  try {
    const floors = await floorService.getFloors(req.tenantId);
    res.json(floors);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const result = await floorService.createFloor(req.tenantId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const result = await floorService.updateFloor(req.tenantId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await floorService.deleteFloor(req.tenantId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/full', async (req, res, next) => {
  try {
    const data = await floorService.getFloorFullData(req.tenantId, req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/layout', async (req, res, next) => {
  try {
    const result = await floorService.saveFloorLayout(req.tenantId, req.params.id, req.body, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/quick-layout', async (req, res, next) => {
  try {
    const result = await floorService.generateQuickLayout(req.tenantId, req.params.id, req.body, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
