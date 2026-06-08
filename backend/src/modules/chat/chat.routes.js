const express = require('express');
const { authenticate } = require('../auth/auth.middleware');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const upload = require('../../middleware/upload');
const controller = require('./chat.controller');

const router = express.Router();

router.use(authenticate);

router.get('/active', controller.getActiveIncidents);
router.get('/assisted', controller.getAssistedChats);

router.get('/:incidentId/messages', controller.getMessages);
router.patch('/:incidentId/archive-for-me', requireActiveAccount, controller.archiveForMe);
router.patch('/:incidentId/delete-for-me', requireActiveAccount, controller.deleteForMe);
router.patch('/:incidentId/leave', requireActiveAccount, controller.leave);
router.post('/:incidentId/messages', requireActiveAccount, controller.sendMessage);
router.post('/:incidentId/image', requireActiveAccount, upload.single('image'), controller.sendImage);
router.post('/:incidentId/join', requireActiveAccount, controller.joinIncident);

module.exports = router;
