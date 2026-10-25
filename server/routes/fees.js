const express = require('express');
const router = express.Router();
const feeService = require('../services/feeService');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

router.use(authenticate, enforceTenantIsolation);

router.get('/plans', async (req, res, next) => {
  try {
    const plans = await feeService.getFeePlans(req.tenantId);
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

router.post('/plans', async (req, res, next) => {
  try {
    const result = await feeService.createFeePlan(req.tenantId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/plans/:id', async (req, res, next) => {
  try {
    const result = await feeService.updateFeePlan(req.tenantId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/invoices', async (req, res, next) => {
  try {
    const result = await feeService.getInvoices(req.tenantId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/invoices', async (req, res, next) => {
  try {
    const result = await feeService.createInvoice(req.tenantId, req.body, req.user.userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/payments', async (req, res, next) => {
  try {
    const result = await feeService.recordPayment(req.tenantId, req.body, req.user.userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/payments/:id/reverse', async (req, res, next) => {
  try {
    const result = await feeService.reversePayment(req.tenantId, req.params.id, req.body, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/receipts/:paymentId', async (req, res, next) => {
  try {
    const receipt = await feeService.getReceiptData(req.tenantId, req.params.paymentId);
    res.json(receipt);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
