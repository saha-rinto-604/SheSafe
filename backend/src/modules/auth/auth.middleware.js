const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../../config/env');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, jwtConfig.secret);
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      phoneNumber: payload.phoneNumber,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = { authenticate };
