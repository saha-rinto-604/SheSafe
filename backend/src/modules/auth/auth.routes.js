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
const signupLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyPrefix: 'auth-signup',
});
const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: 'auth-password-reset',
});

// Public routes
router.get('/roles', controller.getRoles);
router.post('/signup', signupLimiter, controller.signup);
router.post('/signup/request-otp', signupLimiter, controller.requestSignupOtp);
router.post('/signup/verify-otp', signupLimiter, controller.verifySignupOtp);
router.post('/login', loginLimiter, controller.login);
router.post('/admin-login', loginLimiter, controller.adminLogin);
router.post('/forgot-password', passwordResetLimiter, controller.forgotPassword);
router.post('/reset-password', passwordResetLimiter, controller.resetPassword);

// Protected route — requires valid JWT
router.post('/change-password', authenticate, controller.changePassword);

module.exports = router;
