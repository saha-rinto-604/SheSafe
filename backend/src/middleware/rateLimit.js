const buckets = new Map();

function getClientKey(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs, max, keyPrefix = 'global' }) {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientKey(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
      return;
    }

    current.count += 1;
    next();
  };
}

module.exports = { createRateLimiter };
