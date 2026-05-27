const { query } = require('../config/db');

let hasAccountStatusColumn;

async function usersHasAccountStatus() {
  if (hasAccountStatusColumn !== undefined) return hasAccountStatusColumn;

  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'account_status'`
  );
  hasAccountStatusColumn = Number(rows[0]?.count || 0) > 0;
  return hasAccountStatusColumn;
}

async function requireActiveAccount(req, res, next) {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    if (!(await usersHasAccountStatus())) {
      next();
      return;
    }

    const rows = await query(
      `SELECT account_status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows[0]) {
      res.status(401).json({ message: 'User account not found.' });
      return;
    }

    if (String(rows[0].account_status || '').toUpperCase() === 'BLOCKED') {
      res.status(403).json({
        message: 'This account is blocked and cannot perform this action.',
        code: 'ACCOUNT_BLOCKED',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireActiveAccount };
