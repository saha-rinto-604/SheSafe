/**
 * ss.controller.js — Safety Settings HTTP Handlers
 */

const ssService = require('./ss.service');

async function get(req, res) {
  try {
    const settings = await ssService.get(req.user.id);
    res.json({ settings });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function save(req, res) {
  try {
    const settings = await ssService.save(req.user.id, req.body);
    res.json({ settings });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { get, save };
