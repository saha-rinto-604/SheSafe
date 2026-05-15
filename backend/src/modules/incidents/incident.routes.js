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

// GET /api/incidents/my — get current user's incidents
router.get('/my', controller.getMyIncidents);

// GET /api/incidents/:id — get a single incident by id
router.get('/:id', controller.getOne);

// PATCH /api/incidents/:id/cancel — victim cancels their own incident
router.patch('/:id/cancel', controller.cancel);

// PATCH /api/incidents/:id/resolve — victim marks incident resolved
router.patch('/:id/resolve', controller.resolve);

// DELETE /api/incidents/my — cancel all active incidents by current user (clear history)
router.delete('/my', controller.clearMyHistory);

module.exports = router;
