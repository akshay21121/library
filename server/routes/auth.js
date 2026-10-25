const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const me = await authService.getMe(req.user.userId);
    res.json(me);
  } catch (err) {
    next(err);
  }
});

router.get('/validate-activation-token', async (req, res, next) => {
  try {
    const { token } = req.query;
    const result = await authService.validateActivationToken(token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/activate-account', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const result = await authService.activateAccount(token, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
