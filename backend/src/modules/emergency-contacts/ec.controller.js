/**
 * ec.controller.js — Emergency Contacts HTTP Handlers
 */

const ecService = require('./ec.service');

async function list(req, res) {
  try {
    const contacts = await ecService.list(req.user.id);
    res.json({ contacts });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function create(req, res) {
  try {
    const contact = await ecService.create(req.user.id, req.body);
    res.status(201).json({ contact });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function update(req, res) {
  try {
    const contact = await ecService.update(req.user.id, Number(req.params.id), req.body);
    res.json({ contact });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function remove(req, res) {
  try {
    await ecService.remove(req.user.id, Number(req.params.id));
    res.json({ message: 'Contact deleted.' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { list, create, update, remove };
