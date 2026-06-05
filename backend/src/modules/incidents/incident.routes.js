const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const controller = require('./incident.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', requireActiveAccount, controller.report);
router.get('/zones', controller.getZones);
router.get('/my-active-sos', controller.getMyActiveSos);
router.get('/my', controller.getMyIncidents);
router.get('/nearby', controller.nearby);
router.get('/assisted', controller.assisted);
router.patch('/online-status', controller.onlineStatus);
router.delete('/my', controller.clearMyHistory);

router.get('/:id/responders', controller.responders);
router.get('/:id/messages', controller.messages);
router.post('/:id/messages', requireActiveAccount, controller.sendMessage);
router.get('/:id/user-case-details', controller.getUserCaseDetails);
router.put('/:id/user-case-details', requireActiveAccount, controller.updateUserCaseDetails);
router.get('/:id/volunteer-case-details', controller.getVolunteerCaseDetails);
router.put('/:id/volunteer-case-details', requireActiveAccount, controller.updateVolunteerCaseDetails);
router.get('/:id/route-context', controller.routeContext);
router.get('/:id/map-snapshot', controller.mapSnapshot);
router.post('/:id/reviews', requireActiveAccount, controller.createReview);

router.get('/:id', controller.getOne);
router.patch('/:id/cancel', controller.cancel);
router.patch('/:id/resolve', requireActiveAccount, controller.resolve);
router.post('/:id/accept', requireActiveAccount, controller.accept);
router.post('/:id/reject', controller.reject);

module.exports = router;
