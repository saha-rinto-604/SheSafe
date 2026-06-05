const service = require('./notification.service');

async function list(req, res, next) {
  try {
    res.status(200).json(await service.list(req.user.id, { limit: Number(req.query.limit || 50) }));
  } catch (error) {
    next(error);
  }
}

async function missed(req, res, next) {
  try {
    res.status(200).json(await service.missed(req.user.id, { limit: Number(req.query.limit || 10) }));
  } catch (error) {
    next(error);
  }
}

async function registerPushToken(req, res, next) {
  try {
    await service.registerPushToken(req.user.id, req.body || {});
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

async function deactivatePushToken(req, res, next) {
  try {
    await service.deactivatePushToken(req.user.id, req.body || {});
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    res.status(200).json(await service.markRead(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    res.status(200).json(await service.markAllRead(req.user.id));
  } catch (error) {
    next(error);
  }
}

async function markShown(req, res, next) {
  try {
    res.status(200).json(await service.markShown(req.user.id, Array.isArray(req.body?.ids) ? req.body.ids : []));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  missed,
  registerPushToken,
  deactivatePushToken,
  markRead,
  markAllRead,
  markShown,
};
