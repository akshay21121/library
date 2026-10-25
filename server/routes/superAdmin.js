const express = require('express');
const router = express.Router();
const superAdminService = require('../services/superAdminService');
const { authenticate, requireSupremeAdmin } = require('../middleware/auth');

// All routes in this router require Supreme Admin privileges
router.use(authenticate, requireSupremeAdmin);

router.get('/libraries', async (req, res, next) => {
  try {
    const libraries = await superAdminService.getAllLibraries(req.query);
    res.json(libraries);
  } catch (err) {
    next(err);
  }
});

router.patch('/libraries/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Valid status ("active" or "suspended") is required.' });
    }
    const result = await superAdminService.updateLibraryStatus(req.params.id, status, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const analytics = await superAdminService.getPlatformAnalytics();
    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const logs = await superAdminService.getPlatformAuditLogs(req.query);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
