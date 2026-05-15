const express = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/authenticate');

const router = express.Router();

// Public routes
router.get('/roles', controller.getRoles);
router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

// Protected route — requires valid JWT
router.post('/change-password', authenticate, controller.changePassword);

module.exports = router;
