const express = require('express');
const { authenticate } = require('../auth/auth.middleware');
const controller = require('./incident.controller');

const router = express.Router();

// All incident routes require authentication
router.use(authenticate);

// POST /api/incidents — report a new incident (SOS trigger)
router.post('/', controller.report);

// GET /api/incidents/zones — get aggregated incident zones
router.get('/zones', controller.getZones);

module.exports = router;
