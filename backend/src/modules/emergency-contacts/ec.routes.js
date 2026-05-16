/**
 * ec.routes.js — Emergency Contacts API Routes
 */

const router = require('express').Router();
const { authenticate } = require('../../middleware/authenticate');
const ecController = require('./ec.controller');

router.use(authenticate);

/** GET  /api/emergency-contacts       — List all contacts */
router.get('/', ecController.list);

/** POST /api/emergency-contacts       — Add a new contact */
router.post('/', ecController.create);

/** PUT  /api/emergency-contacts/:id   — Update a contact */
router.put('/:id', ecController.update);

/** DELETE /api/emergency-contacts/:id — Delete a contact */
router.delete('/:id', ecController.remove);

module.exports = router;
