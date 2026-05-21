const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const controller = require('./incident.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', controller.report);
router.get('/zones', controller.getZones);
router.get('/my', controller.getMyIncidents);
router.get('/nearby', controller.nearby);
router.get('/assisted', controller.assisted);
router.patch('/online-status', controller.onlineStatus);
router.delete('/my', controller.clearMyHistory);

router.get('/:id/responders', controller.responders);
router.get('/:id/messages', controller.messages);
router.post('/:id/messages', controller.sendMessage);
router.get('/:id/user-case-details', controller.getUserCaseDetails);
router.put('/:id/user-case-details', controller.updateUserCaseDetails);
router.get('/:id/volunteer-case-details', controller.getVolunteerCaseDetails);
router.put('/:id/volunteer-case-details', controller.updateVolunteerCaseDetails);

router.get('/:id', controller.getOne);
router.patch('/:id/cancel', controller.cancel);
router.patch('/:id/resolve', controller.resolve);
router.post('/:id/accept', controller.accept);
router.post('/:id/reject', controller.reject);

module.exports = router;
