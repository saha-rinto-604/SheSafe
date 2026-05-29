const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const controller = require('./law.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireActiveAccount);

router.post('/request', controller.createRequest);
router.get('/incident/:incidentId/status', controller.incidentStatus);

module.exports = router;
