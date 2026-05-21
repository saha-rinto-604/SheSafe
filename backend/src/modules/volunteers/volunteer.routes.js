const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const incidentController = require('../incidents/incident.controller');

const router = express.Router();

router.use(authenticate);

// GET /api/volunteer/incidents/assisted
router.get('/incidents/assisted', incidentController.assisted);
router.get('/notifications', incidentController.volunteerNotifications);

module.exports = router;
