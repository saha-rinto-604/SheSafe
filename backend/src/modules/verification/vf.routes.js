/**
 * vf.routes.js — Volunteer Verification API Routes
 */

const router = require('express').Router();
const { authenticate } = require('../../middleware/authenticate');
const upload = require('../../middleware/upload');
const vfController = require('./vf.controller');

router.use(authenticate);

/** GET  /api/verification         — Get current verification status */
router.get('/', vfController.getStatus);

/** POST /api/verification/apply   — Start a new verification application */
router.post('/apply', vfController.apply);

/** POST /api/verification/upload/:type — Upload a document (idCard|selfie|certificate) */
router.post('/upload/:type', upload.single('document'), vfController.uploadDocument);

/** POST /api/verification/submit  — Submit draft for review */
router.post('/submit', vfController.submit);

/** POST /api/verification/reapply — Reapply after rejection */
router.post('/reapply', vfController.reapply);

/** POST /api/verification/edit — Revert pending → draft to re-upload documents */
router.post('/edit', vfController.edit);

module.exports = router;
