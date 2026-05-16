/**
 * vf.controller.js — Volunteer Verification HTTP Handlers
 */

const vfService = require('./vf.service');

async function getStatus(req, res) {
  try {
    const status = await vfService.getStatus(req.user.id);
    res.json({ verification: status });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function apply(req, res) {
  try {
    const record = await vfService.apply(req.user.id);
    res.status(201).json({ verification: record });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function uploadDocument(req, res) {
  try {
    // Normalize: frontend may send 'id_card' or 'idCard' — map to the camelCase
    // keys expected by vf.service.js's updateMap.
    const TYPE_MAP = { id_card: 'idCard', selfie: 'selfie', certificate: 'certificate' };
    const rawType = req.params.type;
    const docType = TYPE_MAP[rawType] || rawType;

    if (!req.file) {
      return res.status(400).json({ message: 'No file provided.' });
    }
    const record = await vfService.uploadDocument(req.user.id, docType, req.file.buffer);
    res.json({ verification: record });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function submit(req, res) {
  try {
    const record = await vfService.submit(req.user.id);
    res.json({ verification: record });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function reapply(req, res) {
  try {
    const record = await vfService.reapply(req.user.id);
    res.status(201).json({ verification: record });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

/**
 * POST /api/verification/edit — Revert pending → draft so user can re-upload.
 */
async function edit(req, res) {
  try {
    const record = await vfService.edit(req.user.id);
    res.json({ verification: record });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { getStatus, apply, uploadDocument, submit, reapply, edit };
