const express = require('express');
const { authenticate } = require('../auth/auth.middleware');
const controller = require('./safe-places.controller');

const router = express.Router();

router.use(authenticate);

// GET /api/safe-places — list confirmed safe-place zones
router.get('/', controller.getZones);

// POST /api/safe-places — submit a new safe place (status starts as PENDING)
router.post('/', controller.report);

// DELETE /api/safe-places/my — delete all safe place reports submitted by current user
router.delete('/my', controller.deleteMyData);

module.exports = router;
