const router = require('express').Router();
const { authenticate } = require('../../middleware/authenticate');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const controller = require('./notification.controller');

router.use(authenticate);

router.get('/', controller.list);
router.get('/missed', controller.missed);
router.post('/push-token', requireActiveAccount, controller.registerPushToken);
router.patch('/push-token/deactivate', controller.deactivatePushToken);
router.patch('/shown', controller.markShown);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', controller.markRead);

module.exports = router;
