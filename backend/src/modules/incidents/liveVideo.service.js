const { httpError } = require('../../utils/httpError');
const fs = require('fs/promises');
const { uploadVideoFile, deleteAsset } = require('../../config/cloudinary');
const env = require('../../config/env');
const { findIncidentById } = require('./incident.repository');
const { getVolunteerEligibility } = require('../volunteers/volunteerEligibility');
const chatService = require('../chat/chat.service');
const safetySettingsService = require('../safety-settings/ss.service');
const {
  findAcceptedResponder,
  findLatestActiveForVictim,
  findLatestActiveForIncident,
  findLatestForIncident,
  findLatestUploadableForVictim,
  findLatestRespondableForVictim,
  findRequestById,
  createOrReusePendingRequest,
  updateRequestStatus,
  insertLiveVideoSystemMessage,
  insertSessionVideoMessage,
} = require('./liveVideo.repository');

const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const ACTIVE_STATUSES = new Set(['ACTIVE', 'IN_PROGRESS', 'LIVE']);
const LIVE_STREAM_ACTIVE_STATUSES = new Set(['APPROVED', 'STREAMING']);
const REQUEST_ACTIVE_STATUSES = new Set(['PENDING', 'APPROVED', 'STREAMING', 'RECORDING']);

function isActiveIncident(incident) {
  return ACTIVE_STATUSES.has(String(incident?.status || '').toUpperCase());
}

function formatMessage(row) {
  if (!row) return null;
  const isSystem = row.message_type === 'SYSTEM';
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    sender: {
      id: isSystem ? 'system' : String(row.sender_id),
      name: isSystem ? '' : `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      username: isSystem ? undefined : row.username || undefined,
      role: isSystem
        ? 'USER'
        : row.role_name === 'volunteer'
          ? 'VOLUNTEER'
          : row.role_name === 'law_enforcement'
            ? 'POLICE'
            : 'USER',
      photoUrl: isSystem ? undefined : row.photo_url || undefined,
    },
    content: row.content,
    type: row.message_type,
    mediaUrl: row.media_url || undefined,
    mediaPublicId: row.media_public_id || undefined,
    mediaMimeType: row.media_mime_type || undefined,
    mediaFilename: row.media_filename || undefined,
    mediaSizeBytes: row.media_size_bytes == null ? undefined : Number(row.media_size_bytes),
    timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function getActiveIncidentOrThrow(incidentId) {
  const incident = await findIncidentById(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');
  if (!isActiveIncident(incident)) throw httpError(400, 'This incident is no longer active.');
  return incident;
}

async function ensureAcceptedApprovedResponder(incidentId, userId) {
  const { approved } = await getVolunteerEligibility(userId);
  if (!approved) {
    throw httpError(403, 'Only accepted responders can request Live Safety Video.');
  }

  const responder = await findAcceptedResponder(incidentId, userId);
  if (!responder) {
    throw httpError(403, 'Only accepted responders can request Live Safety Video.');
  }
  return responder;
}

async function requestLiveVideo(userId, incidentId) {
  const incident = await getActiveIncidentOrThrow(incidentId);
  await ensureAcceptedApprovedResponder(incidentId, userId);
  const autoStartAllowed = await getVictimAutoEvidenceSetting(incident.user_id);

  const result = await createOrReusePendingRequest({
    incidentId,
    requesterId: userId,
    victimId: incident.user_id,
  });

  const systemMessage = result.created
    ? formatMessage(await insertLiveVideoSystemMessage({
      incidentId,
      senderId: userId,
      content: 'Live Safety Video was requested.',
      systemEventKey: `live_video_requested:${result.request.id}`,
    }))
    : null;

  return {
    request: result.request,
    victimId: String(incident.user_id),
    autoStartAllowed,
    systemMessage,
    created: result.created,
  };
}

async function getPendingLiveVideoRequest(userId, incidentId) {
  const incident = await getActiveIncidentOrThrow(incidentId);
  const isVictim = Number(incident.user_id) === Number(userId);
  if (isVictim) {
    return {
      request: await findLatestActiveForVictim(incidentId, userId),
      role: 'victim',
      autoStartAllowed: await getVictimAutoEvidenceSetting(userId),
    };
  }

  await ensureAcceptedApprovedResponder(incidentId, userId);
  return {
    request: await findLatestActiveForIncident(incidentId),
    role: 'requester',
    autoStartAllowed: false,
  };
}

async function getLiveStreamState(userId, incidentId) {
  const incident = await getActiveIncidentOrThrow(incidentId);
  const isVictim = Number(incident.user_id) === Number(userId);
  if (!isVictim) await ensureAcceptedApprovedResponder(incidentId, userId);

  const request = await findLatestForIncident(incidentId);
  const status = request ? String(request.status || '').toUpperCase() : 'NONE';
  const hasActiveRequest = REQUEST_ACTIVE_STATUSES.has(status);
  const isRequester = Boolean(request && String(request.requesterId) === String(userId));

  return {
    request,
    sessionId: request?.id || null,
    incidentId: String(incident.id),
    status,
    canRequest: !isVictim && !request,
    canRejoin: !isVictim && isRequester && status === 'STREAMING',
    canRestart: !isVictim && Boolean(request) && !hasActiveRequest,
    viewerRole: isVictim ? 'victim' : isRequester ? 'requester' : 'responder',
    victimUserId: String(incident.user_id),
  };
}

async function respondToLiveVideoRequest(userId, incidentId, payload = {}) {
  const incident = await getActiveIncidentOrThrow(incidentId);
  if (Number(incident.user_id) !== Number(userId)) {
    throw httpError(403, 'Only the victim can respond to Live Safety Video.');
  }

  const action = String(payload.action || payload.status || '').trim().toUpperCase();
  if (!['APPROVED', 'DECLINED', 'START', 'START_VIDEO', 'NOT_NOW', 'STOP', 'STOPPED', 'END'].includes(action)) {
    throw httpError(400, 'Live Safety Video response is required.');
  }

  const isStop = ['STOP', 'STOPPED', 'END'].includes(action);
  const nextStatus = isStop
    ? 'STOPPED'
    : action === 'DECLINED' || action === 'NOT_NOW'
      ? 'DECLINED'
      : 'APPROVED';
  const allowedCurrentStatuses = nextStatus === 'APPROVED'
    ? ['PENDING']
    : nextStatus === 'STOPPED'
      ? ['APPROVED', 'STREAMING', 'RECORDING']
      : ['PENDING'];
  const request = payload.requestId
    ? await findRequestForVictim(payload.requestId, incidentId, userId, allowedCurrentStatuses)
    : nextStatus !== 'APPROVED'
      ? await findLatestRespondableForVictim(incidentId, userId)
      : await findLatestActiveForVictim(incidentId, userId);
  if (!request) throw httpError(404, 'Live Safety Video request not found.');

  const updated = await updateRequestStatus(request.id, nextStatus, allowedCurrentStatuses);
  if (!updated) throw httpError(409, 'Live Safety Video request has already changed.');
  const systemMessage = nextStatus === 'DECLINED' || nextStatus === 'STOPPED'
    ? formatMessage(await insertLiveVideoSystemMessage({
      incidentId,
      senderId: userId,
      content: nextStatus === 'STOPPED' ? 'Live Safety Video ended.' : 'Live Safety Video was declined.',
      systemEventKey: nextStatus === 'STOPPED'
        ? `live_video_stopped:${request.id}`
        : `live_video_declined:${request.id}`,
    }))
    : null;

  return {
    request: updated,
    requesterId: request.requesterId,
    declined: nextStatus === 'DECLINED',
    stopped: nextStatus === 'STOPPED',
    systemMessage,
  };
}

async function findRequestForVictim(requestId, incidentId, victimId, allowedStatuses) {
  const request = await findRequestById(requestId);
  if (
    request
    && String(request.incidentId) === String(incidentId)
    && String(request.victimId) === String(victimId)
    && allowedStatuses.includes(request.status)
  ) {
    return request;
  }
  return null;
}

function validateVideoFile(file) {
  if (!file || !file.path) throw httpError(400, 'Invalid video file.');
  if (!String(file.mimetype || '').toLowerCase().startsWith('video/')) {
    throw httpError(400, 'Invalid video file.');
  }
  if (Number(file.size || 0) > MAX_VIDEO_BYTES) {
    throw httpError(413, 'Video is too large. Please try again with a shorter recording.');
  }
}

async function uploadLiveVideo(userId, incidentId, file, onUploading) {
  try {
    const incident = await getActiveIncidentOrThrow(incidentId);
    if (Number(incident.user_id) !== Number(userId)) {
      throw httpError(403, 'Only the victim can upload Live Safety Video.');
    }
    validateVideoFile(file);

    const request = await findLatestUploadableForVictim(incidentId, userId);
    if (!request) throw httpError(403, 'Live Safety Video request was not approved.');
    await onUploading?.(request);

    await chatService.ensureChatSchema();
    const folder = `shesafe/live-safety-video/${incidentId}`;
    const publicId = `live_video_${incidentId}_${userId}_${Date.now()}`;
    let uploaded;
    try {
      uploaded = await uploadVideoFile(file.path, folder, publicId);
    } catch {
      throw httpError(502, 'Video upload failed. Please try again.');
    }

    let clip;
    try {
      clip = await insertSessionVideoMessage({
        requestId: request.id,
        incidentId,
        victimId: userId,
        mediaUrl: uploaded.secure_url,
        mediaPublicId: uploaded.public_id,
        mediaMimeType: file.mimetype,
        mediaFilename: file.originalname || `live-safety-video-${Date.now()}.mp4`,
        mediaSizeBytes: file.size,
      });
    } catch (error) {
      await deleteAsset(uploaded.public_id, 'video');
      throw error;
    }
    if (!clip) {
      await deleteAsset(uploaded.public_id, 'video');
      throw httpError(409, 'This incident is no longer active.');
    }
    const activeRequest = await findRequestById(request.id);
    return {
      request: activeRequest,
      requesterId: clip.requesterId,
      message: formatMessage(clip.message),
    };
  } finally {
    if (file?.path) await fs.unlink(file.path).catch(() => undefined);
  }
}

async function getVictimAutoEvidenceSetting(victimId) {
  const settings = await safetySettingsService.get(victimId).catch(() => ({}));
  return Boolean(settings?.allowEmergencyAutoEvidenceRecording);
}

function buildIceConfig() {
  const iceServers = [];
  const stunUrls = Array.isArray(env.webRtc?.stunUrls) ? env.webRtc.stunUrls.filter(Boolean) : [];
  if (stunUrls.length) {
    iceServers.push({ urls: stunUrls.length === 1 ? stunUrls[0] : stunUrls });
  }

  const turnConfigured = Boolean(
    env.webRtc?.turnUrl
    && env.webRtc?.turnUsername
    && env.webRtc?.turnCredential
  );
  if (turnConfigured) {
    iceServers.push({
      urls: env.webRtc.turnUrl,
      username: env.webRtc.turnUsername,
      credential: env.webRtc.turnCredential,
    });
  } else {
    console.warn('TURN not configured; WebRTC may fail on restricted networks.');
  }

  return {
    iceServers,
    hasTurn: turnConfigured,
  };
}

async function getAuthorizedLiveStreamState(userId, incidentId) {
  const incident = await getActiveIncidentOrThrow(incidentId);
  const isVictim = Number(incident.user_id) === Number(userId);
  if (isVictim) {
    return {
      role: 'victim',
      incident,
      request: await findLatestActiveForVictim(incidentId, userId),
    };
  }
  await ensureAcceptedApprovedResponder(incidentId, userId);
  const request = await findLatestActiveForIncident(incidentId);
  return {
    role: 'viewer',
    incident,
    request,
  };
}

async function getLiveStreamIceConfig(userId, incidentId) {
  const state = await getAuthorizedLiveStreamState(userId, incidentId);
  const isViewerForRequest = state.role === 'viewer'
    && state.request
    && String(state.request.requesterId) === String(userId);
  if (state.role !== 'victim' && !isViewerForRequest) {
    throw httpError(403, 'Only accepted responders can watch Live Safety Video.');
  }
  return {
    ...buildIceConfig(),
    role: state.role,
    request: state.request,
  };
}

function streamError(message, status = 400) {
  return httpError(status, message || 'Live Safety Video stream is not available.');
}

async function handleLiveStreamSignal(userId, incidentId, type, payload = {}) {
  const state = await getAuthorizedLiveStreamState(userId, incidentId);
  const request = state.request;
  const action = String(type || '').trim();

  if (action === 'live-stream:state') {
    return { selfOnly: true, type: 'live-stream:state', payload: { role: state.role, request } };
  }

  if (!request || !LIVE_STREAM_ACTIVE_STATUSES.has(String(request.status || '').toUpperCase())) {
    throw streamError('Live Safety Video stream is not active.', 409);
  }

  const requesterId = String(request.requesterId);
  const victimId = String(request.victimId);
  const isVictim = state.role === 'victim' && String(userId) === victimId;
  const isRequester = String(userId) === requesterId;

  if (state.role === 'viewer' && !isRequester) {
    throw streamError('Only the requesting accepted responder can watch this Live Safety Video stream.', 403);
  }

  if (action === 'live-stream:start') {
    if (!isVictim) throw streamError('Only the victim can start Live Safety Video.', 403);
    const updated = await updateRequestStatus(request.id, 'STREAMING', ['APPROVED', 'STREAMING']);
    return {
      targetUserId: requesterId,
      type: 'live-stream:start',
      payload: { request: updated || request },
      echoToRoom: true,
    };
  }

  if (action === 'live-stream:join') {
    if (!isRequester) throw streamError('Only the requesting accepted responder can join this stream.', 403);
    return {
      targetUserId: victimId,
      type: 'live-stream:join',
      payload: { viewerId: String(userId), request },
    };
  }

  if (action === 'live-stream:offer') {
    if (!isVictim) throw streamError('Only the victim can send a Live Safety Video offer.', 403);
    return {
      targetUserId: String(payload.targetUserId || requesterId),
      type: 'live-stream:offer',
      payload: { viewerId: String(payload.targetUserId || requesterId), offer: payload.offer, request },
    };
  }

  if (action === 'live-stream:answer') {
    if (!isRequester) throw streamError('Only the requesting responder can answer this stream.', 403);
    return {
      targetUserId: victimId,
      type: 'live-stream:answer',
      payload: { viewerId: String(userId), answer: payload.answer, request },
    };
  }

  if (action === 'live-stream:ice-candidate') {
    const targetUserId = String(payload.targetUserId || (isVictim ? requesterId : victimId));
    if (targetUserId !== requesterId && targetUserId !== victimId) {
      throw streamError('Invalid Live Safety Video signaling target.', 403);
    }
    return {
      targetUserId,
      type: 'live-stream:ice-candidate',
      payload: { viewerId: isVictim ? targetUserId : String(userId), candidate: payload.candidate, request },
    };
  }

  if (action === 'live-stream:viewer-left') {
    if (!isRequester) throw streamError('Only the viewing responder can leave this stream.', 403);
    return {
      targetUserId: victimId,
      type: 'live-stream:viewer-left',
      payload: { viewerId: String(userId), request },
    };
  }

  if (action === 'live-stream:error') {
    const nextStatus = isVictim && payload.allowEvidenceFallback ? 'APPROVED' : 'FAILED';
    const updated = isVictim
      ? await updateRequestStatus(request.id, nextStatus, ['APPROVED', 'STREAMING'])
      : request;
    return {
      targetUserId: isVictim ? requesterId : victimId,
      type: 'live-stream:error',
      payload: { request: updated || request, message: payload.message || 'Live Safety Video connection failed.' },
    };
  }

  if (action === 'live-stream:stop') {
    if (!isVictim) throw streamError('Only the victim can stop Live Safety Video.', 403);
    const updated = await updateRequestStatus(request.id, 'STOPPED', ['APPROVED', 'STREAMING', 'RECORDING']);
    return {
      targetUserId: requesterId,
      type: 'live-stream:stop',
      payload: { request: updated || request, message: 'Live Safety Video ended.' },
      echoToRoom: true,
    };
  }

  throw streamError('Unsupported Live Safety Video signaling event.', 400);
}

async function handleLiveStreamDisconnect(userId, incidentId) {
  const state = await getAuthorizedLiveStreamState(userId, incidentId).catch(() => null);
  const request = state?.request;
  if (!state || !request || String(request.status).toUpperCase() !== 'STREAMING') return null;
  if (state.role === 'victim' && String(request.victimId) === String(userId)) {
    const updated = await updateRequestStatus(request.id, 'STOPPED', ['STREAMING']);
    return {
      targetUserId: String(request.requesterId),
      type: 'live-stream:stop',
      payload: { request: updated || request, message: 'Live Safety Video ended.' },
    };
  }
  if (state.role === 'viewer' && String(request.requesterId) === String(userId)) {
    return {
      targetUserId: String(request.victimId),
      type: 'live-stream:viewer-left',
      payload: { viewerId: String(userId), request },
    };
  }
  return null;
}

async function stopLiveStreamForIncident(incidentId, message = 'Live Safety Video ended.') {
  const request = await findLatestActiveForIncident(incidentId);
  if (!request || String(request.status).toUpperCase() !== 'STREAMING') return null;
  const updated = await updateRequestStatus(request.id, 'STOPPED', ['STREAMING']);
  return { request: updated || request, message };
}

module.exports = {
  requestLiveVideo,
  getPendingLiveVideoRequest,
  getLiveStreamState,
  respondToLiveVideoRequest,
  uploadLiveVideo,
  getLiveStreamIceConfig,
  handleLiveStreamSignal,
  handleLiveStreamDisconnect,
  stopLiveStreamForIncident,
};
