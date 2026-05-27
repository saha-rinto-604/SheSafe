const service = require('./admin.service');

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
};
