const liveVideoService = require('./liveVideo.service');
const incidentService = require('./incident.service');
const notificationService = require('../notifications/notification.service');
const userService = require('../users/user.service');
const chatWsServer = require('../../websocket/chatWsServer');

function liveVideoPayload(request, extra = {}) {
  return {
    incidentId: String(request.incidentId),
    request,
    ...extra,
  };
}

async function notifyLiveStreamEvent(incidentId, type, payload) {
  await chatWsServer.notifyLiveVideoEvent?.(incidentId, type, payload);
}

async function notifyUser(userId, notification, event) {
  await notificationService.createAndDispatchNotification({
    userId,
    ...notification,
    emit: (createdEvent) => {
      chatWsServer.sendToUser(userId, createdEvent);
    },
  });
  if (event) {
    await chatWsServer.notifyLiveVideoEvent?.(event.incidentId, event.type, event.payload);
  }
}

async function notifyChatVideoRecipients({ incidentId, senderUserId, request, message }) {
  const recipients = await incidentService.getNotificationRecipients(incidentId, { excludeUserId: senderUserId });
  const visibleRecipients = (await Promise.all(recipients.map(async (recipient) => {
    const blocked = await userService.isUserBlockedBy(recipient.userId, senderUserId);
    return blocked ? null : recipient;
  }))).filter(Boolean);

  await Promise.all(visibleRecipients.map((recipient) => notificationService.createAndDispatchNotification({
    userId: recipient.userId,
    type: 'CHAT_MESSAGE',
    title: 'New Live Safety Video',
    body: 'A Live Safety Video was shared in the incident chat.',
    incidentId,
    data: { context: 'incident_chat', role: recipient.role || '', mediaType: 'VIDEO' },
    pushTitle: 'New Live Safety Video',
    pushBody: 'Open SheSafe to view the incident chat.',
    emit: (event) => chatWsServer.sendToUser(recipient.userId, event),
  })));

  await chatWsServer.notifyLiveVideoEvent?.(incidentId, 'live-video:clip', { request, message });
}

async function request(req, res, next) {
  try {
    const result = await liveVideoService.requestLiveVideo(req.user.id, req.params.incidentId);
    if (result.systemMessage) {
      await chatWsServer.notifyAuthorizedMessageNew?.(req.params.incidentId, result.systemMessage);
    }

    if (result.created) {
      await notifyUser(result.victimId, {
        type: 'LIVE_VIDEO_REQUEST',
        title: 'Live Safety Video Request',
        body: 'An accepted responder is requesting emergency video.',
        incidentId: req.params.incidentId,
        data: {
          context: 'live_video',
          role: 'standard_user',
          requestId: result.request.id,
        },
        pushTitle: 'Live Safety Video Request',
        pushBody: 'Open SheSafe to approve or decline the request.',
      }, {
        incidentId: req.params.incidentId,
        type: 'live-video:requested',
        payload: liveVideoPayload(result.request, { autoStartAllowed: result.autoStartAllowed }),
      });
      await notifyLiveStreamEvent(
        req.params.incidentId,
        'live-stream:request',
        liveVideoPayload(result.request, { autoStartAllowed: result.autoStartAllowed })
      );
    }

    res.status(result.created ? 201 : 200).json({
      request: result.request,
      autoStartAllowed: result.autoStartAllowed,
      message: result.systemMessage || null,
      pending: result.request.status === 'PENDING',
      active: ['PENDING', 'APPROVED', 'STREAMING', 'RECORDING'].includes(result.request.status),
      created: result.created,
    });
  } catch (error) {
    next(error);
  }
}

async function pending(req, res, next) {
  try {
    const result = await liveVideoService.getPendingLiveVideoRequest(req.user.id, req.params.incidentId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function state(req, res, next) {
  try {
    const result = await liveVideoService.getLiveStreamState(req.user.id, req.params.incidentId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function respond(req, res, next) {
  try {
    const result = await liveVideoService.respondToLiveVideoRequest(req.user.id, req.params.incidentId, req.body);
    if (result.systemMessage) {
      await chatWsServer.notifyAuthorizedMessageNew?.(req.params.incidentId, result.systemMessage);
    }

    const declined = result.declined;
    const stopped = result.stopped;
    await notifyUser(result.requesterId, {
      type: stopped ? 'LIVE_VIDEO_STOPPED' : declined ? 'LIVE_VIDEO_DECLINED' : 'LIVE_VIDEO_APPROVED',
      title: stopped ? 'Live Safety Video ended' : declined ? 'Live Safety Video declined' : 'Live Safety Video approved',
      body: stopped ? 'Live Safety Video ended.' : declined ? 'Live Safety Video was declined.' : 'The victim approved Live Safety Video.',
      incidentId: req.params.incidentId,
      data: {
        context: 'live_video',
        role: 'volunteer',
        requestId: result.request.id,
      },
      pushTitle: stopped ? 'Live Safety Video ended' : declined ? 'Live Safety Video declined' : 'Live Safety Video approved',
      pushBody: stopped ? 'Live Safety Video ended.' : declined ? 'Live Safety Video was declined.' : 'Open SheSafe for updates.',
    }, {
      incidentId: req.params.incidentId,
      type: stopped ? 'live-video:stopped' : declined ? 'live-video:declined' : 'live-video:approved',
      payload: liveVideoPayload(result.request),
    });
    await notifyLiveStreamEvent(
      req.params.incidentId,
      stopped ? 'live-stream:stop' : declined ? 'live-stream:declined' : 'live-stream:approved',
      liveVideoPayload(result.request, stopped ? { message: 'Live Safety Video ended.' } : {})
    );

    res.status(200).json({
      request: result.request,
      message: result.systemMessage || null,
    });
  } catch (error) {
    next(error);
  }
}

async function upload(req, res, next) {
  try {
    const result = await liveVideoService.uploadLiveVideo(
      req.user.id,
      req.params.incidentId,
      req.file,
      async (request) => {
        await chatWsServer.notifyLiveVideoEvent?.(
          req.params.incidentId,
          'live-video:uploading',
          liveVideoPayload(request)
        );
      }
    );
    await chatWsServer.notifyAuthorizedMessageNew?.(req.params.incidentId, result.message);
    await notifyChatVideoRecipients({
      incidentId: req.params.incidentId,
      senderUserId: req.user.id,
      request: result.request,
      message: result.message,
    });
    res.status(201).json({
      request: result.request,
      message: result.message,
      video: {
        url: result.message.mediaUrl,
        mimeType: result.message.mediaMimeType || null,
        filename: result.message.mediaFilename || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function iceConfig(req, res, next) {
  try {
    const result = await liveVideoService.getLiveStreamIceConfig(req.user.id, req.params.incidentId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  request,
  pending,
  state,
  respond,
  upload,
  iceConfig,
};
