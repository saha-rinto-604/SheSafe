const service = require('./police-verification.service');

async function getStatus(req, res, next) {
  try {
    res.json({ verification: await service.getStatus(req.user) });
  } catch (error) {
    next(error);
  }
}

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file provided.' });
      return;
    }
    res.json({ verification: await service.uploadDocument(req.user, req.params.type, req.file.buffer) });
  } catch (error) {
    next(error);
  }
}

async function submit(req, res, next) {
  try {
    res.json({ verification: await service.submit(req.user) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStatus,
  uploadDocument,
  submit,
};
