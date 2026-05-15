/**
 * ec.repository.js — Emergency Contacts Data Access Layer
 * ──────────────────────────────────────────────────────────────────────
 * Maps to the emergency_contacts table. Max 5 contacts per user,
 * enforced at the service layer (DB has no CHECK constraint for count).
 */

const { query } = require('../../config/db');

/** Get all emergency contacts for a user, ordered by priority then name. */
async function findByUserId(userId) {
  return query(
    `SELECT id, user_id, name, phone, relationship, priority, created_at, updated_at
     FROM emergency_contacts
     WHERE user_id = ?
     ORDER BY FIELD(priority, 'Primary', 'Secondary'), name ASC`,
    [userId]
  );
}

/** Find a single contact by ID + user ID (ownership check). */
async function findById(contactId, userId) {
  const rows = await query(
    'SELECT * FROM emergency_contacts WHERE id = ? AND user_id = ? LIMIT 1',
    [contactId, userId]
  );
  return rows[0] || null;
}

/** Count contacts for a user. */
async function countByUserId(userId) {
  const rows = await query(
    'SELECT COUNT(*) as cnt FROM emergency_contacts WHERE user_id = ?',
    [userId]
  );
  return rows[0].cnt;
}

/** Create a new emergency contact. */
async function create(userId, { name, phone, relationship, priority }) {
  const result = await query(
    `INSERT INTO emergency_contacts (user_id, name, phone, relationship, priority)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, name, phone, relationship || '', priority || 'Secondary']
  );
  const rows = await query('SELECT * FROM emergency_contacts WHERE id = ?', [result.insertId]);
  return rows[0];
}

/** Update an existing contact. */
async function update(contactId, userId, { name, phone, relationship, priority }) {
  await query(
    `UPDATE emergency_contacts
     SET name = ?, phone = ?, relationship = ?, priority = ?
     WHERE id = ? AND user_id = ?`,
    [name, phone, relationship || '', priority || 'Secondary', contactId, userId]
  );
  const rows = await query('SELECT * FROM emergency_contacts WHERE id = ?', [contactId]);
  return rows[0];
}

/** Delete a contact. */
async function remove(contactId, userId) {
  await query(
    'DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?',
    [contactId, userId]
  );
}

/**
 * Demote any existing Primary contact to Secondary for a given user.
 * Called before setting a new Primary to enforce the "one Primary" rule.
 */
async function demoteAllPrimary(userId, excludeId) {
  await query(
    `UPDATE emergency_contacts SET priority = 'Secondary'
     WHERE user_id = ? AND priority = 'Primary' AND id != ?`,
    [userId, excludeId || 0]
  );
}

module.exports = {
  findByUserId,
  findById,
  countByUserId,
  create,
  update,
  remove,
  demoteAllPrimary,
};
