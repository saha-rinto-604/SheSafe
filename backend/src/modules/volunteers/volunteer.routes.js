const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { requireApprovedVolunteer } = require('../../middleware/approvedVolunteer');
const incidentController = require('../incidents/incident.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireApprovedVolunteer);

// GET /api/volunteer/incidents/assisted
router.get('/incidents/assisted', incidentController.assisted);
router.get('/notifications', incidentController.volunteerNotifications);
router.get('/activity', incidentController.volunteerActivity);
router.get('/leaderboard', incidentController.volunteerLeaderboard);
router.get('/certificate-data', incidentController.volunteerCertificateData);

module.exports = router;
