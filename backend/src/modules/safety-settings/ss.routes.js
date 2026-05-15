/**
 * ss.routes.js — Safety Settings API Routes
 */

const router = require('express').Router();
const { authenticate } = require('../../middleware/authenticate');
const ssController = require('./ss.controller');

router.use(authenticate);

/** GET /api/safety-settings — Get user's safety settings */
router.get('/', ssController.get);

/** PUT /api/safety-settings — Save (upsert) safety settings */
router.put('/', ssController.save);

module.exports = router;
