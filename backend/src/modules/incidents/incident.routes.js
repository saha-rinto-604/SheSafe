const express = require('express');
const fs = require('fs/promises');
const { authenticate } = require('../../middleware/authenticate');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const { requireApprovedVolunteer } = require('../../middleware/approvedVolunteer');
const upload = require('../../middleware/upload');
const controller = require('./incident.controller');
const liveVideoController = require('./liveVideo.controller');

const router = express.Router();

router.use(authenticate);

function handleLiveVideoUpload(req, res, next) {
  upload.video.single('video')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (req.file?.path) fs.unlink(req.file.path).catch(() => undefined);
    if (error.code === 'LIMIT_FILE_SIZE') {
      error.status = 413;
      error.message = 'Video is too large. Please try again with a shorter recording.';
    } else {
      error.status = 400;
      error.message = error.message || 'Invalid video file.';
    }
    next(error);
  });
}

router.post('/', requireActiveAccount, controller.report);
router.get('/zones', controller.getZones);
router.get('/my-active-sos', controller.getMyActiveSos);
router.get('/my', controller.getMyIncidents);
router.get('/nearby', requireApprovedVolunteer, controller.nearby);
router.get('/assisted', requireApprovedVolunteer, controller.assisted);
router.patch('/online-status', requireApprovedVolunteer, controller.onlineStatus);
router.delete('/my', controller.clearMyHistory);

router.get('/:id/responders', controller.responders);
router.get('/:id/messages', controller.messages);
router.post('/:id/messages', requireActiveAccount, controller.sendMessage);
router.post('/:incidentId/live-video/request', requireActiveAccount, liveVideoController.request);
router.get('/:incidentId/live-video/pending', liveVideoController.pending);
router.get('/:incidentId/live-stream/state', liveVideoController.state);
router.get('/:incidentId/live-stream/ice-config', liveVideoController.iceConfig);
router.post('/:incidentId/live-video/respond', requireActiveAccount, liveVideoController.respond);
router.post('/:incidentId/live-video/upload', requireActiveAccount, handleLiveVideoUpload, liveVideoController.upload);
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
router.post('/:id/accept', requireActiveAccount, requireApprovedVolunteer, controller.accept);
router.post('/:id/reject', requireApprovedVolunteer, controller.reject);

module.exports = router;
