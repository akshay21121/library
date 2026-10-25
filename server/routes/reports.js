const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

router.use(authenticate, enforceTenantIsolation);

router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await reportService.getDashboardStats(req.tenantId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/collections', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await reportService.getCollectionReport(req.tenantId, startDate, endDate);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.get('/defaulters', async (req, res, next) => {
  try {
    const defaulters = await reportService.getDefaultersReport(req.tenantId);
    res.json(defaulters);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
