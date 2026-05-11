const express = require('express');
const { authenticate } = require('../auth/auth.middleware');
const controller = require('./medical.controller');

const router = express.Router();

router.use(authenticate);

router.get('/providers', controller.getProviders);

module.exports = router;
