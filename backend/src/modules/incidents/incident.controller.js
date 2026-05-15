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

async function getOne(req, res, next) {
  try {
    const incident = await incidentService.getOne(req.params.id);
    res.status(200).json({ incident });
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const incident = await incidentService.cancelIncident(req.user.id, req.params.id);
    res.status(200).json({ incident });
  } catch (error) {
    next(error);
  }
}

async function resolve(req, res, next) {
  try {
    const incident = await incidentService.resolveIncident(req.user.id, req.params.id);
    res.status(200).json({ incident });
  } catch (error) {
    next(error);
  }
}

async function getMyIncidents(req, res, next) {
  try {
    const incidents = await incidentService.getMyIncidents(req.user.id);
    res.status(200).json({ incidents });
  } catch (error) {
    next(error);
  }
}

async function clearMyHistory(req, res, next) {
  try {
    const result = await incidentService.clearMyHistory(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { report, getZones, getOne, cancel, resolve, getMyIncidents, clearMyHistory };
