const express = require('express');
const controller = require('./auth.controller');

const router = express.Router();

router.get('/roles', controller.getRoles);
router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

module.exports = router;
