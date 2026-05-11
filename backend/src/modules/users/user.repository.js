const { query } = require('../../config/db');

async function findRoleByName(roleName) {
  const rows = await query(
    'SELECT id, role_name FROM roles WHERE role_name = ? LIMIT 1',
    [roleName]
  );
  return rows[0] || null;
}

async function listRoles() {
  return query('SELECT id, role_name FROM roles ORDER BY id ASC');
}

async function findUserByPhone(phoneNumber) {
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.password_hash, u.entry_time,
            r.role_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.phone_number = ?
     LIMIT 1`,
    [phoneNumber]
  );
  return rows[0] || null;
}

async function createUser({ roleId, firstName, lastName, phoneNumber, passwordHash }) {
  const result = await query(
    `INSERT INTO users (role_id, first_name, last_name, phone_number, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
    [roleId, firstName, lastName, phoneNumber, passwordHash]
  );

  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.phone_number, u.entry_time, r.role_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

module.exports = {
  findRoleByName,
  listRoles,
  findUserByPhone,
  createUser,
};
