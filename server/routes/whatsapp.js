const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

router.use(authenticate, enforceTenantIsolation);

router.get('/templates', async (req, res, next) => {
  try {
    const templates = await whatsappService.getTemplates(req.tenantId);
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

router.put('/templates/:key', async (req, res, next) => {
  try {
    const { bodyText } = req.body;
    if (!bodyText) {
      return res.status(400).json({ error: 'bodyText is required.' });
    }
    const result = await whatsappService.updateTemplate(req.tenantId, req.params.key, bodyText);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/remind-manual', async (req, res, next) => {
  try {
    const result = await whatsappService.sendManualReminders(req.tenantId, req.body, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/run-auto', async (req, res, next) => {
  try {
    const result = await whatsappService.processAutomaticReminders(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const result = await whatsappService.getNotificationLogs(req.tenantId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/smtp-status', async (req, res, next) => {
  try {
    const status = await whatsappService.verifySmtp();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
