const aiService = require('./ai.service');

function logAiEndpoint(name, req) {
  if (process.env.AI_DEBUG !== '1') return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  console.info('[AI Safety]', `${name} endpoint reached`, {
    userId: req.user?.id,
    role: req.user?.role,
    bodyKeys: Object.keys(body),
    hasOrigin: Boolean(body.origin),
    hasCoordinates: body.latitude != null || body.longitude != null,
    hasArea: typeof body.area === 'string' && body.area.trim().length > 0,
    hasDestination: typeof body.destination === 'string' && body.destination.trim().length > 0,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGoogleMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_SERVER_KEY || process.env.MAPS_API_KEY),
  });
}

function sendAiError(error, res, next) {
  if (Number(error?.status || 0) >= 500) {
    console.warn('[AI Safety] request failed', {
      status: error.status,
      message: error.message || 'AI request failed',
    });
    res.status(error.status).json({ message: error.message || 'Could not generate incident summary right now.' });
    return;
  }
  next(error);
}

async function generateIncidentSummary(req, res, next) {
  try {
    const result = await aiService.generateIncidentSummary(req.params.incidentId, req.user);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function searchIncidentSummary(req, res, next) {
  try {
    const result = await aiService.searchIncidentSummary(req.body?.query, req.user);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function answerIncidentFollowUp(req, res, next) {
  try {
    const result = await aiService.answerIncidentFollowUp(req.params.incidentId, req.body?.question, req.user);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function generateAreaBrief(req, res, next) {
  try {
    logAiEndpoint('area-brief', req);
    const result = await aiService.generateAreaBrief(req.body);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function generateRouteRiskBrief(req, res, next) {
  try {
    logAiEndpoint('route-risk-brief', req);
    const result = await aiService.generateRouteRiskBrief(req.body);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function answerAreaBriefFollowUp(req, res, next) {
  try {
    logAiEndpoint('area-brief follow-up', req);
    const result = await aiService.answerAreaBriefFollowUp(req.body);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function answerRouteRiskBriefFollowUp(req, res, next) {
  try {
    logAiEndpoint('route-risk-brief follow-up', req);
    const result = await aiService.answerRouteRiskBriefFollowUp(req.body);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function generateVolunteerGuidance(req, res, next) {
  try {
    const result = await aiService.generateVolunteerGuidance(req.params.incidentId, req.user, req.body);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function answerVolunteerGuidanceFollowUp(req, res, next) {
  try {
    const result = await aiService.answerVolunteerGuidanceFollowUp(req.params.incidentId, req.body?.question, req.user);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function generateFirstAidGuide(req, res, next) {
  try {
    const result = await aiService.generateFirstAidGuide(req.body);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

async function answerFirstAidFollowUp(req, res, next) {
  try {
    const result = await aiService.answerFirstAidFollowUp(req.body);
    res.status(200).json(result);
  } catch (error) {
    sendAiError(error, res, next);
  }
}

module.exports = {
  generateIncidentSummary,
  searchIncidentSummary,
  answerIncidentFollowUp,
  generateAreaBrief,
  generateRouteRiskBrief,
  answerAreaBriefFollowUp,
  answerRouteRiskBriefFollowUp,
  generateVolunteerGuidance,
  answerVolunteerGuidanceFollowUp,
  generateFirstAidGuide,
  answerFirstAidFollowUp,
};
