const service = require('./law.service');
const chatWsServer = require('../../websocket/chatWsServer');

function send(res, key, value) {
  res.status(200).json({ [key]: value });
}

async function createRequest(req, res, next) {
  try {
    const request = await service.createLawRequest(req.user, req.body);
    chatWsServer.notifyLawEnforcementRequestCreated(request);
    send(res, 'request', request);
  } catch (error) {
    next(error);
  }
}

async function incidentStatus(req, res, next) {
  try {
    send(res, 'request', await service.getIncidentLawStatus(req.user, req.params.incidentId));
  } catch (error) {
    next(error);
  }
}

async function policeTasks(req, res, next) {
  try {
    send(res, 'tasks', await service.listPoliceTasks(req.user.id));
  } catch (error) {
    next(error);
  }
}

async function acceptTask(req, res, next) {
  try {
    send(res, 'request', await service.acceptTask(req.user.id, req.params.requestId));
  } catch (error) {
    next(error);
  }
}

async function rejectTask(req, res, next) {
  try {
    send(res, 'request', await service.rejectTask(req.user.id, req.params.requestId, req.body));
  } catch (error) {
    next(error);
  }
}

async function resolveTask(req, res, next) {
  try {
    const request = await service.resolveTask(req.user.id, req.params.requestId);
    if (request?.incidentId) {
      await chatWsServer.notifyPoliceIncidentStatus({
        incidentId: request.incidentId,
        requestId: request.id,
        status: 'RESOLVED',
        message: 'This law enforcement request has been resolved.',
      });
    }
    send(res, 'request', request);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRequest,
  incidentStatus,
  policeTasks,
  acceptTask,
  rejectTask,
  resolveTask,
};
