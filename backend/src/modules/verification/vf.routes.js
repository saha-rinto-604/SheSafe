/**
 * vf.routes.js — Volunteer Verification API Routes
 */

const router = require('express').Router();
const { authenticate } = require('../../middleware/authenticate');
const upload = require('../../middleware/upload');
const vfController = require('./vf.controller');

router.use(authenticate);

function logUploadStart(req, res, next) {
  console.log('[verification upload] endpoint hit', {
    type: req.params.type,
    userId: req.user?.id,
  });
  next();
}

function receiveVerificationDocument(req, res, next) {
  upload.single('document')(req, res, (error) => {
    if (!error) return next();

    console.warn('[verification upload] file rejected', {
      type: req.params.type,
      userId: req.user?.id,
      code: error.code || 'INVALID_FILE',
    });

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File is too large. Maximum size is 5 MB.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'No file received. Please select a valid image and try again.' });
    }
    return res.status(400).json({ message: error.message || 'Please select a valid image and try again.' });
  });
}

/** GET  /api/verification         — Get current verification status */
router.get('/', vfController.getStatus);

/** POST /api/verification/apply   — Start a new verification application */
router.post('/apply', vfController.apply);

/** POST /api/verification/upload/:type — Upload a document (idCard|selfie|certificate) */
router.post('/upload/:type', logUploadStart, receiveVerificationDocument, vfController.uploadDocument);

/** POST /api/verification/submit  — Submit draft for review */
router.post('/submit', vfController.submit);

/** POST /api/verification/reapply — Reapply after rejection */
router.post('/reapply', vfController.reapply);

/** POST /api/verification/edit — Revert pending → draft to re-upload documents */
router.post('/edit', vfController.edit);

module.exports = router;
