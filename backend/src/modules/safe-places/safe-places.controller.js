const service = require('./safe-places.service');

async function report(req, res, next) {
  try {
    const safePlace = await service.report(req.user.id, req.body);
    res.status(201).json({ safePlace });
  } catch (err) {
    next(err);
  }
}

async function getZones(req, res, next) {
  try {
    const zones = await service.listZones();
    res.status(200).json({ zones });
  } catch (err) {
    next(err);
  }
}

async function deleteMyData(req, res, next) {
  try {
    const result = await service.deleteMyData(req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { report, getZones, deleteMyData };
