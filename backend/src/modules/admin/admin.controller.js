const service = require('./admin.service');
const chatWsServer = require('../../websocket/chatWsServer');

function send(res, key, value) {
  res.status(200).json({ [key]: value });
}

async function overview(req, res, next) {
  try {
    send(res, 'overview', await service.getOverview());
  } catch (error) {
    next(error);
  }
}

async function incidents(req, res, next) {
  try {
    send(res, 'incidents', await service.listIncidents(req.query.status));
  } catch (error) {
    next(error);
  }
}

async function incident(req, res, next) {
  try {
    send(res, 'incident', await service.getIncidentById(req.params.id));
  } catch (error) {
    next(error);
  }
}

async function users(req, res, next) {
  try {
    send(res, 'users', await service.listUsers(req.query.role));
  } catch (error) {
    next(error);
  }
}

async function user(req, res, next) {
  try {
    send(res, 'user', await service.getUserById(req.params.id));
  } catch (error) {
    next(error);
  }
}

async function warnUser(req, res, next) {
  try {
    send(res, 'user', await service.warnUser(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

async function blockUser(req, res, next) {
  try {
    send(res, 'user', await service.blockUser(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

async function unblockUser(req, res, next) {
  try {
    send(res, 'user', await service.unblockUser(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

async function verifications(req, res, next) {
  try {
    send(res, 'verifications', await service.listVerifications(req.query.status));
  } catch (error) {
    next(error);
  }
}

async function verification(req, res, next) {
  try {
    send(res, 'verification', await service.getVerificationById(req.params.id));
  } catch (error) {
    next(error);
  }
}

async function approveVerification(req, res, next) {
  try {
    send(res, 'verification', await service.approveVerification(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

async function rejectVerification(req, res, next) {
  try {
    send(res, 'verification', await service.rejectVerification(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

async function policeVerifications(req, res, next) {
  try {
    send(res, 'policeVerifications', await service.listPoliceVerifications(req.query.status));
  } catch (error) {
    next(error);
  }
}

async function approvePoliceVerification(req, res, next) {
  try {
    send(res, 'policeVerification', await service.approvePoliceVerification(req.user.id, req.params.userId));
  } catch (error) {
    next(error);
  }
}

async function rejectPoliceVerification(req, res, next) {
  try {
    send(res, 'policeVerification', await service.rejectPoliceVerification(req.user.id, req.params.userId, req.body));
  } catch (error) {
    next(error);
  }
}

async function safePlaces(req, res, next) {
  try {
    send(res, 'safePlaces', await service.listSafePlaces(req.query.status));
  } catch (error) {
    next(error);
  }
}

async function safePlace(req, res, next) {
  try {
    send(res, 'safePlace', await service.getSafePlaceById(req.params.id));
  } catch (error) {
    next(error);
  }
}

async function approveSafePlace(req, res, next) {
  try {
    send(res, 'safePlace', await service.approveSafePlace(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

async function rejectSafePlace(req, res, next) {
  try {
    send(res, 'safePlace', await service.rejectSafePlace(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

async function reports(req, res, next) {
  try {
    send(res, 'reports', await service.listReports(req.query.status));
  } catch (error) {
    next(error);
  }
}

async function report(req, res, next) {
  try {
    send(res, 'report', await service.getReportById(req.params.id));
  } catch (error) {
    next(error);
  }
}

async function dismissReport(req, res, next) {
  try {
    send(res, 'report', await service.dismissReport(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

async function warnFromReport(req, res, next) {
  try {
    send(res, 'report', await service.warnFromReport(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

async function blockFromReport(req, res, next) {
  try {
    send(res, 'report', await service.blockFromReport(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

async function notifications(req, res, next) {
  try {
    res.status(200).json(await service.getNotifications());
  } catch (error) {
    next(error);
  }
}

async function auditLogs(req, res, next) {
  try {
    send(res, 'auditLogs', await service.listAuditLogs(req.query.limit));
  } catch (error) {
    next(error);
  }
}

async function lawEnforcementRequests(req, res, next) {
  try {
    send(res, 'requests', await service.listLawEnforcementRequests());
  } catch (error) {
    next(error);
  }
}

async function lawEnforcementRequest(req, res, next) {
  try {
    send(res, 'request', await service.getLawEnforcementRequest(req.user.id, req.params.requestId));
  } catch (error) {
    next(error);
  }
}

async function approvedPolice(req, res, next) {
  try {
    send(res, 'police', await service.listApprovedPolice());
  } catch (error) {
    next(error);
  }
}

async function assignLawEnforcementRequest(req, res, next) {
  try {
    const request = await service.assignLawEnforcementRequest(req.user.id, req.params.requestId, req.body);
    if (request?.incidentId) {
      await chatWsServer.notifyPoliceAssignment({
        incidentId: request.incidentId,
        requestId: request.id,
        message: 'A law enforcement request has been assigned to you.',
      });
      chatWsServer.notifyLawEnforcementRequestUpdated(request, 'assigned');
    }
    send(res, 'request', request);
  } catch (error) {
    next(error);
  }
}

async function cancelLawEnforcementRequest(req, res, next) {
  try {
    const request = await service.cancelLawEnforcementRequest(req.user.id, req.params.requestId, req.body);
    if (request?.incidentId) {
      await chatWsServer.notifyPoliceIncidentStatus({
        incidentId: request.incidentId,
        requestId: request.id,
        status: 'CANCELLED',
        message: 'This law enforcement request has been cancelled.',
      });
      chatWsServer.notifyLawEnforcementRequestUpdated(request, 'cancelled');
    }
    send(res, 'request', request);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  overview,
  incidents,
  incident,
  users,
  user,
  warnUser,
  blockUser,
  unblockUser,
  verifications,
  verification,
  approveVerification,
  rejectVerification,
  policeVerifications,
  approvePoliceVerification,
  rejectPoliceVerification,
  safePlaces,
  safePlace,
  approveSafePlace,
  rejectSafePlace,
  reports,
  report,
  dismissReport,
  warnFromReport,
  blockFromReport,
  notifications,
  auditLogs,
  lawEnforcementRequests,
  lawEnforcementRequest,
  approvedPolice,
  assignLawEnforcementRequest,
  cancelLawEnforcementRequest,
};
