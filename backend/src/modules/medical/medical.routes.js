const express = require('express');
const controller = require('./medical.controller');

const router = express.Router();

// Public: medical provider directory is not sensitive data
router.get('/providers', controller.getProviders);

module.exports = router;
