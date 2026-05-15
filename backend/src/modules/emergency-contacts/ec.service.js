/**
 * ec.service.js — Emergency Contacts Business Logic
 * ──────────────────────────────────────────────────────────────────────
 * Business rules mirrored from the frontend:
 *   1. Max 5 contacts per user
 *   2. Only one Primary contact at a time
 *   3. Phone numbers must be unique within a user's contact list
 *   4. Name is required; relationship is optional
 */

const { httpError } = require('../../utils/httpError');
const ecRepo = require('./ec.repository');

const MAX_CONTACTS = 5;

/** Transform a DB row to the frontend's expected shape. */
function toPublic(row) {
  return {
    id: String(row.id),
    name: row.name,
    phone: row.phone,
    relationship: row.relationship || '',
    priority: row.priority,
  };
}

async function list(userId) {
  const rows = await ecRepo.findByUserId(userId);
  return rows.map(toPublic);
}

async function create(userId, data) {
  const count = await ecRepo.countByUserId(userId);
  if (count >= MAX_CONTACTS) {
    throw httpError(400, `You can add up to ${MAX_CONTACTS} emergency contacts.`);
  }

  if (!data.name?.trim()) throw httpError(400, "Contact name is required.");
  if (!data.phone?.trim()) throw httpError(400, "Phone number is required.");

  // If setting as Primary, demote existing Primary
  if (data.priority === 'Primary') {
    await ecRepo.demoteAllPrimary(userId, 0);
  }

  const contact = await ecRepo.create(userId, {
    name: data.name.trim(),
    phone: data.phone.trim(),
    relationship: (data.relationship || '').trim(),
    priority: data.priority || 'Secondary',
  });
  return toPublic(contact);
}

async function update(userId, contactId, data) {
  const existing = await ecRepo.findById(contactId, userId);
  if (!existing) throw httpError(404, 'Contact not found.');

  if (!data.name?.trim()) throw httpError(400, "Contact name is required.");
  if (!data.phone?.trim()) throw httpError(400, "Phone number is required.");

  // If setting as Primary, demote existing Primary (excluding this contact)
  if (data.priority === 'Primary') {
    await ecRepo.demoteAllPrimary(userId, contactId);
  }

  const updated = await ecRepo.update(contactId, userId, {
    name: data.name.trim(),
    phone: data.phone.trim(),
    relationship: (data.relationship || '').trim(),
    priority: data.priority || 'Secondary',
  });
  return toPublic(updated);
}

async function remove(userId, contactId) {
  const existing = await ecRepo.findById(contactId, userId);
  if (!existing) throw httpError(404, 'Contact not found.');
  await ecRepo.remove(contactId, userId);
}

module.exports = { list, create, update, remove };
