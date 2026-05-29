const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const controller = require('./law.controller');

const router = express.Router();

function requirePolice(req, res, next) {
  if (String(req.user?.role || '').toLowerCase() !== 'law_enforcement') {
    res.status(403).json({ message: 'Police access required.' });
    return;
  }
  next();
}

router.use(authenticate);
router.use(requireActiveAccount);
router.use(requirePolice);

router.get('/tasks', controller.policeTasks);
router.post('/tasks/:requestId/accept', controller.acceptTask);
router.post('/tasks/:requestId/reject', controller.rejectTask);
router.post('/tasks/:requestId/resolve', controller.resolveTask);

module.exports = router;
