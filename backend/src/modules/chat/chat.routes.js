const express = require('express');
const { authenticate } = require('../auth/auth.middleware');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const upload = require('../../middleware/upload');
const controller = require('./chat.controller');

const router = express.Router();

router.use(authenticate);

function receiveChatImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();

    const isTooLarge = error.code === 'LIMIT_FILE_SIZE';
    const isWrongField = error.code === 'LIMIT_UNEXPECTED_FILE';
    error.status = isTooLarge ? 413 : 400;
    error.message = isTooLarge
      ? 'Image must be 5MB or smaller.'
      : isWrongField
        ? 'Image file field must be named "image".'
        : (error.message || 'Invalid image file.');

    console.warn('[chat image upload] file rejected', {
      incidentId: req.params.incidentId,
      userId: req.user?.id,
      code: error.code || 'INVALID_IMAGE',
      message: error.message,
    });
    next(error);
  });
}

function handleChatImageError(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  const message = status >= 500
    ? 'Chat image upload failed. Please try again.'
    : (error.message || 'Chat image upload failed.');

  console.warn('[chat image upload] request failed', {
    incidentId: req.params.incidentId,
    userId: req.user?.id,
    status,
    code: error.code || 'UPLOAD_FAILED',
  });
  res.status(status).json({ message });
}

router.get('/active', controller.getActiveIncidents);
router.get('/assisted', controller.getAssistedChats);

router.get('/:incidentId/messages', controller.getMessages);
router.patch('/:incidentId/archive-for-me', requireActiveAccount, controller.archiveForMe);
router.patch('/:incidentId/delete-for-me', requireActiveAccount, controller.deleteForMe);
router.patch('/:incidentId/leave', requireActiveAccount, controller.leave);
router.post('/:incidentId/messages', requireActiveAccount, controller.sendMessage);
router.post('/:incidentId/image', requireActiveAccount, receiveChatImage, controller.sendImage, handleChatImageError);
router.post('/:incidentId/join', requireActiveAccount, controller.joinIncident);

module.exports = router;
