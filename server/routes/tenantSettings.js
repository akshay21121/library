const express = require('express');
const router = express.Router();
const tenantSettingsService = require('../services/tenantSettingsService');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

router.use(authenticate, enforceTenantIsolation);

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await tenantSettingsService.getTenantSettings(req.tenantId);
    res.json({ ...settings, isReadOnly: req.isReadOnly });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const result = await tenantSettingsService.updateTenantSettings(req.tenantId, req.body, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
