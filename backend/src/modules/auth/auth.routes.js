const express = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/authenticate');
const { createRateLimiter } = require('../../middleware/rateLimit');

const router = express.Router();
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: 'auth-login',
});

// Public routes
router.get('/roles', controller.getRoles);
router.post('/signup', controller.signup);
router.post('/login', loginLimiter, controller.login);
router.post('/admin-login', loginLimiter, controller.adminLogin);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

// Protected route — requires valid JWT
router.post('/change-password', authenticate, controller.changePassword);

module.exports = router;
