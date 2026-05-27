const { createRateLimiter } = require('../../middleware/rateLimit');

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function requireAdmin(req, res, next) {
  if (!req.user || normalizeRole(req.user.role) !== 'admin') {
    res.status(403).json({ message: 'Admin access required.' });
    return;
  }
  next();
}

const adminReadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyPrefix: 'admin-read',
});

const adminWriteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: 'admin-write',
});

module.exports = {
  requireAdmin,
  adminReadLimiter,
  adminWriteLimiter,
};
