const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const controller = require('./admin.controller');
const { requireAdmin, adminReadLimiter, adminWriteLimiter } = require('./admin.middleware');

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/overview', adminReadLimiter, controller.overview);

router.get('/incidents', adminReadLimiter, controller.incidents);
router.get('/incidents/:id', adminReadLimiter, controller.incident);

router.get('/users', adminReadLimiter, controller.users);
router.get('/users/:id', adminReadLimiter, controller.user);
router.patch('/users/:id/warn', adminWriteLimiter, controller.warnUser);
router.patch('/users/:id/block', adminWriteLimiter, controller.blockUser);
router.patch('/users/:id/unblock', adminWriteLimiter, controller.unblockUser);

router.get('/verifications', adminReadLimiter, controller.verifications);
router.get('/verifications/:id', adminReadLimiter, controller.verification);
router.patch('/verifications/:id/approve', adminWriteLimiter, controller.approveVerification);
router.patch('/verifications/:id/reject', adminWriteLimiter, controller.rejectVerification);

router.get('/police/verifications', adminReadLimiter, controller.policeVerifications);
router.patch('/police/verifications/:userId/approve', adminWriteLimiter, controller.approvePoliceVerification);
router.patch('/police/verifications/:userId/reject', adminWriteLimiter, controller.rejectPoliceVerification);
router.get('/police/approved', adminReadLimiter, controller.approvedPolice);

router.get('/law-enforcement/requests', adminReadLimiter, controller.lawEnforcementRequests);
router.get('/law-enforcement/requests/:requestId', adminReadLimiter, controller.lawEnforcementRequest);
router.post('/law-enforcement/requests/:requestId/assign', adminWriteLimiter, controller.assignLawEnforcementRequest);
router.post('/law-enforcement/requests/:requestId/cancel', adminWriteLimiter, controller.cancelLawEnforcementRequest);

router.get('/safe-places', adminReadLimiter, controller.safePlaces);
router.get('/safe-places/:id', adminReadLimiter, controller.safePlace);
router.patch('/safe-places/:id/approve', adminWriteLimiter, controller.approveSafePlace);
router.patch('/safe-places/:id/reject', adminWriteLimiter, controller.rejectSafePlace);

router.get('/reports', adminReadLimiter, controller.reports);
router.get('/reports/:id', adminReadLimiter, controller.report);
router.patch('/reports/:id/dismiss', adminWriteLimiter, controller.dismissReport);
router.patch('/reports/:id/warn', adminWriteLimiter, controller.warnFromReport);
router.patch('/reports/:id/block', adminWriteLimiter, controller.blockFromReport);

router.get('/notifications', adminReadLimiter, controller.notifications);
router.get('/audit-logs', adminReadLimiter, controller.auditLogs);

module.exports = router;
