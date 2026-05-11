const incidentService = require('./incident.service');

async function report(req, res, next) {
  try {
    const incident = await incidentService.reportIncident(req.user.id, req.body);
    res.status(201).json({ incident });
  } catch (error) {
    next(error);
  }
}

async function getZones(req, res, next) {
  try {
    const zones = await incidentService.getZones();
    res.status(200).json({ zones });
  } catch (error) {
    next(error);
  }
}

module.exports = { report, getZones };
