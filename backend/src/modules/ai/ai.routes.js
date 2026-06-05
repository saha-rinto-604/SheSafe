const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const controller = require('./ai.controller');

const router = express.Router();

router.use(authenticate);
router.use(requireActiveAccount);

router.post('/area-brief', controller.generateAreaBrief);
router.post('/area-brief/follow-up', controller.answerAreaBriefFollowUp);
router.post('/route-risk-brief', controller.generateRouteRiskBrief);
router.post('/route-risk-brief/follow-up', controller.answerRouteRiskBriefFollowUp);
router.post('/first-aid-guide', controller.generateFirstAidGuide);
router.post('/first-aid-guide/follow-up', controller.answerFirstAidFollowUp);
router.post('/incidents/search-summary', controller.searchIncidentSummary);
router.post('/incidents/:incidentId/volunteer-guidance/follow-up', controller.answerVolunteerGuidanceFollowUp);
router.post('/incidents/:incidentId/volunteer-guidance', controller.generateVolunteerGuidance);
router.post('/incidents/:incidentId/follow-up', controller.answerIncidentFollowUp);
router.post('/incidents/:incidentId/summary', controller.generateIncidentSummary);

module.exports = router;
