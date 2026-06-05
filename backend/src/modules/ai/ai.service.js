const { GoogleGenAI, Type } = require('@google/genai');
const { httpError } = require('../../utils/httpError');
const {
  findIncidentForAi,
  canAccessIncident,
  canVolunteerRespondToIncident,
  listAccessibleIncidents,
  getIncidentMessagesForAi,
  getRespondersForAi,
  getParticipantsForAi,
} = require('./ai.repository');
const { getIncidentZones } = require('../incidents/incident.repository');

const NO_MATCH_MESSAGE = "I couldn't find any matching incident in your accessible incident history.";
const MAX_CHAT_MESSAGES = 80;
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const AREA_RADIUS_M = 1500;
const AREA_ZONE_LIMIT = 5;
const ROUTE_ZONE_LIMIT = 8;
const ROUTE_THRESHOLDS_M = { driving: 300, walking: 180 };
const SAFETY_CONTEXT_TTL_MS = 30 * 60 * 1000;
const HUMAN_TONE_RULES = `Speak like a calm, caring, human safety assistant. Be warm but factual. Do not sound robotic. Do not use backend/API/database/technical terms. Use simple language. If the user asks in Bangla or Banglish, answer in the same language/style when possible. If the user asks to translate into Bengali/Bangla, translate the current answer without adding new facts. Do not invent facts. Use only provided context. If data is missing, say it gently and clearly.`;

let genAiClient = null;
const safetyContextStore = new Map();

const stringArraySchema = { type: Type.ARRAY, items: { type: Type.STRING } };

const summarySchema = {
  type: Type.OBJECT,
  properties: {
    report_title: { type: Type.STRING },
    incident_status: { type: Type.STRING },
    incident_code: { type: Type.STRING },
    location: { type: Type.STRING },
    victim: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        role: { type: Type.STRING },
      },
      required: ['name', 'role'],
    },
    responders: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          action: { type: Type.STRING },
        },
        required: ['name', 'role', 'action'],
      },
    },
    short_summary: { type: Type.STRING },
    what_happened: { type: Type.STRING },
    chat_understanding: { type: Type.STRING },
    timeline: stringArraySchema,
    victim_reported_concerns: stringArraySchema,
    responder_actions: stringArraySchema,
    important_chat_points: stringArraySchema,
    unresolved_items: stringArraySchema,
    safety_notes: stringArraySchema,
    current_or_final_outcome: { type: Type.STRING },
    confidence: { type: Type.STRING },
    final_note: { type: Type.STRING },
  },
  required: [
    'report_title',
    'incident_status',
    'incident_code',
    'location',
    'victim',
    'responders',
    'short_summary',
    'what_happened',
    'chat_understanding',
    'timeline',
    'victim_reported_concerns',
    'responder_actions',
    'important_chat_points',
    'unresolved_items',
    'safety_notes',
    'current_or_final_outcome',
    'confidence',
    'final_note',
  ],
};

const followUpSchema = {
  type: Type.OBJECT,
  properties: {
    answer_title: { type: Type.STRING },
    answer: { type: Type.STRING },
    supporting_points: stringArraySchema,
    not_mentioned: stringArraySchema,
    confidence: { type: Type.STRING },
    final_note: { type: Type.STRING },
  },
  required: [
    'answer_title',
    'answer',
    'supporting_points',
    'not_mentioned',
    'confidence',
    'final_note',
  ],
};

const safetyFollowUpSchema = {
  type: Type.OBJECT,
  properties: {
    answer_title: { type: Type.STRING },
    answer: { type: Type.STRING },
    supporting_points: stringArraySchema,
    not_available: stringArraySchema,
    recommended_actions: stringArraySchema,
    confidence: { type: Type.STRING },
    final_note: { type: Type.STRING },
  },
  required: [
    'answer_title',
    'answer',
    'supporting_points',
    'not_available',
    'recommended_actions',
    'confidence',
    'final_note',
  ],
};

const areaBriefSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    area_name: { type: Type.STRING },
    overall_risk: { type: Type.STRING },
    risk_summary: { type: Type.STRING },
    nearby_red_zones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          distance: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['name', 'distance', 'reason'],
      },
    },
    nearby_yellow_zones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          distance: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['name', 'distance', 'reason'],
      },
    },
    safety_tips: stringArraySchema,
    recommended_actions: stringArraySchema,
    data_note: { type: Type.STRING },
    confidence: { type: Type.STRING },
  },
  required: [
    'title',
    'area_name',
    'overall_risk',
    'risk_summary',
    'nearby_red_zones',
    'nearby_yellow_zones',
    'safety_tips',
    'recommended_actions',
    'data_note',
    'confidence',
  ],
};

const routeBriefSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    origin_label: { type: Type.STRING },
    destination_label: { type: Type.STRING },
    mode: { type: Type.STRING },
    overall_risk: { type: Type.STRING },
    route_summary: { type: Type.STRING },
    red_zones_on_route: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          distance_from_route: { type: Type.STRING },
          reason: { type: Type.STRING },
          advice: { type: Type.STRING },
        },
        required: ['name', 'distance_from_route', 'reason', 'advice'],
      },
    },
    yellow_zones_on_route: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          distance_from_route: { type: Type.STRING },
          reason: { type: Type.STRING },
          advice: { type: Type.STRING },
        },
        required: ['name', 'distance_from_route', 'reason', 'advice'],
      },
    },
    recommended_actions: stringArraySchema,
    map_actions: stringArraySchema,
    data_note: { type: Type.STRING },
    confidence: { type: Type.STRING },
  },
  required: [
    'title',
    'origin_label',
    'destination_label',
    'mode',
    'overall_risk',
    'route_summary',
    'red_zones_on_route',
    'yellow_zones_on_route',
    'recommended_actions',
    'map_actions',
    'data_note',
    'confidence',
  ],
};

const volunteerGuidanceSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    incident_status: { type: Type.STRING },
    risk_level: { type: Type.STRING },
    situation_summary: { type: Type.STRING },
    first_priority: { type: Type.STRING },
    approach_guidance: stringArraySchema,
    communication_tips: stringArraySchema,
    do_not_do: stringArraySchema,
    when_to_stop_or_wait: stringArraySchema,
    missing_information: stringArraySchema,
    recommended_next_steps: stringArraySchema,
    confidence: { type: Type.STRING },
    final_note: { type: Type.STRING },
  },
  required: [
    'title',
    'incident_status',
    'risk_level',
    'situation_summary',
    'first_priority',
    'approach_guidance',
    'communication_tips',
    'do_not_do',
    'when_to_stop_or_wait',
    'missing_information',
    'recommended_next_steps',
    'confidence',
    'final_note',
  ],
};

const firstAidGuideSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    category: { type: Type.STRING },
    quick_summary: { type: Type.STRING },
    first_steps: stringArraySchema,
    do_not_do: stringArraySchema,
    when_to_get_help: stringArraySchema,
    safety_reminder: { type: Type.STRING },
    confidence: { type: Type.STRING },
    final_note: { type: Type.STRING },
  },
  required: [
    'title',
    'category',
    'quick_summary',
    'first_steps',
    'do_not_do',
    'when_to_get_help',
    'safety_reminder',
    'confidence',
    'final_note',
  ],
};

function validateIncidentId(rawIncidentId) {
  const id = Number(rawIncidentId);
  if (!Number.isInteger(id) || id <= 0) {
    throw httpError(400, 'Invalid incidentId.');
  }
  return id;
}

function validateQuestion(rawQuestion) {
  const question = normalizeText(rawQuestion);
  if (question.length < 2 || question.length > 500) {
    throw httpError(400, 'Question must be between 2 and 500 characters.');
  }
  return question;
}

function validateCoordinate(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw httpError(400, `Valid ${label} is required.`);
  }
  return number;
}

function validateLatLng(payload, label = 'coordinates') {
  if (!payload || typeof payload !== 'object') {
    throw httpError(400, `Valid ${label} are required.`);
  }
  return {
    latitude: validateCoordinate(payload.latitude, `${label} latitude`, -90, 90),
    longitude: validateCoordinate(payload.longitude, `${label} longitude`, -180, 180),
  };
}

function validateMode(rawMode) {
  const mode = String(rawMode || 'driving').trim().toLowerCase();
  if (!['driving', 'walking'].includes(mode)) {
    throw httpError(400, 'Mode must be driving or walking.');
  }
  return mode;
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function dateOnly(value) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function displayShortCode(incident) {
  return `SOS-${incident.id}`;
}

function safeTitle(incident) {
  return incident.address || `Incident ${displayShortCode(incident)}`;
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function safeDisplayName(row, prefix = 'Person') {
  const name = normalizeText(`${row?.first_name || ''} ${row?.last_name || ''}`);
  return name || (row?.id ? `${prefix} ${row.id}` : 'Not mentioned');
}

function normalizeRole(roleName, messageType) {
  if (messageType === 'SYSTEM') return 'system';
  const role = String(roleName || '').toLowerCase();
  if (role === 'volunteer') return 'volunteer';
  if (role === 'admin') return 'admin';
  if (role === 'law_enforcement') return 'law_enforcement';
  if (role === 'standard_user') return 'user';
  return role || 'unknown';
}

function sanitizeText(value) {
  let text = normalizeText(value);
  if (!text) return '';

  text = text.replace(/(?:\+?8801|01)\d{9}\b/g, '[phone hidden]');
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email hidden]');
  text = text.replace(/https?:\/\/\S+/gi, '[link hidden]');
  text = text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token hidden]');
  text = text.replace(/\b(password|passcode|otp|token|jwt|secret)\b\s*[:=]\s*\S+/gi, '$1: [hidden]');

  return text.length > 900 ? `${text.slice(0, 900)}...` : text;
}

function sanitizeOutput(value) {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeOutput);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeOutput(entry)]));
  }
  return value;
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || 'unknown time');
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function getMapsApiKey() {
  return String(
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.MAPS_API_KEY ||
    ''
  ).trim();
}

function normalizeLocationKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
    .replace(/\b(av|ave|avn|aven|avenu|avinue|avenue)\b/g, ' avenue ')
    .replace(/\b(rd|road)\b/g, ' road ')
    .replace(/\b(sec|sector)\b/g, ' sector ')
    .replace(/\b(intl|internationl|international)\b/g, ' international ')
    .replace(/\b(uni|university)\b/g, ' university ')
    .replace(/\bu\s*i\s*u\b/g, ' uiu ')
    .replace(/\b(bajar|bazaar)\b/g, ' bazar ')
    .replace(/\b(mirpr|mirpur)\b/g, ' mirpur ')
    .replace(/\b(utara|uttora|uttara)\b/g, ' uttara ')
    .replace(/\b(bada|badda)\b/g, ' badda ')
    .replace(/\b(ibrahim pur|ibrahimpur)\b/g, ' ibrahimpur ')
    .replace(/\b(ten|10)\b/g, ' 10 ')
    .replace(/\b(one|1)\b/g, ' 1 ')
    .replace(/\b(two|2)\b/g, ' 2 ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KNOWN_LOCATION_ALIASES = [
  {
    label: 'Badda',
    query: 'Badda, Dhaka, Bangladesh',
    aliases: ['badda', 'bada', 'badda dhaka', 'bada dhaka', 'badda bazar', 'badda bajar'],
  },
  {
    label: 'Ibrahimpur Bazar',
    query: 'Ibrahimpur Bazar, Dhaka, Bangladesh',
    aliases: ['ibrahimpur bazar', 'ibrahim pur bazar', 'ibrahimpur bajar', 'ibrahimpur', 'ibrahim pur'],
  },
  {
    label: 'Mirpur 10',
    query: 'Mirpur 10, Dhaka, Bangladesh',
    aliases: ['mirpur 10', 'mirpr 10', 'mirpur ten', 'mirpr ten'],
  },
  {
    label: 'Mirpur 1',
    query: 'Mirpur 1, Dhaka, Bangladesh',
    aliases: ['mirpur 1', 'mirpr 1', 'mirpur one', 'mirpr one'],
  },
  {
    label: 'Uttara',
    query: 'Uttara, Dhaka, Bangladesh',
    aliases: ['uttara', 'utara', 'uttora', 'uttara sector', 'utara sector'],
  },
  {
    label: 'Madani Avenue',
    query: 'Madani Avenue, Dhaka, Bangladesh',
    aliases: [
      'madani avenue',
      'madani ave',
      'madani avn',
      'madani aveneu',
      'madani avenu',
      'madani aven',
      'madani av',
      'modani avenue',
      'madani avinue',
      'madani avenue dhaka',
      'madani avenue badda',
      'madani avenue uiu',
      'madani road',
      'madani sorok',
      'madani avenue near uiu',
    ],
  },
  {
    label: 'UIU, Madani Avenue',
    query: 'United International University, Madani Avenue, Dhaka, Bangladesh',
    aliases: [
      'uiu',
      'u i u',
      'u.i.u',
      'uiu dhaka',
      'uiu campus',
      'uiu madani',
      'uiu madani avenue',
      'uiu badda',
      'uiu university',
      'united international university',
      'united intl university',
      'united international uni',
      'united university',
      'unite international university',
      'united internationl university',
      'united international university madani avenue',
    ],
  },
  {
    label: 'Gulshan',
    query: 'Gulshan, Dhaka, Bangladesh',
    aliases: [
      'gulshan',
      'gulsan',
      'gulson',
      'gulshaan',
      'gulshan 1',
      'gulshan one',
      'gulshan-1',
      'gulshan 2',
      'gulshan two',
      'gulshan-2',
      'gulshan circle',
      'gulshan dhaka',
      'gulshan ave',
      'gulshan avenue',
      'gulsan dhaka',
      'gulshon',
    ],
  },
  {
    label: 'Banani',
    query: 'Banani, Dhaka, Bangladesh',
    aliases: [
      'banani',
      'bananee',
      'bananai',
      'banani dhaka',
      'banani 11',
      'banani road 11',
      'banani rd 11',
      'banani bazar',
      'banani bridge',
      'bonani',
      'bannani',
      'banany',
      'banani avenue',
      'banani area',
    ],
  },
];

function levenshteinDistance(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i += 1) {
    let last = i;
    previous[0] = i + 1;
    for (let j = 0; j < right.length; j += 1) {
      const old = previous[j + 1];
      const cost = left[i] === right[j] ? 0 : 1;
      previous[j + 1] = Math.min(previous[j + 1] + 1, previous[j] + 1, last + cost);
      last = old;
    }
  }
  return previous[right.length];
}

function similarityScore(a, b) {
  const left = normalizeLocationKey(a);
  const right = normalizeLocationKey(b);
  const maxLength = Math.max(left.length, right.length);
  if (!maxLength) return 1;
  return 1 - levenshteinDistance(left, right) / maxLength;
}

function resolveLocationInput(rawLocation) {
  const input = sanitizeText(rawLocation);
  const normalized = normalizeLocationKey(input);
  if (!normalized) return { input, query: input, label: input, confidence: 'none' };

  let best = null;
  for (const entry of KNOWN_LOCATION_ALIASES) {
    const aliases = [entry.label, entry.query, ...entry.aliases];
    for (const alias of aliases) {
      const aliasKey = normalizeLocationKey(alias);
      const exact = normalized === aliasKey || normalized.includes(aliasKey);
      const score = exact ? 1 : similarityScore(normalized, aliasKey);
      if (!best || score > best.score) {
        best = { entry, score };
      }
    }
  }

  if (best?.score >= 0.78) {
    return {
      input,
      query: best.entry.query,
      label: best.entry.label,
      confidence: best.score === 1 ? 'exact' : 'fuzzy',
      suggestions: [best.entry.label],
    };
  }

  if (best?.score >= 0.58) {
    return {
      input,
      query: input,
      label: input,
      confidence: 'low',
      needsClarification: true,
      suggestions: [best.entry.label, ...KNOWN_LOCATION_ALIASES.map((entry) => entry.label)]
        .filter((value, index, array) => value && array.indexOf(value) === index)
        .slice(0, 4),
    };
  }

  return { input, query: input, label: input, confidence: 'original' };
}

function buildClarificationResponse(context, message, suggestions = []) {
  return sanitizeOutput({
    success: true,
    type: 'clarification',
    context,
    message,
    suggestions: suggestions.slice(0, 5),
  });
}

function logAiSafety(event, details = {}) {
  if (process.env.AI_DEBUG !== '1' || process.env.NODE_ENV === 'test') return;
  console.info('[AI Safety]', event, sanitizeOutput(details));
}

function googleApiError(service, status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'REQUEST_DENIED' || normalized === 'OVER_QUERY_LIMIT') {
    return httpError(502, `Google ${service} request failed. Check backend Maps key/API access.`);
  }
  if (normalized === 'ZERO_RESULTS') {
    return httpError(400, `Could not find that ${service === 'Directions' ? 'route' : 'location'}. Please check the spelling or choose a more specific Dhaka location.`);
  }
  return httpError(502, `Google ${service} request failed. Please try again.`);
}

function geminiFailureCategory(error) {
  const message = String(error?.message || '');
  const status = Number(error?.status || error?.code || 0);
  if (/api.?key|permission|unauth|forbidden/i.test(message) || [401, 403].includes(status)) return 'auth_or_key';
  if (/schema|json|parse/i.test(message)) return 'json_or_schema';
  if (/model|not found|unavailable/i.test(message) || [400, 404].includes(status)) return 'model';
  if (/quota|rate/i.test(message) || status === 429) return 'quota';
  return 'unknown';
}

function haversineM(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const dLat = toRad(Number(b.latitude) - Number(a.latitude));
  const dLon = toRad(Number(b.longitude) - Number(a.longitude));
  const lat1 = toRad(Number(a.latitude));
  const lat2 = toRad(Number(b.latitude));
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

function formatDistance(meters) {
  const distance = Number(meters);
  if (!Number.isFinite(distance)) return 'Not available';
  if (distance >= 1000) return `${(distance / 1000).toFixed(1)} km`;
  return `${Math.round(distance)} m`;
}

function zoneIncidentCount(zone) {
  const count = Number(zone.incidentCount ?? zone.incident_count ?? zone.count ?? zone.total ?? zone.incidents?.length ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function zoneType(zone) {
  const count = zoneIncidentCount(zone);
  if (zone.isRed || count >= 5) return 'RED';
  if (zone.isYellow || count >= 1) return 'YELLOW';
  return 'UNKNOWN';
}

function zoneReason(zone) {
  const count = zoneIncidentCount(zone);
  if (count > 0) return `Based on ${count} SheSafe incident report${count === 1 ? '' : 's'} in this area.`;
  return 'Based on available SheSafe zone data.';
}

function safeZone(zone, distanceM, distanceKey = 'distance') {
  return {
    name: sanitizeText(zone.name || zone.address || 'SheSafe zone') || 'SheSafe zone',
    type: zoneType(zone),
    [distanceKey]: formatDistance(distanceM),
    distance_m: Math.round(Number(distanceM) || 0),
    incident_count: zoneIncidentCount(zone),
    reason: zoneReason(zone),
    advice: zoneType(zone) === 'RED'
      ? 'Avoid this part if possible and keep SOS ready.'
      : 'Stay alert and prefer visible, populated roads.',
  };
}

async function loadPreparedZones() {
  const zones = await getIncidentZones();
  return zones
    .map((zone) => ({
      ...zone,
      latitude: Number(zone.latitude),
      longitude: Number(zone.longitude),
      incidentCount: zoneIncidentCount(zone),
      type: zoneType(zone),
    }))
    .filter((zone) =>
      Number.isFinite(zone.latitude) &&
      Number.isFinite(zone.longitude) &&
      zoneIncidentCount(zone) > 0
    );
}

function findZonesNearPoint(point, zones, radiusM = AREA_RADIUS_M) {
  return zones
    .map((zone) => ({ zone, distanceM: haversineM(point, zone) }))
    .filter((item) => item.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

function findZonesByAreaName(area, zones) {
  const needle = normalizeLocationKey(area);
  if (!needle) return [];
  const terms = needle.split(/\s+/).filter(Boolean);
  return zones
    .filter((zone) => {
      const haystack = normalizeLocationKey(`${zone.name || ''} ${zone.address || ''}`);
      return terms.some((term) => haystack.includes(term));
    })
    .map((zone) => ({ zone, distanceM: 0 }))
    .sort((a, b) => zoneIncidentCount(b.zone) - zoneIncidentCount(a.zone));
}

async function geocodeArea(area) {
  const cleanArea = sanitizeText(area);
  if (!cleanArea) throw httpError(400, 'Area name is required.');
  const apiKey = getMapsApiKey();
  if (!apiKey) return null;

  logAiSafety('geocode started', { inputLength: cleanArea.length, hasGoogleMapsKey: true });
  const addressText = /bangladesh|dhaka/i.test(cleanArea) ? cleanArea : `${cleanArea}, Dhaka, Bangladesh`;
  const address = encodeURIComponent(addressText);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&components=country:BD&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    logAiSafety('geocode failed', { status: response.status });
    throw httpError(502, 'Google Geocoding request failed. Check backend Maps key/API access.');
  }
  const data = await response.json();
  if (data?.status && data.status !== 'OK') {
    logAiSafety('geocode failed', { status: data.status });
    throw googleApiError('Geocoding', data.status);
  }
  const result = data?.results?.[0];
  const location = result?.geometry?.location;
  if (!location) {
    logAiSafety('geocode no result', { status: data?.status || 'NO_RESULT' });
    return null;
  }
  logAiSafety('geocode succeeded', { status: data?.status || 'OK' });
  return {
    label: sanitizeText(result.formatted_address || cleanArea) || cleanArea,
    latitude: Number(location.lat),
    longitude: Number(location.lng),
  };
}

function decodePolyline(encoded) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < String(encoded || '').length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
}

function distancePointToSegmentM(point, a, b) {
  const latFactor = 111320;
  const lonFactor = 111320 * Math.cos((Number(point.latitude) * Math.PI) / 180);
  const px = 0;
  const py = 0;
  const ax = (Number(a.longitude) - Number(point.longitude)) * lonFactor;
  const ay = (Number(a.latitude) - Number(point.latitude)) * latFactor;
  const bx = (Number(b.longitude) - Number(point.longitude)) * lonFactor;
  const by = (Number(b.latitude) - Number(point.latitude)) * latFactor;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

function minDistanceToRouteM(point, routePoints) {
  if (!routePoints.length) return Infinity;
  if (routePoints.length === 1) return haversineM(point, routePoints[0]);
  let min = Infinity;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    min = Math.min(min, distancePointToSegmentM(point, routePoints[index], routePoints[index + 1]));
  }
  return min;
}

function zoneRadiusM(zone) {
  const radius = Number(zone?.radius || zone?.radius_m || 0);
  return Number.isFinite(radius) && radius > 0 ? radius : 0;
}

async function fetchDirectionsRoute(origin, destination, mode) {
  const apiKey = getMapsApiKey();
  if (!apiKey) throw httpError(500, 'Route safety is not configured. Missing backend Google Maps API key.');

  logAiSafety('directions started', { mode, hasGoogleMapsKey: true });
  const originParam = `${origin.latitude},${origin.longitude}`;
  const destinationParam = typeof destination === 'string'
    ? encodeURIComponent(/bangladesh|dhaka/i.test(destination) ? destination : `${destination}, Dhaka, Bangladesh`)
    : `${destination.latitude},${destination.longitude}`;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originParam}&destination=${destinationParam}&mode=${mode}&alternatives=false&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    logAiSafety('directions failed', { status: response.status });
    throw httpError(502, 'Google Directions request failed. Check backend Maps key/API access.');
  }
  const data = await response.json();
  if (data?.status && data.status !== 'OK') {
    logAiSafety('directions failed', { status: data.status });
    throw googleApiError('Directions', data.status);
  }
  const route = data?.routes?.[0];
  if (!route) throw httpError(400, 'Could not find a route to that destination.');
  const leg = route.legs?.[0] || {};
  const points = decodePolyline(route.overview_polyline?.points || '');
  if (!points.length) throw httpError(502, 'Route data did not include usable geometry.');
  logAiSafety('directions succeeded', { points: points.length });

  return {
    points,
    origin_label: sanitizeText(leg.start_address || 'Current location') || 'Current location',
    destination_label: sanitizeText(leg.end_address || String(destination)) || String(destination),
    distance_text: sanitizeText(leg.distance?.text || 'Not available') || 'Not available',
    duration_text: sanitizeText(leg.duration?.text || 'Not available') || 'Not available',
  };
}

function buildSystemEvents(incident, responders) {
  const events = [];
  events.push({
    type: 'incident_created',
    time: toIso(incident.created_at),
    description: `Incident ${displayShortCode(incident)} was created.`,
  });
  events.push({
    type: 'chat_started',
    time: toIso(incident.created_at),
    description: 'SOS chat started for this incident.',
  });

  responders.forEach((responder) => {
    events.push({
      type: 'responder_accepted',
      time: responder.accepted_at,
      description: `${responder.name} accepted/responded to this incident.`,
    });
  });

  if (incident.status === 'RESOLVED') {
    events.push({
      type: 'incident_resolved',
      time: toIso(incident.updated_at || incident.created_at),
      description: 'Incident status is RESOLVED.',
    });
  }

  if (incident.status === 'CANCELLED') {
    events.push({
      type: 'incident_cancelled',
      time: toIso(incident.updated_at || incident.created_at),
      description: 'Incident status is CANCELLED.',
    });
  }

  return events;
}

function formatTranscript(messages) {
  const lines = messages
    .map((message, index) => {
      if (!message.content) return null;
      const name = message.sender_name && message.sender_name !== 'Not mentioned'
        ? ` (${message.sender_name})`
        : '';
      return `${index + 1}. [${formatDateTime(message.timestamp)}] ${message.sender_role}${name}: ${message.content}`;
    })
    .filter(Boolean);
  return lines.length ? lines.join('\n') : 'No chat messages available.';
}

async function canUserAccessIncident(user, incidentId) {
  return canAccessIncident(incidentId, user);
}

async function getEnrichedIncidentContext(rawIncidentId, user) {
  const incidentId = validateIncidentId(rawIncidentId);
  const incident = await findIncidentForAi(incidentId);
  if (!incident) throw httpError(404, 'Incident not found.');

  const allowed = await canUserAccessIncident(user, incidentId);
  if (!allowed) throw httpError(403, 'You are not allowed to access this incident summary.');

  const [messageRows, responderRows, participantRows] = await Promise.all([
    getIncidentMessagesForAi(incidentId, MAX_CHAT_MESSAGES),
    getRespondersForAi(incidentId),
    getParticipantsForAi(incidentId),
  ]);

  const responders = responderRows.map((row) => ({
    name: safeDisplayName(row, 'Responder'),
    role: normalizeRole(row.role_name),
    action: row.status === 'ACCEPTED' ? 'Accepted/responded to the incident' : sanitizeText(row.status || 'Not mentioned'),
    accepted_at: toIso(row.accepted_at),
  }));

  const participants = participantRows.map((row) => ({
    name: safeDisplayName(row, 'Participant'),
    role: normalizeRole(row.role_name),
    joined_at: toIso(row.joined_at),
    left_at: toIso(row.left_at),
  }));

  const sanitizedMessages = messageRows
    .map((message) => ({
      timestamp: toIso(message.created_at),
      sender_role: normalizeRole(message.role_name, message.message_type),
      sender_name: message.message_type === 'SYSTEM' ? 'system' : safeDisplayName(message, 'Sender'),
      message_type: message.message_type || 'TEXT',
      content: sanitizeText(message.content),
    }))
    .filter((message) => message.content);

  const safeAddress = sanitizeText(incident.address || 'Not mentioned');
  const incidentCode = displayShortCode(incident);
  const context = {
    incident: {
      id: String(incident.id),
      incident_code: incidentCode,
      short_code: incidentCode,
      status: incident.status || 'UNKNOWN',
      address: safeAddress || 'Not mentioned',
      location_name: safeAddress || 'Not mentioned',
      area: safeAddress || 'Not mentioned',
      latitude: incident.latitude == null ? null : Number(incident.latitude),
      longitude: incident.longitude == null ? null : Number(incident.longitude),
      risk_zone: 'Not mentioned',
      created_at: toIso(incident.created_at),
      accepted_at: toIso(incident.accepted_at),
      resolved_at: incident.status === 'RESOLVED' ? toIso(incident.updated_at || incident.created_at) : null,
      cancelled_at: incident.status === 'CANCELLED' ? toIso(incident.updated_at || incident.created_at) : null,
    },
    victim: {
      name: safeDisplayName({
        id: incident.user_id,
        first_name: incident.victim_first_name,
        last_name: incident.victim_last_name,
      }, 'User'),
      role: normalizeRole(incident.victim_role) || 'user',
    },
    responders,
    participants,
    system_events: buildSystemEvents(incident, responders),
    chat_messages: sanitizedMessages,
    sanitized_chat_transcript: formatTranscript(sanitizedMessages),
    case_details: {
      user_case_details: sanitizeOutput(parseJson(incident.user_case_details) || {}),
      volunteer_case_details: sanitizeOutput(parseJson(incident.volunteer_case_details) || {}),
    },
  };

  return sanitizeOutput(context);
}

function getGenAiClient() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw httpError(500, 'AI Safety Copilot is not configured. Missing GEMINI_API_KEY.');
  }
  if (!genAiClient) {
    genAiClient = new GoogleGenAI({ apiKey });
  }
  return genAiClient;
}

function storeSafetyContext(kind, context) {
  const contextId = `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  safetyContextStore.set(contextId, {
    kind,
    context: sanitizeOutput(context),
    expiresAt: Date.now() + SAFETY_CONTEXT_TTL_MS,
  });
  return contextId;
}

function loadSafetyContext(contextId, expectedKind) {
  const id = String(contextId || '').trim();
  if (!id) throw httpError(400, 'Generate an area brief or route safety check first, then ask a follow-up.');
  const stored = safetyContextStore.get(id);
  if (!stored || stored.expiresAt < Date.now() || stored.kind !== expectedKind) {
    safetyContextStore.delete(id);
    throw httpError(400, 'Generate an area brief or route safety check first, then ask a follow-up.');
  }
  return stored.context;
}

function buildAreaPrompt(context) {
  return `You are SheSafe AI Safety Copilot.

Create an area safety brief using ONLY the provided SheSafe area and zone data.

Rules:
- ${HUMAN_TONE_RULES}
- Do not invent red zones.
- Do not invent yellow zones.
- Do not invent incident counts.
- If data is missing, say it is not available.
- Do not guarantee safety.
- Give practical safety tips.
- The user may provide place names in English, Bangla, or Banglish/Romanized Bangla.
- Explain like a calm safety assistant for normal users.
- Avoid technical implementation terms like polyline, coordinates, Haversine, threshold, geometry, database query, route segment, API result, or algorithm.
- Do not use backend, frontend, API, database, DB, query, Gemini, fallback, model, JSON, schema, server, saved context, matched markers, or technical error in user-facing fields.
- Keep the response short, direct, useful, and safety-focused.
- Return JSON only.

Prepared SheSafe area context:
${JSON.stringify(context, null, 2)}`;
}

function buildRoutePrompt(context) {
  return `You are SheSafe AI Safety Copilot.

Create a route safety check using ONLY the provided route and SheSafe zone data.

Rules:
- ${HUMAN_TONE_RULES}
- Do not invent red/yellow zones.
- Do not invent incident counts.
- Do not claim the route is guaranteed safe.
- Explain risk in simple practical language.
- Mention red/yellow zones only if provided by backend.
- The user may provide destination text in English, Bangla, or Banglish/Romanized Bangla.
- Avoid technical implementation terms like polyline, coordinates, Haversine, threshold, geometry, database query, route segment, API result, or algorithm.
- Do not use backend, frontend, API, database, DB, query, Gemini, fallback, model, JSON, schema, server, saved context, matched markers, or technical error in user-facing fields.
- Keep the response calm, direct, useful, and safety-focused.
- Return JSON only.

Prepared SheSafe route context:
${JSON.stringify(context, null, 2)}`;
}

function buildSafetyFollowUpPrompt(kind, context, question) {
  const label = kind === 'route' ? 'route safety check' : 'area safety brief';
  return `You are SheSafe AI Safety Copilot.

Answer the user's follow-up question using ONLY the selected ${label} context below.

Rules:
- ${HUMAN_TONE_RULES}
- The user may ask in English, Bangla, or Banglish/Romanized Bangla.
- Understand the question regardless of language.
- Answer in the same language/style as the user when possible.
- If user asks in Banglish, answer in simple Banglish or simple English based on clarity.
- Use only the provided SheSafe area/route context.
- Do not invent zones, counts, routes, or safety claims.
- Do not claim guaranteed safety.
- If data is unavailable, say it is not available.
- Keep the answer simple, user-friendly, and safety-focused.
- Avoid technical implementation terms.
- Do not repeat the same generic route/area summary unless that directly answers the question.
- Do not use backend, frontend, API, database, DB, query, Gemini, fallback, model, JSON, schema, server, saved context, matched markers, or technical error in user-facing fields.
- Return JSON only.

User question:
${question}

Prepared SheSafe ${label} context:
${JSON.stringify(context, null, 2)}`;
}

function buildSummaryPrompt(context) {
  return `You are SheSafe AI Safety Copilot.

Generate a detailed, structured incident summary using ONLY the provided incident data, participant data, responder data, system events, and chat transcript.

Rules:
- ${HUMAN_TONE_RULES}
- Do not invent facts.
- Do not invent victim names.
- Do not invent volunteer/responder names.
- Include names only if provided in the input.
- If something is missing, say "Not mentioned".
- Do not diagnose medical conditions.
- Do not prescribe medicine.
- Do not include phone numbers, emails, document links, or private identifiers.
- Do not include raw chat transcript.
- Make the summary useful for the victim/user, volunteer, and admin record review.
- Separate victim concerns from responder actions.
- Include a clear current/final outcome.
- If chat has only system messages, clearly say direct user/volunteer conversation was limited or not mentioned.
- Return JSON only.

Sanitized selected incident context:
${JSON.stringify(context, null, 2)}`;
}

function buildFollowUpPrompt(context, question) {
  return `You are SheSafe AI Safety Copilot.

Answer the user's follow-up question using ONLY the selected incident context below.

Rules:
- ${HUMAN_TONE_RULES}
- The user may ask in English, Bangla, or Banglish/Romanized Bangla.
- Understand the question regardless of language.
- Answer in the same language/style as the user when possible.
- If user asks in Banglish, answer in simple Banglish or simple English based on clarity.
- Use only the selected incident context.
- Do not answer general unrelated questions outside this selected incident.
- If unrelated, say: "This answer can only use the selected incident's available information."
- Do not invent names, addresses, actions, or facts.
- If exact location/name is unavailable, clearly say it was not mentioned in the available incident data.
- Do not include phone numbers, emails, document links, or private identifiers.
- Return JSON only.

User question:
${question}

Sanitized selected incident context:
${JSON.stringify(context, null, 2)}`;
}

function buildVolunteerGuidancePrompt(context) {
  return `You are SheSafe AI Safety Copilot.

Create safe volunteer response guidance using ONLY the provided incident information.

Rules:
- ${HUMAN_TONE_RULES}
- Prioritize volunteer safety.
- Do not tell the volunteer to fight, chase, confront, enter danger alone, act like police, diagnose, or prescribe medicine.
- Keep guidance calm, direct, practical, and non-technical.
- Do not use backend, API, database, Gemini, JSON, model, fallback, server, or debug words in user-facing fields.
- If something is missing, say it is not available.
- Return JSON only.

Prepared volunteer incident context:
${JSON.stringify(context, null, 2)}`;
}

function buildVolunteerFollowUpPrompt(context, question) {
  return `You are SheSafe AI Safety Copilot.

Answer the volunteer's follow-up question using ONLY the selected volunteer guidance context and safe response rules.

Rules:
- ${HUMAN_TONE_RULES}
- The user may ask in English, Bangla, or Banglish/Romanized Bangla.
- Answer in the same language/style when possible.
- Directly answer this exact question.
- Do not suggest confrontation, chasing, fighting, entering danger alone, diagnosis, medicine, or acting like police.
- Keep language simple, calm, and safety-focused.
- Do not use backend, API, database, Gemini, JSON, model, fallback, server, or debug words.
- Return JSON only.

Question:
${question}

Volunteer guidance context:
${JSON.stringify(context, null, 2)}`;
}

function buildFirstAidPrompt(category, question) {
  return `You are SheSafe AI Safety Copilot.

Create simple first-aid and emergency safety guidance.

Rules:
- ${HUMAN_TONE_RULES}
- Give basic first-response guidance only.
- Do not diagnose.
- Do not prescribe medicine or dosage.
- Do not replace emergency services or medical professionals.
- For serious symptoms, recommend urgent help.
- Keep language simple, calm, and non-technical.
- The user may ask in English, Bangla, or Banglish/Romanized Bangla.
- Answer in the same language/style when possible.
- Do not use backend, API, database, Gemini, JSON, model, fallback, server, or debug words.
- Return JSON only.

Category:
${category}

User question:
${question || 'General guidance for this category'}`;
}

function buildFirstAidFollowUpPrompt(category, question, previousGuide = null) {
  return `You are SheSafe AI Safety Copilot.

Answer the user's first-aid follow-up question safely.

Rules:
- ${HUMAN_TONE_RULES}
- Use basic emergency safety guidance only.
- Do not diagnose.
- Do not prescribe medicine or dosage.
- If the user asks for medicine, dosage, or prescription advice, refuse safely and recommend a medical professional.
- The user may ask in English, Bangla, or Banglish/Romanized Bangla.
- Answer in the same language/style when possible.
- Keep language simple and calm.
- Return JSON only.

Category:
${category}

Question:
${question}

Previous guide:
${JSON.stringify(previousGuide || {}, null, 2)}`;
}

function parseGeminiJson(text, errorMessage) {
  const raw = String(text || '').trim();
  if (!raw) throw httpError(502, errorMessage);

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let jsonText = fenced ? fenced[1].trim() : raw;
  if (!jsonText.startsWith('{')) {
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonText = objectMatch[0];
  }
  try {
    const parsed = JSON.parse(jsonText);
    logAiSafety('gemini json parse succeeded');
    return parsed;
  } catch {
    logAiSafety('gemini json parse failed');
    throw httpError(502, errorMessage);
  }
}

async function generateStructuredJson({
  prompt,
  schema,
  invalidJsonMessage,
  fallbackMessage = 'Could not generate incident summary right now.',
}) {
  const client = getGenAiClient();
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      logAiSafety('gemini model call started', { model, hasResponseSchema: Boolean(schema) });
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.2,
        },
      });
      logAiSafety('gemini model call succeeded', { model });
      return sanitizeOutput(parseGeminiJson(response.text, invalidJsonMessage));
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      const status = Number(error?.status || error?.code || 0);
      logAiSafety('gemini model call failed', {
        model,
        category: geminiFailureCategory(error),
        status: status || 'unknown',
      });

      if (schema && (status === 400 || /schema|responseSchema/i.test(message))) {
        try {
          logAiSafety('gemini retry without schema started', { model });
          const response = await client.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });
          logAiSafety('gemini retry without schema succeeded', { model });
          return sanitizeOutput(parseGeminiJson(response.text, invalidJsonMessage));
        } catch (retryError) {
          lastError = retryError;
          logAiSafety('gemini retry without schema failed', {
            model,
            category: geminiFailureCategory(retryError),
            status: Number(retryError?.status || retryError?.code || 0) || 'unknown',
          });
        }
      }

      const canRetryModel = status === 400 || status === 404 || /model|not found|unavailable/i.test(message);
      if (!canRetryModel) break;
    }
  }

  if (lastError?.status) {
    throw httpError(502, fallbackMessage);
  }
  throw lastError || httpError(502, fallbackMessage);
}

function asString(value, fallback = 'Not mentioned') {
  const text = sanitizeText(value);
  return text || fallback;
}

function cleanSafetyText(value, fallback = 'Not mentioned') {
  let text = asString(value, fallback);
  text = text
    .replace(/\bbackend\b/gi, 'SheSafe')
    .replace(/\bfrontend\b/gi, 'app')
    .replace(/\bAPI\b/g, 'service')
    .replace(/\bdatabase\b|\bDB\b|\bquery\b/gi, 'SheSafe data')
    .replace(/\bGemini\b|\bmodel\b|\bresponse schema\b|\bschema\b|\bJSON\b/gi, 'SheSafe')
    .replace(/\bAI wording is temporarily unavailable\b/gi, 'Showing safety guidance based on available SheSafe data')
    .replace(/\bAI explanation is temporarily unavailable\b/gi, 'Showing safety guidance based on available SheSafe data')
    .replace(/\bsaved context\b|\bsaved safety context\b/gi, 'available SheSafe data')
    .replace(/\broute geometry\b|\bpolyline\b|\bHaversine\b|\bthreshold\b|\balgorithm\b/gi, 'route information')
    .replace(/\bcoordinates\b|\blat\/lng\b/gi, 'location details')
    .replace(/\bcalculated by SheSafe\b/gi, 'shown by SheSafe')
    .replace(/\bmatched markers\b|\bzone markers\b/gi, 'risk zones')
    .replace(/\bfallback\b/gi, 'available guidance')
    .replace(/\btechnical error\b/gi, 'issue')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function asSafetyArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanSafetyText(item)).filter(Boolean);
}

function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function normalizeSummary(summary) {
  return {
    report_title: cleanSafetyText(summary?.report_title, 'Incident Summary'),
    incident_status: cleanSafetyText(summary?.incident_status),
    incident_code: cleanSafetyText(summary?.incident_code),
    location: cleanSafetyText(summary?.location),
    victim: {
      name: cleanSafetyText(summary?.victim?.name),
      role: cleanSafetyText(summary?.victim?.role),
    },
    responders: Array.isArray(summary?.responders)
      ? summary.responders.map((responder) => ({
          name: cleanSafetyText(responder?.name),
          role: cleanSafetyText(responder?.role),
          action: cleanSafetyText(responder?.action),
        })).filter((responder) => responder.name !== 'Not mentioned' || responder.action !== 'Not mentioned')
      : [],
    short_summary: cleanSafetyText(summary?.short_summary),
    what_happened: cleanSafetyText(summary?.what_happened),
    chat_understanding: cleanSafetyText(summary?.chat_understanding),
    timeline: asSafetyArray(summary?.timeline),
    victim_reported_concerns: asSafetyArray(summary?.victim_reported_concerns),
    responder_actions: asSafetyArray(summary?.responder_actions),
    important_chat_points: asSafetyArray(summary?.important_chat_points),
    unresolved_items: asSafetyArray(summary?.unresolved_items),
    safety_notes: asSafetyArray(summary?.safety_notes),
    current_or_final_outcome: cleanSafetyText(summary?.current_or_final_outcome),
    confidence: cleanSafetyText(summary?.confidence),
    final_note: cleanSafetyText(summary?.final_note),
  };
}

function normalizeFollowUp(answer) {
  return {
    answer_title: cleanSafetyText(answer?.answer_title, 'Incident Follow-up'),
    answer: cleanSafetyText(answer?.answer),
    supporting_points: asSafetyArray(answer?.supporting_points),
    not_mentioned: asSafetyArray(answer?.not_mentioned),
    confidence: cleanSafetyText(answer?.confidence),
    final_note: cleanSafetyText(answer?.final_note),
  };
}

function normalizeZoneList(value, distanceKey = 'distance') {
  if (!Array.isArray(value)) return [];
  return value.map((zone) => ({
    name: cleanSafetyText(zone?.name),
    [distanceKey]: cleanSafetyText(zone?.[distanceKey]),
    reason: cleanSafetyText(zone?.reason),
    ...(distanceKey === 'distance_from_route' ? { advice: cleanSafetyText(zone?.advice) } : {}),
  })).filter((zone) => zone.name !== 'Not mentioned');
}

function normalizeAreaBrief(brief) {
  return {
    title: cleanSafetyText(brief?.title, 'Area Safety Brief'),
    area_name: cleanSafetyText(brief?.area_name),
    overall_risk: cleanSafetyText(brief?.overall_risk),
    risk_summary: cleanSafetyText(brief?.risk_summary),
    nearby_red_zones: normalizeZoneList(brief?.nearby_red_zones, 'distance'),
    nearby_yellow_zones: normalizeZoneList(brief?.nearby_yellow_zones, 'distance'),
    safety_tips: asSafetyArray(brief?.safety_tips),
    recommended_actions: asSafetyArray(brief?.recommended_actions),
    data_note: cleanSafetyText(brief?.data_note),
    confidence: cleanSafetyText(brief?.confidence),
  };
}

function normalizeRouteBrief(brief) {
  return {
    title: cleanSafetyText(brief?.title, 'Route Safety Check'),
    origin_label: cleanSafetyText(brief?.origin_label),
    destination_label: cleanSafetyText(brief?.destination_label),
    mode: cleanSafetyText(brief?.mode),
    overall_risk: cleanSafetyText(brief?.overall_risk),
    route_summary: cleanSafetyText(brief?.route_summary),
    red_zones_on_route: normalizeZoneList(brief?.red_zones_on_route, 'distance_from_route'),
    yellow_zones_on_route: normalizeZoneList(brief?.yellow_zones_on_route, 'distance_from_route'),
    recommended_actions: asSafetyArray(brief?.recommended_actions),
    map_actions: asSafetyArray(brief?.map_actions),
    data_note: cleanSafetyText(brief?.data_note),
    confidence: cleanSafetyText(brief?.confidence),
  };
}

function normalizeSafetyFollowUp(answer) {
  return {
    answer_title: cleanSafetyText(answer?.answer_title, 'Safety Follow-up'),
    emotional_opening: cleanSafetyText(answer?.emotional_opening, ''),
    direct_answer: cleanSafetyText(answer?.direct_answer || answer?.answer, ''),
    answer: cleanSafetyText(answer?.answer),
    breakdown: Array.isArray(answer?.breakdown)
      ? answer.breakdown.map((item) => ({
          point: cleanSafetyText(item?.point),
          simple_explanation: cleanSafetyText(item?.simple_explanation),
          why_it_matters: cleanSafetyText(item?.why_it_matters),
          what_to_do_next: cleanSafetyText(item?.what_to_do_next),
        }))
      : [],
    example_words_to_say: asSafetyArray(answer?.example_words_to_say),
    supporting_points: asSafetyArray(answer?.supporting_points),
    not_available: asSafetyArray(answer?.not_available),
    recommended_actions: asSafetyArray(answer?.recommended_actions),
    what_to_avoid: asSafetyArray(answer?.what_to_avoid),
    urgent_help_signs: asSafetyArray(answer?.urgent_help_signs),
    confidence: cleanSafetyText(answer?.confidence),
    final_note: cleanSafetyText(answer?.final_note),
  };
}

function normalizeVolunteerGuidance(guidance) {
  return {
    title: cleanSafetyText(guidance?.title, 'Volunteer Guidance'),
    incident_status: cleanSafetyText(guidance?.incident_status),
    risk_level: cleanSafetyText(guidance?.risk_level, 'Unknown'),
    situation_summary: cleanSafetyText(guidance?.situation_summary),
    first_priority: cleanSafetyText(guidance?.first_priority),
    approach_guidance: asSafetyArray(guidance?.approach_guidance),
    communication_tips: asSafetyArray(guidance?.communication_tips),
    do_not_do: asSafetyArray(guidance?.do_not_do),
    when_to_stop_or_wait: asSafetyArray(guidance?.when_to_stop_or_wait),
    missing_information: asSafetyArray(guidance?.missing_information),
    recommended_next_steps: asSafetyArray(guidance?.recommended_next_steps),
    confidence: cleanSafetyText(guidance?.confidence),
    final_note: cleanSafetyText(guidance?.final_note, 'Based on available incident information.'),
  };
}

function normalizeFirstAidGuide(guide) {
  return {
    title: cleanSafetyText(guide?.title, 'First Aid Guide'),
    category: cleanSafetyText(guide?.category),
    quick_summary: cleanSafetyText(guide?.quick_summary),
    first_steps: asSafetyArray(guide?.first_steps),
    do_not_do: asSafetyArray(guide?.do_not_do),
    when_to_get_help: asSafetyArray(guide?.when_to_get_help),
    safety_reminder: cleanSafetyText(guide?.safety_reminder, 'This is general guidance, not a medical diagnosis.'),
    confidence: cleanSafetyText(guide?.confidence),
    final_note: cleanSafetyText(guide?.final_note, 'Get professional help for serious symptoms.'),
  };
}

const FIRST_AID_CATEGORIES = {
  burn: 'Burn',
  bleeding: 'Bleeding',
  fainting: 'Fainting',
  panic_attack: 'Panic Attack',
  road_accident: 'Road Accident',
  breathing_problem: 'Breathing Problem',
  injury: 'Injury',
  harassment: 'Harassment / Feeling Unsafe',
  general: 'General Emergency Safety',
};

function normalizeFirstAidCategory(rawCategory, rawQuestion = '') {
  const text = normalizeLocationKey(rawCategory || rawQuestion);
  if (/burn|por(a|e)|agun/.test(text)) return 'burn';
  if (/bleed|blood|rokto|rokt/.test(text)) return 'bleeding';
  if (/faint|senseless|oggyan|ojnan/.test(text)) return 'fainting';
  if (/panic|anxiety|bhoy|voy/.test(text)) return 'panic_attack';
  if (/road|accident|crash|durghotona/.test(text)) return 'road_accident';
  if (/breath|shash|sas|respir/.test(text)) return 'breathing_problem';
  if (/injur|hurt|wound|betha/.test(text)) return 'injury';
  if (/harass|unsafe|follow|eve/.test(text)) return 'harassment';
  return rawCategory ? null : 'general';
}

function validateFirstAidInput(payload = {}) {
  const question = sanitizeText(payload.question || '');
  const categoryKey = normalizeFirstAidCategory(payload.category, question);
  if (!categoryKey || !FIRST_AID_CATEGORIES[categoryKey]) {
    throw httpError(400, 'Choose an emergency type or ask a first-aid question.');
  }
  if (question && question.length > 500) {
    throw httpError(400, 'Question must be 500 characters or less.');
  }
  return { categoryKey, category: FIRST_AID_CATEGORIES[categoryKey], question };
}

function isMedicineRequest(question) {
  return /\b(medicine|medication|dose|dosage|tablet|pill|antibiotic|painkiller|paracetamol|napa|mg|prescription)\b/i.test(String(question || ''));
}

function isOintmentRequest(question) {
  return /\b(ointment|cream|molom|malam|মলম)\b/i.test(String(question || ''));
}

function isHospitalRequest(question) {
  return /\b(hospital|doctor|medical help|urgent help|serious|emergency|hospitale|hospital e|nebo|nite hobe|daktar|eta serious)\b/i.test(String(question || ''));
}

function isEmotionalRequest(question) {
  return /\b(scared|afraid|panic|panicking|confused|bhoy|voy|panic kortesi|ami confused|khub voy|ভয়|প্যানিক|কনফিউজ)\b/i.test(String(question || ''));
}

function isBreakdownRequest(question) {
  return /\b(break down|explain more|more detail|details|step by step|easy kore|aro details|aro clearly|aro bistarito|point|step|bujhi nai|why|keno|বিস্তারিত|ধাপে|বুঝিনি|কেন)\b/i.test(String(question || ''));
}

function urgentHelpSigns() {
  return [
    'Breathing difficulty',
    'Chest pain',
    'Unconsciousness or not waking up',
    'Heavy bleeding or bleeding that does not slow with pressure',
    'Severe burn, large burn, or burn on face/hands/major joints',
    'Head injury, confusion, seizure, or repeated vomiting',
    'Severe pain, suspected fracture, deep wound, or very weak/unwell feeling',
  ];
}

function buildFallbackVolunteerGuidance(context) {
  return normalizeVolunteerGuidance({
    title: 'Volunteer Guidance',
    incident_status: context?.incident?.status || 'Unknown',
    risk_level: 'Use caution',
    situation_summary: `Available incident information shows help is needed near ${context?.incident?.address || 'the shared location'}.`,
    first_priority: 'Stay safe while keeping calm communication with the user.',
    approach_guidance: [
      'Thank you for trying to help. Your safety matters too.',
      'Keep your live location on if possible.',
      'Approach through public, well-lit, and busier roads.',
      'Keep distance if the area looks unsafe.',
      'Wait for more help if the situation feels risky.',
    ],
    communication_tips: [
      'Tell the user who you are and that you are responding through SheSafe.',
      'Ask the user to stay in a public or well-lit place if possible.',
      'Use short, calm messages.',
    ],
    do_not_do: [
      'Do not confront anyone.',
      'Do not chase anyone.',
      'Do not enter an isolated or unsafe area alone.',
      'Do not give medical diagnosis or medicine advice.',
    ],
    when_to_stop_or_wait: [
      'Wait if you see direct danger.',
      'Wait if the user says the situation is escalating.',
      'Ask for emergency support if risk increases.',
    ],
    missing_information: [
      context?.sanitized_chat_transcript === 'No chat messages available.' ? 'Recent user messages are not available.' : '',
      context?.incident?.address ? '' : 'Exact location is not available.',
    ].filter(Boolean),
    recommended_next_steps: [
      'Message the user before approaching.',
      'Confirm the safest nearby public place.',
      'Keep SOS/emergency support ready if danger escalates.',
    ],
    confidence: 'Medium',
    final_note: 'Based on available incident information. Volunteer safety comes first.',
  });
}

function fallbackFirstAidGuide(categoryKey, category, question = '') {
  if (isMedicineRequest(question)) {
    return normalizeFirstAidGuide({
      title: 'Medicine Advice Not Available',
      category,
      quick_summary: "I can't give medicine or dosage advice. Please contact a medical professional.",
      first_steps: ['Stay calm and seek help from a qualified medical professional.'],
      do_not_do: ['Do not take unknown medicine or dosage based on app guidance.'],
      when_to_get_help: ['Get medical help if symptoms are serious, worsening, or unclear.'],
      safety_reminder: 'This is general safety guidance, not a medical diagnosis.',
      confidence: 'High',
      final_note: 'For medicine or dosage, contact a doctor or pharmacist.',
    });
  }

  const common = {
    burn: {
      first_steps: ['Cool the burn with clean running water if safe.', 'Remove tight items near the burn before swelling starts.', 'Cover lightly with clean cloth if available.'],
      do_not_do: ['Do not apply toothpaste, oil, or butter.', 'Do not put ice directly on the burn.', 'Do not break blisters.'],
      when_to_get_help: ['Get urgent help for large, deep, face, hand, or breathing-related burns.'],
    },
    bleeding: {
      first_steps: ['Apply steady pressure with clean cloth if safe.', 'Keep the injured area raised if possible.', 'Call for help if bleeding is heavy.'],
      do_not_do: ['Do not remove deeply stuck objects.', 'Do not use dirty cloth if a cleaner option is available.'],
      when_to_get_help: ['Get urgent help if bleeding is heavy, does not slow, or the person feels weak.'],
    },
    fainting: {
      first_steps: ['Keep the person safe from falling or traffic.', 'Let them lie down if possible.', 'Check if they respond and breathe normally.'],
      do_not_do: ['Do not crowd the person.', 'Do not force food or drink immediately.'],
      when_to_get_help: ['Get urgent help if they do not wake soon, have injury, chest pain, or breathing trouble.'],
    },
    panic_attack: {
      first_steps: ['Move to a calmer place if possible.', 'Encourage slow breathing.', 'Use grounding, like naming things they can see and hear.'],
      do_not_do: ['Do not shout or pressure the person.', 'Do not dismiss their fear.'],
      when_to_get_help: ['Get help if symptoms are severe, new, or include chest pain or breathing trouble.'],
    },
    road_accident: {
      first_steps: ['Move away from traffic only if safe.', 'Call for help.', 'Keep the person still if serious injury is possible.'],
      do_not_do: ['Do not move someone with possible neck or spine injury unless there is immediate danger.', 'Do not crowd the injured person.'],
      when_to_get_help: ['Get urgent help for bleeding, unconsciousness, breathing trouble, or severe pain.'],
    },
    breathing_problem: {
      first_steps: ['Help the person sit upright.', 'Keep the area calm and open.', 'Get urgent help if breathing is severe or worsening.'],
      do_not_do: ['Do not give medicine unless it is already prescribed to them.', 'Do not make them lie flat if that worsens breathing.'],
      when_to_get_help: ['Get urgent help for severe breathing trouble, blue lips, chest pain, or fainting.'],
    },
    injury: {
      first_steps: ['Move to safety if possible.', 'Rest the injured area.', 'Use clean covering for cuts if available.'],
      do_not_do: ['Do not force movement if pain is severe.', 'Do not ignore swelling, heavy bleeding, or confusion.'],
      when_to_get_help: ['Get help for severe pain, heavy bleeding, head injury, or trouble moving.'],
    },
    harassment: {
      first_steps: ['Move toward a public, well-lit place.', 'Call or message someone trusted.', 'Use SOS if you feel in danger.'],
      do_not_do: ['Do not confront the person alone.', 'Do not go to isolated areas.'],
      when_to_get_help: ['Get emergency support if you are followed, threatened, trapped, or unsafe.'],
    },
    general: {
      first_steps: ['Move to a safer place if possible.', 'Stay calm and ask for help.', 'Share your live location with someone trusted.'],
      do_not_do: ['Do not take risky action alone.', 'Do not ignore serious symptoms or danger.'],
      when_to_get_help: ['Get urgent help if there is danger, severe injury, breathing trouble, or unconsciousness.'],
    },
  };
  const guide = common[categoryKey] || common.general;
  return normalizeFirstAidGuide({
    title: `${category} Safety Tips`,
    category,
    quick_summary: "Stay calm. I'll keep this simple. Here are safe first steps. This is general guidance, not a medical diagnosis.",
    first_steps: guide.first_steps,
    do_not_do: guide.do_not_do,
    when_to_get_help: guide.when_to_get_help,
    safety_reminder: 'Get professional or emergency help if symptoms are serious, worsening, or unclear.',
    confidence: 'Medium',
    final_note: 'This is general safety guidance, not a replacement for medical professionals.',
  });
}

function detectVolunteerIntent(question) {
  const text = lowerQuestion(question);
  if (isTranslationRequest(question)) return 'translate';
  if (isHospitalRequest(question)) return 'hospital';
  if (isOintmentRequest(question) || isMedicineRequest(question)) return 'ointment';
  if (isEmotionalRequest(question)) return 'emotional';
  if (isBreakdownRequest(question)) return 'breakdown';
  if (/say|message|victim ke|ki bolbo|বলব|বলবো/.test(text)) return 'what_to_say';
  if (/alone|eka|এক\\s?া|go alone|jawa uchit/.test(text)) return 'go_alone';
  if (/avoid|এড়িয়ে|avoid korbo/.test(text)) return 'avoid';
  if (/wait|stop|kokhon wait|থেমে|অপেক্ষা/.test(text)) return 'wait';
  if (/missing|info|তথ্য/.test(text)) return 'missing_info';
  if (/short|summary|short kore/.test(text)) return 'short';
  return 'first_step';
}

function buildFallbackVolunteerFollowUp(context, question) {
  const intent = detectVolunteerIntent(question);
  const address = context?.incident?.address || 'the shared location';
  const status = context?.incident?.status || 'Unknown';

  if (intent === 'translate') {
    return normalizeSafetyFollowUp({
      answer_title: 'বাংলা অনুবাদ',
      answer: `ধন্যবাদ সাহায্য করার চেষ্টা করার জন্য। আপনার নিরাপত্তাও গুরুত্বপূর্ণ। ঘটনাটির অবস্থা ${status}। ${address} এলাকার দিকে যাওয়ার আগে শান্তভাবে ভিকটিমকে মেসেজ করুন, তারা নিরাপদ জায়গায় আছে কি না জিজ্ঞেস করুন, এবং জায়গা অনিরাপদ মনে হলে একা এগোবেন না।`,
      supporting_points: ['নিজের নিরাপত্তা আগে দেখুন।', 'ভিকটিমকে শান্ত ও ছোট মেসেজ দিন।', 'ঝুঁকি বেশি মনে হলে অপেক্ষা করুন।'],
      not_available: [],
      recommended_actions: ['লাইভ লোকেশন চালু রাখুন।', 'পাবলিক বা আলোযুক্ত জায়গা ব্যবহার করুন।', 'প্রয়োজনে জরুরি সহায়তা নিন।'],
      confidence: 'Medium',
      final_note: 'উপলব্ধ ঘটনার তথ্যের ভিত্তিতে বলা হয়েছে।',
    });
  }
  if (intent === 'emotional') {
    return normalizeSafetyFollowUp({
      answer_title: 'Take This Slowly',
      emotional_opening: 'I understand. Take a breath — we will keep this simple.',
      direct_answer: 'Your safety matters too. Do not rush into a risky or isolated place. Stay where there are people or light, keep your live location on if possible, and message the user calmly.',
      answer: 'I understand. Take a breath — we will keep this simple. Your safety matters too. Do not rush into a risky or isolated place. Stay where there are people or light, keep your live location on if possible, and message the user calmly.',
      supporting_points: ['Stay in a public or well-lit place.', 'Keep communication open.', 'Use SOS or emergency help if danger feels immediate.'],
      not_available: [],
      recommended_actions: ['Send one calm message to the user.', 'Confirm their current location.', 'Wait if the area feels unsafe.'],
      confidence: 'Medium',
      final_note: 'You can help best when you are also safe.',
    });
  }
  if (intent === 'hospital') {
    return normalizeSafetyFollowUp({
      answer_title: 'Hospital Or Urgent Help',
      emotional_opening: 'I understand why you are asking. I cannot diagnose from here.',
      direct_answer: 'If the victim has any serious warning sign, get urgent medical help or take them to hospital if it is safe to do so. If you are unsure, contacting medical help is the safer choice.',
      answer: 'I cannot diagnose from here, but if the victim has any serious warning sign, get urgent medical help or take them to hospital if it is safe to do so.',
      supporting_points: ['Ask calmly: “Are you bleeding? Is your breathing normal? Did you hit your head?”'],
      not_available: [],
      urgent_help_signs: urgentHelpSigns(),
      recommended_actions: ['Do not move the person if serious injury is possible unless there is immediate danger.', 'Call medical or emergency help if any warning sign is present.'],
      confidence: 'Medium',
      final_note: 'This is safety guidance, not a medical diagnosis.',
    });
  }
  if (intent === 'ointment') {
    return normalizeSafetyFollowUp({
      answer_title: 'About Ointment Or Medicine',
      emotional_opening: 'Good question. It is safer not to apply anything random.',
      direct_answer: 'Do not apply random ointment or medicine right now. First identify the injury type. For burns, use clean running water if safe. For bleeding, clean pressure comes first. For serious injuries, get medical help.',
      answer: 'Do not apply random ointment or medicine right now. First identify the injury type.',
      supporting_points: [
        'Burn: avoid toothpaste, oil, butter, ice, or random ointment.',
        'Bleeding: apply clean pressure first.',
        'Small clean scratch: proper first-aid ointment may be used lightly only after bleeding stops.',
      ],
      not_available: [],
      recommended_actions: ['Ask what type of injury it is.', 'Get medical help if the injury is deep, large, infected, or the person feels very unwell.'],
      confidence: 'Medium',
      final_note: 'This is general first-aid safety guidance, not medicine advice.',
    });
  }

  const answers = {
    first_step: {
      title: 'What To Do First',
      answer: 'First, make sure you are safe. Do not rush into an isolated place. Message the user calmly, confirm where they are, and ask whether they can move toward a public or well-lit area.',
      points: [`Incident status: ${status}`, `Known location: ${address}`],
    },
    what_to_say: {
      title: 'What To Say To The User',
      answer: 'You can say: "I am nearby and trying to help. Are you in a safe place right now? Can you stay somewhere public or well-lit? Please share any nearby landmark if you can." Keep it short and reassuring.',
      points: ['Use calm words.', 'Ask one or two clear questions.', 'Do not pressure the user.'],
    },
    go_alone: {
      title: 'Should You Go Alone?',
      answer: 'If the area feels risky, do not go alone. Stay in a public place, keep your live location on, and wait or coordinate with others. You can help best when you are also safe.',
      points: ['Avoid isolated places.', 'Keep communication open.', 'Wait if danger is visible.'],
    },
    avoid: {
      title: 'What To Avoid',
      answer: 'Avoid confronting anyone, chasing anyone, entering isolated areas alone, or making the user feel pressured. Keep distance if the situation feels unsafe.',
      points: ['Do not act like police.', 'Do not physically intervene beyond safe civilian help.', 'Do not give medicine advice.'],
    },
    wait: {
      title: 'When To Stop Or Wait',
      answer: 'Stop and wait if you see direct danger, the area is isolated, the user says the situation is escalating, or you are unsure where the threat is. Keep messaging and seek emergency support if needed.',
      points: ['Waiting can be the safer choice.', 'Your safety matters too.'],
    },
    missing_info: {
      title: 'Missing Information',
      answer: 'The most useful missing details are the user’s exact current spot, whether they are in a public place, whether the threat is still nearby, and whether another responder is available.',
      points: ['Ask for a landmark.', 'Ask if they can move to light or people.', 'Ask if they need urgent emergency help.'],
    },
    short: {
      title: 'Short Version',
      answer: 'Stay safe first. Message the user calmly, confirm their location, avoid confrontation, and wait if the area feels unsafe.',
      points: [],
    },
  };
  if (intent === 'breakdown' || /explain|point|step|bujhi|keno|why/i.test(question)) {
    const guidancePoint = context?.safety_rules?.[1] || 'Avoid direct confrontation and stay in safer public places.';
    return normalizeSafetyFollowUp({
      answer_title: 'Point Explained Simply',
      emotional_opening: 'Okay, let’s break this down slowly.',
      direct_answer: `This point means: ${guidancePoint}`,
      answer: `Okay, let’s break this down. This means: ${guidancePoint} It matters because you can help better when you are also safe.`,
      breakdown: [
        {
          point: guidancePoint,
          simple_explanation: 'Do not rush into a place where you may also become unsafe.',
          why_it_matters: 'A safe volunteer can communicate, wait, and coordinate better.',
          what_to_do_next: 'Message the user, confirm their location, and approach only through public or well-lit areas.',
        },
      ],
      supporting_points: ['Do not rush into an isolated place.', 'Keep communication open.', 'Wait if the area feels unsafe.'],
      not_available: [],
      recommended_actions: ['Message the user calmly.', 'Confirm their location.', 'Ask if they can stay near people or light.'],
      confidence: 'Medium',
      final_note: 'Based on available incident information.',
    });
  }
  const selected = answers[intent] || answers.first_step;
  return normalizeSafetyFollowUp({
    answer_title: selected.title,
    answer: selected.answer,
    supporting_points: selected.points,
    not_available: [],
    recommended_actions: ['Keep live location on if possible.', 'Use public, well-lit roads.', 'Ask for help if danger escalates.'],
    confidence: 'Medium',
    final_note: 'Based on available incident information.',
  });
}

function detectFirstAidIntent(question) {
  const text = lowerQuestion(question);
  if (isTranslationRequest(question)) return 'translate';
  if (isHospitalRequest(question)) return 'hospital';
  if (isEmotionalRequest(question)) return 'emotional';
  if (isOintmentRequest(question)) return 'ointment';
  if (isMedicineRequest(question)) return 'medicine';
  if (isBreakdownRequest(question) || /explain step|step 1|step 2|point 1|point 2|bujhi|why/i.test(String(question || ''))) return 'explain_step';
  if (/avoid|do not|ki avoid|এড়িয়ে/.test(text)) return 'avoid';
  if (/help|urgent|doctor|kokhon|কখন|সাহায্য/.test(text)) return 'help';
  if (/short|summary|short kore/.test(text)) return 'short';
  return 'first_steps';
}

function buildFallbackFirstAidFollowUp(categoryKey, category, question) {
  const intent = detectFirstAidIntent(question);
  const guide = fallbackFirstAidGuide(categoryKey, category, '');
  if (intent === 'translate') {
    return normalizeSafetyFollowUp({
      answer_title: 'বাংলা অনুবাদ',
      answer: `${category} পরিস্থিতিতে শান্ত থাকুন। আগে নিরাপদ জায়গায় থাকুন এবং সহজ প্রথম পদক্ষেপ নিন। গুরুতর লক্ষণ থাকলে দ্রুত চিকিৎসা সহায়তা নিন। এটি সাধারণ নির্দেশনা, চিকিৎসা নির্ণয় নয়।`,
      supporting_points: guide.first_steps.map((step) => `• ${step}`),
      not_available: [],
      recommended_actions: guide.when_to_get_help,
      confidence: 'Medium',
      final_note: 'এটি সাধারণ নিরাপত্তা নির্দেশনা, চিকিৎসকের পরামর্শের বিকল্প নয়।',
    });
  }
  if (intent === 'medicine') {
    return normalizeSafetyFollowUp({
      answer_title: 'Medicine Advice Not Available',
      answer: "I can't give medicine or dosage advice. Please contact a medical professional or emergency service.",
      supporting_points: [],
      not_available: ['Medicine or dosage advice is not available here.'],
      recommended_actions: ['Contact a doctor, pharmacist, or emergency service if symptoms are serious.'],
      confidence: 'High',
      final_note: 'This is general safety guidance, not prescription advice.',
    });
  }
  if (intent === 'emotional') {
    return normalizeSafetyFollowUp({
      answer_title: 'Take It Step By Step',
      emotional_opening: 'I understand. Take a breath — I’ll keep this simple.',
      direct_answer: 'Focus on safety first. Move to a safer place if possible, ask for help, and follow only the simple first steps for this situation.',
      answer: 'I understand. Take a breath — I’ll keep this simple. Focus on safety first and get help if anything feels serious.',
      supporting_points: guide.first_steps.slice(0, 3),
      not_available: [],
      recommended_actions: guide.when_to_get_help,
      confidence: 'Medium',
      final_note: 'This is general first-aid guidance, not a medical diagnosis.',
    });
  }
  if (intent === 'hospital') {
    return normalizeSafetyFollowUp({
      answer_title: 'When To Get Urgent Help',
      emotional_opening: 'I cannot diagnose from here, but I can help you watch for danger signs.',
      direct_answer: 'If any serious warning sign is present, get urgent medical help or go to hospital if it is safe. If you are unsure, contacting medical help is safer.',
      answer: 'If any serious warning sign is present, get urgent medical help or go to hospital if it is safe.',
      supporting_points: ['If details are missing, tell me if it is burn, bleeding, fainting, breathing problem, road accident, or panic.'],
      not_available: [],
      urgent_help_signs: urgentHelpSigns(),
      recommended_actions: ['Call local emergency help if symptoms are serious.', 'Do not move an injured person unless there is immediate danger.'],
      confidence: 'Medium',
      final_note: 'This is safety guidance, not a medical diagnosis.',
    });
  }
  if (intent === 'ointment') {
    return normalizeSafetyFollowUp({
      answer_title: 'About Ointment',
      emotional_opening: 'Good question. It is safer not to apply anything random.',
      direct_answer: 'Do not apply random ointment right now. First identify the injury type.',
      answer: 'Do not apply random ointment right now. First identify the injury type. For burns, cool with clean running water if safe and avoid toothpaste, oil, butter, ice, or random ointment. For bleeding, apply clean pressure first. For a small clean scratch, a proper first-aid ointment may be used in a thin layer only if bleeding has stopped.',
      supporting_points: [
        'Burn: cool with clean running water and cover with clean cloth.',
        'Bleeding: apply clean pressure first.',
        'Small clean scratch: proper first-aid ointment may be used lightly after bleeding stops.',
      ],
      not_available: [],
      recommended_actions: ['Get medical help if the injury is serious, deep, large, infected, or the person feels very unwell.'],
      confidence: 'Medium',
      final_note: 'This is general first-aid guidance, not a prescription.',
    });
  }
  if (intent === 'explain_step') {
    const firstStep = guide.first_steps[0] || 'Focus on safety first.';
    return normalizeSafetyFollowUp({
      answer_title: 'Step Explained Simply',
      emotional_opening: 'Okay, let’s break this down slowly.',
      direct_answer: `This step means: ${firstStep}`,
      answer: `I understand. I'll keep this simple. This step means: ${firstStep}`,
      breakdown: [
        {
          point: firstStep,
          simple_explanation: 'Do this only if it is safe and you can do it calmly.',
          why_it_matters: 'Simple first steps can reduce harm while you arrange help.',
          what_to_do_next: 'Follow the step gently, then watch for warning signs.',
        },
      ],
      supporting_points: ['Do it only if it is safe.', 'Get help if symptoms are serious or unclear.'],
      not_available: [],
      recommended_actions: guide.when_to_get_help,
      confidence: 'Medium',
      final_note: 'This is general first-aid guidance.',
    });
  }
  if (intent === 'avoid') {
    return normalizeSafetyFollowUp({
      answer_title: 'What To Avoid',
      answer: 'I’ll keep this simple. Avoid the risky actions listed below and get help if the situation feels serious.',
      supporting_points: guide.do_not_do,
      not_available: [],
      recommended_actions: guide.when_to_get_help,
      confidence: 'Medium',
      final_note: 'This is general first-aid guidance, not a medical diagnosis.',
    });
  }
  if (intent === 'help') {
    return normalizeSafetyFollowUp({
      answer_title: 'When To Get Help',
      answer: 'Get urgent help if symptoms are serious, worsening, or unclear.',
      supporting_points: guide.when_to_get_help,
      not_available: [],
      recommended_actions: ['Call local emergency support or contact a medical professional.'],
      confidence: 'Medium',
      final_note: 'This is general first-aid guidance.',
    });
  }
  if (intent === 'short') {
    return normalizeSafetyFollowUp({
      answer_title: 'Short Steps',
      answer: 'Stay calm, focus on safety first, and get help if the situation is serious.',
      supporting_points: guide.first_steps.slice(0, 3),
      not_available: [],
      recommended_actions: guide.when_to_get_help,
      confidence: 'Medium',
      final_note: 'This is general guidance, not a medical diagnosis.',
    });
  }
  return normalizeSafetyFollowUp({
    answer_title: 'First Steps',
    answer: 'Here are safe first steps. Do them only if it is safe.',
    supporting_points: guide.first_steps,
    not_available: [],
    recommended_actions: guide.when_to_get_help,
    confidence: 'Medium',
    final_note: 'This is general first-aid guidance, not a medical diagnosis.',
  });
}

function areaZoneFallback(zone) {
  return {
    name: asString(zone?.name, 'SheSafe zone'),
    distance: asString(zone?.distance),
    reason: asString(zone?.reason, 'Based on available SheSafe zone data.'),
  };
}

function routeZoneFallback(zone) {
  return {
    name: asString(zone?.name, 'SheSafe zone'),
    distance_from_route: asString(zone?.distance_from_route),
    reason: asString(zone?.reason, 'Based on available SheSafe zone data.'),
    advice: asString(zone?.advice, 'Stay alert and prefer visible, populated roads.'),
  };
}

function compactStoredZone(zone, distanceKey) {
  return sanitizeOutput({
    name: asString(zone?.name, 'SheSafe zone'),
    type: asString(zone?.type),
    [distanceKey]: asString(zone?.[distanceKey]),
    distance_m: Number.isFinite(Number(zone?.distance_m)) ? Number(zone.distance_m) : null,
    incident_count: Number.isFinite(Number(zone?.incident_count)) ? Number(zone.incident_count) : 0,
    reason: asString(zone?.reason, 'Based on available SheSafe zone data.'),
    advice: asString(zone?.advice, 'Stay alert and prefer visible, populated roads.'),
  });
}

function withAiFallbackNote(dataNote) {
  const base = asString(dataNote, 'Based on available SheSafe data. This does not guarantee safety.');
  return `${base} Showing safety guidance based on available SheSafe data.`;
}

function buildFallbackAreaBrief(context) {
  const redZones = Array.isArray(context?.nearby_red_zones) ? context.nearby_red_zones.map(areaZoneFallback) : [];
  const yellowZones = Array.isArray(context?.nearby_yellow_zones) ? context.nearby_yellow_zones.map(areaZoneFallback) : [];
  const zoneCount = redZones.length + yellowZones.length;
  const riskSummary = zoneCount
    ? `This area has ${zoneCount} known SheSafe risk zone${zoneCount === 1 ? '' : 's'} nearby.`
    : 'No SheSafe red/yellow zone data was found near this area.';

  return normalizeAreaBrief({
    title: 'Area Safety Brief',
    area_name: context?.area_name || 'Selected area',
    overall_risk: context?.backend_calculated_risk || 'Low/Unknown',
    risk_summary: riskSummary,
    nearby_red_zones: redZones,
    nearby_yellow_zones: yellowZones,
    safety_tips: [
      'Stay aware of your surroundings.',
      'Avoid isolated areas if you feel unsafe.',
      'Share live location with someone trusted.',
    ],
    recommended_actions: [
      'Use SOS if you feel unsafe.',
      'Stay near public/well-lit areas.',
    ],
    data_note: withAiFallbackNote(context?.data_note),
    confidence: zoneCount ? 'Medium' : 'Low',
  });
}

function buildFallbackRouteBrief(context) {
  const redZones = Array.isArray(context?.red_zones_on_route) ? context.red_zones_on_route.map(routeZoneFallback) : [];
  const yellowZones = Array.isArray(context?.yellow_zones_on_route) ? context.yellow_zones_on_route.map(routeZoneFallback) : [];
  const zoneCount = redZones.length + yellowZones.length;
  const routeSummary = zoneCount
    ? `This ${context?.mode || 'selected'} route passes near ${zoneCount} known SheSafe risk zone${zoneCount === 1 ? '' : 's'}.`
    : 'No SheSafe red/yellow zones were found near this route in available data.';

  return normalizeRouteBrief({
    title: 'Route Safety Check',
    origin_label: context?.origin_label || 'Current location',
    destination_label: context?.destination_label || 'Destination',
    mode: context?.mode || 'driving',
    overall_risk: context?.backend_calculated_risk || 'Low/Unknown',
    route_summary: routeSummary,
    red_zones_on_route: redZones,
    yellow_zones_on_route: yellowZones,
    recommended_actions: [
      'Review the route before starting.',
      'Share live location with someone trusted.',
      'Keep SOS ready if you feel unsafe.',
    ],
    map_actions: ['View on map', 'Share live location', 'Keep SOS ready'],
    data_note: withAiFallbackNote(context?.data_note),
    confidence: zoneCount ? 'Medium' : 'Low',
  });
}

function buildStoredAreaContext(context, brief) {
  return sanitizeOutput({
    type: 'area_safety_brief',
    area_name: brief.area_name || context?.area_name || 'Selected area',
    coordinates: context?.coordinates || null,
    overall_risk: brief.overall_risk || context?.backend_calculated_risk || 'Low/Unknown',
    risk_summary: brief.risk_summary,
    nearby_red_zones: Array.isArray(context?.nearby_red_zones)
      ? context.nearby_red_zones.map((zone) => compactStoredZone(zone, 'distance'))
      : brief.nearby_red_zones || [],
    nearby_yellow_zones: Array.isArray(context?.nearby_yellow_zones)
      ? context.nearby_yellow_zones.map((zone) => compactStoredZone(zone, 'distance'))
      : brief.nearby_yellow_zones || [],
    safety_tips: brief.safety_tips || [],
    recommended_actions: brief.recommended_actions || [],
    data_note: brief.data_note || context?.data_note,
  });
}

function buildStoredRouteContext(context, brief) {
  return sanitizeOutput({
    type: 'route_safety_check',
    origin_label: brief.origin_label || context?.origin_label || 'Current location',
    destination_label: brief.destination_label || context?.destination_label || 'Destination',
    mode: brief.mode || context?.mode || 'driving',
    overall_risk: brief.overall_risk || context?.backend_calculated_risk || 'Low/Unknown',
    route_summary: brief.route_summary,
    red_zones_on_route: Array.isArray(context?.red_zones_on_route)
      ? context.red_zones_on_route.map((zone) => compactStoredZone(zone, 'distance_from_route'))
      : brief.red_zones_on_route || [],
    yellow_zones_on_route: Array.isArray(context?.yellow_zones_on_route)
      ? context.yellow_zones_on_route.map((zone) => compactStoredZone(zone, 'distance_from_route'))
      : brief.yellow_zones_on_route || [],
    recommended_actions: brief.recommended_actions || [],
    map_actions: brief.map_actions || [],
    data_note: brief.data_note || context?.data_note,
  });
}

function lowerQuestion(question) {
  return normalizeLocationKey(question);
}

function detectSafetyIntent(kind, question) {
  const text = lowerQuestion(question);
  const has = (patterns) => patterns.some((pattern) => text.includes(pattern));

  if (kind === 'route') {
    if (has(['red zone', 'red zones', 'lal zone'])) return 'red_zones';
    if (has(['yellow zone', 'yellow zones'])) return 'yellow_zones';
    if (has(['highest risk', 'most risky', 'risky part', 'beshi risky', 'shobcheye risky'])) return 'highest_risk';
    if (has(['driving or walking', 'walk or drive', 'walking better', 'driving better', 'walking naki driving', 'drive naki walk'])) return 'mode_compare';
    if (has(['avoid', 'avoid korbo', 'avoid kora'])) return 'avoid';
    if (has(['what should i do', 'safety action', 'start korar age', 'before starting'])) return 'safety_actions';
    if (has(['short', 'summary', 'short kore'])) return 'short_version';
    if (has(['detailed', 'details', 'bistarito'])) return 'detailed_version';
    if (has(['safe', 'risky', 'risk', 'safe naki', 'risky naki'])) return 'route_safety';
    return 'route_safety';
  }

  if (has(['red zone', 'red zones', 'lal zone'])) return 'nearby_red_zones';
  if (has(['yellow zone', 'yellow zones'])) return 'nearby_yellow_zones';
  if (has(['avoid', 'avoid korbo', 'avoid kora'])) return 'avoid_area';
  if (has(['safety tip', 'tips', 'ki korbo', 'what should i do', 'unsafe lagle'])) return 'safety_tips';
  if (has(['high risk mean', 'high risk mane', 'risk mane'])) return 'high_risk_meaning';
  if (has(['unsafe', 'feel unsafe'])) return 'unsafe_feeling_action';
  if (has(['short', 'summary', 'short kore'])) return 'short_version';
  if (has(['detailed', 'details', 'bistarito'])) return 'detailed_version';
  return 'area_safety';
}

function isTranslationRequest(question) {
  return /translate|bengali|bangla|banglay|bangla te|বাংলা|অনুবাদ|বলো|বুঝিয়ে/i.test(String(question || ''));
}

function simpleBengaliSafetyNote(subject, zoneCount = 0, risk = 'Low/Unknown') {
  const riskText = String(risk || 'Low/Unknown');
  if (zoneCount > 0) {
    return `${subject} সম্পর্কে SheSafe-এর পাওয়া তথ্য অনুযায়ী ঝুঁকির মাত্রা ${riskText}। কাছাকাছি ${zoneCount}টি পরিচিত SheSafe ঝুঁকিপূর্ণ এলাকা পাওয়া গেছে। সম্ভব হলে ব্যস্ত ও আলোযুক্ত জায়গায় থাকুন, লাইভ লোকেশন শেয়ার করুন, এবং অনিরাপদ লাগলে SOS প্রস্তুত রাখুন।`;
  }
  return `${subject} সম্পর্কে SheSafe-এর পাওয়া তথ্য অনুযায়ী কাছাকাছি কোনো পরিচিত লাল/হলুদ ঝুঁকিপূর্ণ এলাকা পাওয়া যায়নি। তবে এটি নিরাপত্তার নিশ্চয়তা নয়। সতর্ক থাকুন, দরকার হলে লাইভ লোকেশন শেয়ার করুন, এবং অনিরাপদ লাগলে সাহায্য নিন।`;
}

function sortedRiskZones(redZones, yellowZones) {
  return [...redZones, ...yellowZones].sort((a, b) => {
    const typeScore = (zone) => String(zone?.type || '').toUpperCase() === 'RED' ? 2 : 1;
    if (typeScore(b) !== typeScore(a)) return typeScore(b) - typeScore(a);
    const incidents = Number(b?.incident_count || 0) - Number(a?.incident_count || 0);
    if (incidents !== 0) return incidents;
    return Number(a?.distance_m ?? Number.MAX_SAFE_INTEGER) - Number(b?.distance_m ?? Number.MAX_SAFE_INTEGER);
  });
}

function zoneNames(zones) {
  return zones.map((zone) => zone.name).filter(Boolean);
}

function zoneListSentence(zones, emptyText) {
  const names = zoneNames(zones);
  if (!names.length) return emptyText;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function defaultSafetyActions(actions) {
  return Array.isArray(actions) && actions.length
    ? actions
    : ['Use busier, well-lit roads where possible.', 'Share live location with someone trusted.', 'Keep SOS ready if you feel unsafe.'];
}

function makeFollowUpAnswer({
  title,
  answer,
  points = [],
  missing = [],
  actions = [],
  confidence = 'Medium',
}) {
  return normalizeSafetyFollowUp({
    answer_title: title,
    answer,
    supporting_points: points,
    not_available: missing,
    recommended_actions: actions,
    confidence,
    final_note: 'Based on available SheSafe safety data. This does not guarantee safety.',
  });
}

function buildRouteFollowUpFallback(context, question) {
  if (isTranslationRequest(question)) {
    const redZones = Array.isArray(context?.red_zones_on_route) ? context.red_zones_on_route : [];
    const yellowZones = Array.isArray(context?.yellow_zones_on_route) ? context.yellow_zones_on_route : [];
    const zoneCount = redZones.length + yellowZones.length;
    return makeFollowUpAnswer({
      title: 'বাংলা অনুবাদ',
      answer: simpleBengaliSafetyNote(`${context?.destination_label || 'এই রুট'}`, zoneCount, context?.overall_risk),
      points: [...redZones, ...yellowZones].map((zone) => `${zone.name}: ${zone.distance_from_route || 'দূরত্ব পাওয়া যায়নি'}`),
      actions: ['সম্ভব হলে ব্যস্ত রাস্তা ব্যবহার করুন।', 'বিশ্বস্ত কাউকে লাইভ লোকেশন শেয়ার করুন।', 'অনিরাপদ লাগলে SOS প্রস্তুত রাখুন।'],
      confidence: zoneCount ? 'Medium' : 'Low',
    });
  }
  const intent = detectSafetyIntent('route', question);
  const redZones = Array.isArray(context?.red_zones_on_route) ? context.red_zones_on_route : [];
  const yellowZones = Array.isArray(context?.yellow_zones_on_route) ? context.yellow_zones_on_route : [];
  const allZones = sortedRiskZones(redZones, yellowZones);
  const zoneCount = allZones.length;
  const redCount = redZones.length;
  const yellowCount = yellowZones.length;
  const mode = context?.mode || 'selected';
  const destination = context?.destination_label || 'your destination';
  const actions = defaultSafetyActions(context?.recommended_actions);
  const highest = allZones[0];

  if (intent === 'red_zones') {
    return makeFollowUpAnswer({
      title: 'Red Zones On Route',
      answer: redCount
        ? `This ${mode} route passes near ${redCount} red zone${redCount === 1 ? '' : 's'}: ${zoneListSentence(redZones, '')}. Be extra careful near these parts and avoid stopping there if possible.`
        : 'No red zones were found near this route in the available SheSafe data.',
      points: redZones.map((zone) => `${zone.name}: ${zone.distance_from_route || 'distance not available'}`),
      actions,
      confidence: redCount ? 'Medium' : 'Low',
    });
  }

  if (intent === 'yellow_zones') {
    return makeFollowUpAnswer({
      title: 'Yellow Zones On Route',
      answer: yellowCount
        ? `This ${mode} route passes near ${yellowCount} yellow zone${yellowCount === 1 ? '' : 's'}: ${zoneListSentence(yellowZones, '')}. Stay alert around these parts.`
        : 'No yellow zones were found near this route in the available SheSafe data.',
      points: yellowZones.map((zone) => `${zone.name}: ${zone.distance_from_route || 'distance not available'}`),
      actions,
      confidence: yellowCount ? 'Medium' : 'Low',
    });
  }

  if (intent === 'highest_risk') {
    return makeFollowUpAnswer({
      title: 'Highest Risk Part',
      answer: highest
        ? `The highest-risk part appears to be near ${highest.name}. It is ${String(highest.type || '').toLowerCase() === 'red' ? 'a red zone' : 'a known SheSafe risk zone'} and is close to this route.`
        : 'No highest-risk part could be identified because no SheSafe red/yellow zones were found near this route.',
      points: highest ? [
        `Nearest risk area: ${highest.name}`,
        `Distance from route: ${highest.distance_from_route || 'Not available'}`,
        `SheSafe incident activity in this result: ${highest.incident_count || 0}`,
      ] : [],
      actions,
      confidence: highest ? 'Medium' : 'Low',
    });
  }

  if (intent === 'mode_compare') {
    return makeFollowUpAnswer({
      title: 'Driving Or Walking',
      answer: `I only have safety data for this ${mode} route to ${destination}. To compare driving and walking, run Route Safety Check once for driving and once for walking. For this ${mode} route, SheSafe found ${redCount} red zone${redCount === 1 ? '' : 's'} and ${yellowCount} yellow zone${yellowCount === 1 ? '' : 's'} nearby.`,
      points: [`Checked mode: ${mode}`, `Known risk zones found: ${zoneCount}`],
      actions,
      confidence: 'Medium',
    });
  }

  if (intent === 'avoid') {
    return makeFollowUpAnswer({
      title: 'What To Avoid',
      answer: highest
        ? `Try to avoid stopping near ${highest.name}. Use busier, well-lit roads where possible and keep moving through quieter parts.`
        : 'No specific red/yellow zone was found to avoid on this route, but avoid isolated roads if you feel unsafe.',
      points: allZones.slice(0, 4).map((zone) => `${zone.name}: ${zone.distance_from_route || 'near route'}`),
      actions,
      confidence: highest ? 'Medium' : 'Low',
    });
  }

  if (intent === 'safety_actions') {
    return makeFollowUpAnswer({
      title: 'Safety Actions',
      answer: `Before starting this ${mode} route, share your live location, prefer busier roads, and keep SOS ready if you feel unsafe.`,
      points: zoneCount ? [`Known risk zones found: ${zoneCount}`] : ['No known red/yellow zones were found near this route.'],
      actions,
      confidence: 'Medium',
    });
  }

  if (intent === 'short_version') {
    return makeFollowUpAnswer({
      title: 'Short Version',
      answer: zoneCount
        ? `This ${mode} route has ${zoneCount} known SheSafe risk zone${zoneCount === 1 ? '' : 's'} nearby. Use busier roads and keep SOS ready.`
        : `No known SheSafe red/yellow zones were found near this ${mode} route, but this does not guarantee safety.`,
      points: [],
      actions,
      confidence: zoneCount ? 'Medium' : 'Low',
    });
  }

  if (intent === 'detailed_version') {
    return makeFollowUpAnswer({
      title: 'Detailed Route Safety',
      answer: zoneCount
        ? `This ${mode} route passes near ${redCount} red zone${redCount === 1 ? '' : 's'} and ${yellowCount} yellow zone${yellowCount === 1 ? '' : 's'}. The most important area to watch is ${highest?.name || 'the closest known risk area'}.`
        : `No known SheSafe red/yellow zones were found near this ${mode} route. Still stay alert, especially in quiet or poorly lit areas.`,
      points: allZones.map((zone) => `${zone.name}: ${zone.distance_from_route || 'near route'}`),
      actions,
      confidence: zoneCount ? 'Medium' : 'Low',
    });
  }

  return makeFollowUpAnswer({
    title: 'Route Safety',
    answer: zoneCount
      ? `This ${mode} route looks ${String(context?.overall_risk || '').toLowerCase() || 'risky'} because it passes near ${zoneCount} known SheSafe risk zone${zoneCount === 1 ? '' : 's'}. Use busier, well-lit roads where possible, share your live location, and keep SOS ready if you feel unsafe.`
      : `No known SheSafe red/yellow zones were found near this ${mode} route. This does not guarantee safety, so stay alert and share your live location if you feel unsafe.`,
    points: [`Known risk zones found: ${zoneCount}`, `Destination: ${destination}`],
    actions,
    confidence: zoneCount ? 'Medium' : 'Low',
  });
}

function buildAreaFollowUpFallback(context, question) {
  if (isTranslationRequest(question)) {
    const redZones = Array.isArray(context?.nearby_red_zones) ? context.nearby_red_zones : [];
    const yellowZones = Array.isArray(context?.nearby_yellow_zones) ? context.nearby_yellow_zones : [];
    const zoneCount = redZones.length + yellowZones.length;
    return makeFollowUpAnswer({
      title: 'বাংলা অনুবাদ',
      answer: simpleBengaliSafetyNote(context?.area_name || 'এই এলাকা', zoneCount, context?.overall_risk),
      points: [...redZones, ...yellowZones].map((zone) => `${zone.name}: ${zone.distance || 'দূরত্ব পাওয়া যায়নি'}`),
      actions: ['জনসমাগম আছে এমন জায়গায় থাকুন।', 'বিশ্বস্ত কাউকে লাইভ লোকেশন শেয়ার করুন।', 'অনিরাপদ লাগলে SOS ব্যবহার করুন।'],
      confidence: zoneCount ? 'Medium' : 'Low',
    });
  }
  const intent = detectSafetyIntent('area', question);
  const redZones = Array.isArray(context?.nearby_red_zones) ? context.nearby_red_zones : [];
  const yellowZones = Array.isArray(context?.nearby_yellow_zones) ? context.nearby_yellow_zones : [];
  const allZones = sortedRiskZones(redZones, yellowZones);
  const zoneCount = allZones.length;
  const area = context?.area_name || 'this area';
  const actions = defaultSafetyActions(context?.recommended_actions);
  const highest = allZones[0];

  if (intent === 'nearby_red_zones') {
    return makeFollowUpAnswer({
      title: 'Nearby Red Zones',
      answer: redZones.length
        ? `${redZones.length} red zone${redZones.length === 1 ? '' : 's'} were found near ${area}: ${zoneListSentence(redZones, '')}. Be extra careful around these places.`
        : `No red zones were found near ${area} in the available SheSafe data.`,
      points: redZones.map((zone) => `${zone.name}: ${zone.distance || 'distance not available'}`),
      actions,
      confidence: redZones.length ? 'Medium' : 'Low',
    });
  }

  if (intent === 'nearby_yellow_zones') {
    return makeFollowUpAnswer({
      title: 'Nearby Yellow Zones',
      answer: yellowZones.length
        ? `${yellowZones.length} yellow zone${yellowZones.length === 1 ? '' : 's'} were found near ${area}: ${zoneListSentence(yellowZones, '')}. Stay alert around these places.`
        : `No yellow zones were found near ${area} in the available SheSafe data.`,
      points: yellowZones.map((zone) => `${zone.name}: ${zone.distance || 'distance not available'}`),
      actions,
      confidence: yellowZones.length ? 'Medium' : 'Low',
    });
  }

  if (intent === 'avoid_area') {
    return makeFollowUpAnswer({
      title: 'What To Avoid',
      answer: highest
        ? `Be careful near ${highest.name}. Avoid isolated spots, quiet roads, and poorly lit areas if you feel unsafe.`
        : `No specific SheSafe red/yellow zone was found near ${area}, but avoid isolated or poorly lit places if you feel unsafe.`,
      points: allZones.slice(0, 4).map((zone) => `${zone.name}: ${zone.distance || 'nearby'}`),
      actions,
      confidence: highest ? 'Medium' : 'Low',
    });
  }

  if (intent === 'safety_tips' || intent === 'unsafe_feeling_action') {
    return makeFollowUpAnswer({
      title: 'Safety Tips',
      answer: `If you feel unsafe around ${area}, move toward a busier public place, share your live location with someone trusted, and use SOS if you need urgent help.`,
      points: zoneCount ? [`Known risk zones found: ${zoneCount}`] : ['No known red/yellow zones were found nearby.'],
      actions,
      confidence: 'Medium',
    });
  }

  if (intent === 'high_risk_meaning') {
    return makeFollowUpAnswer({
      title: 'What High Risk Means',
      answer: 'High risk means SheSafe found one or more nearby red zones in the available safety data. It does not mean danger is guaranteed, but you should be more careful.',
      points: zoneCount ? [`Known risk zones found: ${zoneCount}`] : ['No known red/yellow zones were found nearby.'],
      actions,
      confidence: 'Medium',
    });
  }

  if (intent === 'short_version') {
    return makeFollowUpAnswer({
      title: 'Short Version',
      answer: zoneCount
        ? `${area} has ${zoneCount} known SheSafe risk zone${zoneCount === 1 ? '' : 's'} nearby. Stay alert and keep SOS ready.`
        : `No known SheSafe red/yellow zones were found near ${area}. This does not guarantee safety.`,
      actions,
      confidence: zoneCount ? 'Medium' : 'Low',
    });
  }

  if (intent === 'detailed_version') {
    return makeFollowUpAnswer({
      title: 'Detailed Area Safety',
      answer: zoneCount
        ? `${area} has ${redZones.length} red zone${redZones.length === 1 ? '' : 's'} and ${yellowZones.length} yellow zone${yellowZones.length === 1 ? '' : 's'} nearby. The most important place to watch is ${highest?.name || 'the closest known risk area'}.`
        : `No known SheSafe red/yellow zones were found near ${area}. Still stay alert, especially in quiet or poorly lit places.`,
      points: allZones.map((zone) => `${zone.name}: ${zone.distance || 'nearby'}`),
      actions,
      confidence: zoneCount ? 'Medium' : 'Low',
    });
  }

  return makeFollowUpAnswer({
    title: 'Area Safety',
    answer: zoneCount
      ? `${area} has ${zoneCount} known SheSafe risk zone${zoneCount === 1 ? '' : 's'} nearby. Stay alert, avoid isolated places if you feel unsafe, and keep SOS ready.`
      : `No known SheSafe red/yellow zones were found near ${area}. This does not guarantee safety, so stay alert and share your live location if you feel unsafe.`,
    points: [`Known risk zones found: ${zoneCount}`],
    actions,
    confidence: zoneCount ? 'Medium' : 'Low',
  });
}

function buildFallbackSafetyFollowUp(kind, context, question) {
  return kind === 'route'
    ? buildRouteFollowUpFallback(context, question)
    : buildAreaFollowUpFallback(context, question);
}

function buildFallbackIncidentSummary(context) {
  const responders = Array.isArray(context?.responders) ? context.responders : [];
  const messages = Array.isArray(context?.chat_messages) ? context.chat_messages : [];
  const userMessages = messages.filter((message) => message.sender_role === 'user');
  const responderMessages = messages.filter((message) => ['volunteer', 'admin'].includes(message.sender_role));
  return normalizeSummary({
    report_title: 'Incident Summary',
    incident_status: context?.incident?.status || 'Unknown',
    incident_code: context?.incident?.incident_code || context?.incident?.short_code || 'Not mentioned',
    location: context?.incident?.address || 'Not mentioned',
    victim: context?.victim || { name: 'Not mentioned', role: 'Not mentioned' },
    responders: responders.map((responder) => ({
      name: responder.name,
      role: responder.role,
      action: responder.action || 'Responded to this incident',
    })),
    short_summary: `Based on the available SheSafe information, this incident was reported near ${context?.incident?.address || 'the shared location'}. The current status is ${context?.incident?.status || 'unknown'}.`,
    what_happened: userMessages[0]?.content
      ? `The user reported: "${userMessages[0].content}"`
      : 'The available chat does not include a clear user description.',
    chat_understanding: messages.length
      ? 'The chat has limited but useful incident information. The summary is based only on available messages.'
      : 'No chat messages were available for this summary.',
    timeline: [
      context?.incident?.created_at ? `Incident created: ${formatDateTime(context.incident.created_at)}` : 'Incident creation time was not mentioned.',
      context?.incident?.accepted_at ? `Responder accepted: ${formatDateTime(context.incident.accepted_at)}` : 'Responder accepted time was not mentioned.',
      context?.incident?.resolved_at ? `Incident resolved: ${formatDateTime(context.incident.resolved_at)}` : '',
    ].filter(Boolean),
    victim_reported_concerns: userMessages.slice(0, 5).map((message) => message.content),
    responder_actions: responderMessages.slice(0, 5).map((message) => message.content),
    important_chat_points: messages.slice(-5).map((message) => `${message.sender_role}: ${message.content}`),
    unresolved_items: ['Confirm the user’s current safety if the incident is not resolved.'],
    safety_notes: ['Your safety comes first. Use SOS or emergency support if danger feels immediate.'],
    current_or_final_outcome: context?.incident?.status === 'RESOLVED'
      ? 'The incident is marked resolved in the available information.'
      : 'The final outcome was not fully clear from the available information.',
    confidence: messages.length ? 'Medium' : 'Low',
    final_note: 'Showing summary based on available SheSafe incident information.',
  });
}

function detectIncidentIntent(question) {
  const text = lowerQuestion(question);
  if (isTranslationRequest(question)) return 'translate';
  if (isBreakdownRequest(question)) return 'breakdown';
  if (/who helped|ke help|ke respond|volunteer|helper|সাহায্য|রেসপন্ড/.test(text)) return 'who_helped';
  if (/timeline|time|step|ঘটনাক্রম|সময়/.test(text)) return 'timeline';
  if (/volunteer action|responder action|ki korse|কি করেছে/.test(text)) return 'volunteer_actions';
  if (/unresolved|missing|baki|বাকি|অসম্পূর্ণ/.test(text)) return 'unresolved';
  if (/explain|point|bujhi|সহজ|easy/.test(text)) return 'explain';
  return 'summary';
}

function buildFallbackIncidentFollowUp(context, question) {
  const intent = detectIncidentIntent(question);
  const responders = Array.isArray(context?.responders) ? context.responders : [];
  const messages = Array.isArray(context?.chat_messages) ? context.chat_messages : [];
  const responderMessages = messages.filter((message) => ['volunteer', 'admin'].includes(message.sender_role));
  if (intent === 'translate') {
    return normalizeFollowUp({
      answer_title: 'বাংলা অনুবাদ',
      answer: `উপলব্ধ SheSafe তথ্য অনুযায়ী ঘটনাটি ${context?.incident?.address || 'শেয়ার করা লোকেশন'} এলাকায় রিপোর্ট করা হয়েছিল। বর্তমান অবস্থা ${context?.incident?.status || 'অজানা'}। চ্যাট ও ঘটনার তথ্য সীমিত হলে কিছু বিষয় নিশ্চিতভাবে বলা যায় না।`,
      supporting_points: responders.map((responder) => `${responder.name}: ${responder.action || 'সহায়তার জন্য যুক্ত ছিলেন'}`),
      not_mentioned: [],
      confidence: messages.length ? 'Medium' : 'Low',
      final_note: 'উপলব্ধ ঘটনার তথ্যের ভিত্তিতে বলা হয়েছে।',
    });
  }
  if (intent === 'who_helped') {
    return normalizeFollowUp({
      answer_title: 'Who Helped',
      answer: responders.length
        ? `The available incident information shows ${zoneListSentence(responders.map((responder) => ({ name: responder.name })), 'a responder')} helped or responded to this incident.`
        : 'The available information does not mention a responder name.',
      supporting_points: responders.map((responder) => `${responder.name}: ${responder.action || 'Responded'}`),
      not_mentioned: responders.length ? [] : ['Responder name was not available.'],
      confidence: responders.length ? 'Medium' : 'Low',
      final_note: 'Based on available incident information.',
    });
  }
  if (intent === 'timeline') {
    return normalizeFollowUp({
      answer_title: 'Timeline',
      answer: 'Here is the timeline from the available incident information.',
      supporting_points: [
        context?.incident?.created_at ? `Created: ${formatDateTime(context.incident.created_at)}` : '',
        context?.incident?.accepted_at ? `Accepted: ${formatDateTime(context.incident.accepted_at)}` : '',
        context?.incident?.resolved_at ? `Resolved: ${formatDateTime(context.incident.resolved_at)}` : '',
      ].filter(Boolean),
      not_mentioned: [],
      confidence: 'Medium',
      final_note: 'Some times may be missing if they were not recorded.',
    });
  }
  if (intent === 'volunteer_actions') {
    return normalizeFollowUp({
      answer_title: 'Responder Actions',
      answer: responderMessages.length
        ? 'These responder messages/actions were available in the incident chat.'
        : 'Responder actions were not clearly mentioned in the available chat.',
      supporting_points: responderMessages.slice(0, 6).map((message) => message.content),
      not_mentioned: responderMessages.length ? [] : ['Responder chat actions were not available.'],
      confidence: responderMessages.length ? 'Medium' : 'Low',
      final_note: 'Based on available chat and incident information.',
    });
  }
  if (intent === 'unresolved') {
    return normalizeFollowUp({
      answer_title: 'Unresolved Items',
      answer: 'The main thing to confirm is whether the user is currently safe and whether the incident has fully ended.',
      supporting_points: [`Current status: ${context?.incident?.status || 'Unknown'}`],
      not_mentioned: ['Final safety confirmation may not be available.'],
      confidence: 'Medium',
      final_note: 'Based on available incident information.',
    });
  }
  if (intent === 'breakdown') {
    return normalizeFollowUp({
      answer_title: 'Broken Down Simply',
      answer: 'Okay, let’s break this down slowly. The important parts are where it happened, who responded, what the user reported, and what still needs confirmation.',
      supporting_points: [
        `Location: ${context?.incident?.address || 'Not mentioned'}`,
        `Status: ${context?.incident?.status || 'Unknown'}`,
        `Responders: ${responders.length ? responders.map((responder) => responder.name).join(', ') : 'Not mentioned'}`,
        'If the incident is not resolved, the current safety of the user should be confirmed.',
      ],
      not_mentioned: [],
      confidence: messages.length ? 'Medium' : 'Low',
      final_note: 'Based on available incident information.',
    });
  }
  return normalizeFollowUp({
    answer_title: 'Incident Follow-up',
    answer: `Based on available SheSafe information, the incident was near ${context?.incident?.address || 'the shared location'} and status is ${context?.incident?.status || 'unknown'}.`,
    supporting_points: messages.slice(-3).map((message) => `${message.sender_role}: ${message.content}`),
    not_mentioned: [],
    confidence: messages.length ? 'Medium' : 'Low',
    final_note: 'Based on available incident information.',
  });
}

async function generateIncidentSummaryFromContext(context) {
  const summary = await generateStructuredJson({
    prompt: buildSummaryPrompt(context),
    schema: summarySchema,
    invalidJsonMessage: 'Gemini returned invalid incident summary JSON.',
  });
  return normalizeSummary(summary);
}

async function answerIncidentFollowUpFromContext(context, question) {
  const answer = await generateStructuredJson({
    prompt: buildFollowUpPrompt(context, question),
    schema: followUpSchema,
    invalidJsonMessage: 'Gemini returned invalid incident follow-up JSON.',
  });
  return normalizeFollowUp(answer);
}

async function generateAreaBriefFromContext(context) {
  const brief = await generateStructuredJson({
    prompt: buildAreaPrompt(context),
    schema: areaBriefSchema,
    invalidJsonMessage: 'Gemini returned invalid area safety JSON.',
    fallbackMessage: 'Could not generate area safety brief right now.',
  });
  return normalizeAreaBrief(brief);
}

async function generateRouteBriefFromContext(context) {
  const brief = await generateStructuredJson({
    prompt: buildRoutePrompt(context),
    schema: routeBriefSchema,
    invalidJsonMessage: 'Gemini returned invalid route safety JSON.',
    fallbackMessage: 'Could not generate route safety check right now.',
  });
  return normalizeRouteBrief(brief);
}

async function answerSafetyFollowUpFromContext(kind, context, question) {
  const answer = await generateStructuredJson({
    prompt: buildSafetyFollowUpPrompt(kind, context, question),
    schema: safetyFollowUpSchema,
    invalidJsonMessage: 'Gemini returned invalid safety follow-up JSON.',
    fallbackMessage: 'Could not answer this safety follow-up right now.',
  });
  return normalizeSafetyFollowUp(answer);
}

async function generateIncidentSummary(rawIncidentId, user) {
  const context = await getEnrichedIncidentContext(rawIncidentId, user);
  let summary;
  try {
    summary = await generateIncidentSummaryFromContext(context);
  } catch (error) {
    logAiSafety('incident summary gemini failed', { category: geminiFailureCategory(error) });
    summary = buildFallbackIncidentSummary(context);
  }
  return {
    success: true,
    type: 'summary',
    incidentId: context.incident.id,
    data: summary,
  };
}

async function buildAreaContext(payload, locationResolution = null) {
  const area = sanitizeText(payload?.area || '');
  const hasGoogleMapsKey = Boolean(getMapsApiKey());
  const zones = await loadPreparedZones();
  logAiSafety('zone query completed', { context: 'area', zoneCount: zones.length });
  let target = null;
  let matched = [];

  if (payload?.latitude != null || payload?.longitude != null) {
    target = validateLatLng(payload, 'area coordinates');
    target.label = area || 'Current location';
    matched = findZonesNearPoint(target, zones, AREA_RADIUS_M);
  } else if (area) {
    const resolvedArea = locationResolution?.query || area;
    const displayArea = locationResolution?.label || area;
    target = await geocodeArea(resolvedArea);
    matched = target ? findZonesNearPoint(target, zones, AREA_RADIUS_M) : findZonesByAreaName(displayArea, zones);
    if (!matched.length && displayArea !== area) {
      matched = findZonesByAreaName(area, zones);
    }
    if (!target && matched.length) {
      target = {
        label: displayArea,
        latitude: matched[0].zone.latitude,
        longitude: matched[0].zone.longitude,
      };
    }
    if (!target && !matched.length && !hasGoogleMapsKey && locationResolution?.confidence === 'original') {
      throw httpError(500, 'Area geocoding is not configured. Missing backend Google Maps API key.');
    }
    if (!target) {
      target = { label: displayArea, latitude: null, longitude: null };
    }
  } else {
    throw httpError(400, 'Use your current location or enter an area name first.');
  }

  const redZones = matched
    .filter((item) => zoneType(item.zone) === 'RED')
    .slice(0, AREA_ZONE_LIMIT)
    .map((item) => safeZone(item.zone, item.distanceM, 'distance'));
  const yellowZones = matched
    .filter((item) => zoneType(item.zone) === 'YELLOW')
    .slice(0, AREA_ZONE_LIMIT)
    .map((item) => safeZone(item.zone, item.distanceM, 'distance'));

  const riskLevel = redZones.length ? 'High' : yellowZones.length ? 'Moderate' : 'Low/Unknown';
  return sanitizeOutput({
    type: 'area_safety_brief',
    source: 'SheSafe area safety data',
    area_name: target.label || area || 'Selected area',
    coordinates: {
      latitude: target.latitude,
      longitude: target.longitude,
    },
    backend_calculated_risk: riskLevel,
    nearby_red_zones: redZones,
    nearby_yellow_zones: yellowZones,
    total_matched_zones: redZones.length + yellowZones.length,
    display_note: matched.length > AREA_ZONE_LIMIT ? 'Showing closest matched zones.' : null,
    data_note: matched.length
      ? 'Based on available SheSafe red/yellow zone data. This does not guarantee safety.'
      : 'No SheSafe red/yellow zone data was found for this area. This does not guarantee safety.',
  });
}

async function generateAreaBrief(payload) {
  const area = sanitizeText(payload?.area || '');
  const locationResolution = area ? resolveLocationInput(area) : null;
  logAiSafety('area-brief service started', {
    mode: area ? 'area' : 'coordinates',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGoogleMapsKey: Boolean(getMapsApiKey()),
  });
  if (locationResolution?.needsClarification) {
    return buildClarificationResponse(
      'area',
      'I could not confidently identify that area. Please choose one of these or type the area name again.',
      locationResolution.suggestions
    );
  }

  let context;
  try {
    context = await buildAreaContext(payload, locationResolution);
  } catch (error) {
    if (Number(error?.status || 0) === 400 && /location|area/i.test(String(error?.message || ''))) {
      return buildClarificationResponse(
        'area',
        'I could not confidently find this area. Please check the spelling or choose a suggestion.',
        locationResolution?.suggestions || KNOWN_LOCATION_ALIASES.slice(0, 5).map((entry) => entry.label)
      );
    }
    throw error;
  }
  let brief;
  try {
    logAiSafety('gemini call started', { context: 'area' });
    brief = await generateAreaBriefFromContext(context);
    logAiSafety('gemini call succeeded', { context: 'area' });
  } catch (error) {
    logAiSafety('gemini call failed', { context: 'area', message: error?.message || 'AI unavailable' });
    brief = buildFallbackAreaBrief(context);
  }
  const contextId = storeSafetyContext('area', buildStoredAreaContext(context, brief));
  logAiSafety('area-brief response ready', { type: 'area_brief', risk: brief.overall_risk });
  return {
    success: true,
    type: 'area_brief',
    contextId,
    data: brief,
  };
}

async function buildRouteContext(payload, locationResolution = null) {
  const origin = validateLatLng(payload?.origin, 'origin');
  const destination = sanitizeText(payload?.destination || '');
  if (!destination) throw httpError(400, 'Enter a destination first.');
  const mode = validateMode(payload?.mode);
  if (!getMapsApiKey()) {
    throw httpError(500, 'Route safety is not configured. Missing backend Google Maps API key.');
  }
  const resolvedDestination = locationResolution?.query || destination;
  const destinationTarget = await geocodeArea(resolvedDestination);
  if (!destinationTarget) {
    throw httpError(400, 'Could not find that destination. Please check the spelling or choose a more specific Dhaka location.');
  }
  const route = await fetchDirectionsRoute(origin, destinationTarget, mode);
  const zones = await loadPreparedZones();
  logAiSafety('zone query completed', { context: 'route', zoneCount: zones.length });
  logAiSafety('route distance check started', {
    routePointCount: route.points.length,
    firstRoutePoint: route.points[0],
    lastRoutePoint: route.points[route.points.length - 1],
  });
  const threshold = ROUTE_THRESHOLDS_M[mode] || ROUTE_THRESHOLDS_M.driving;

  const matchedZones = zones
    .map((zone) => {
      const distanceM = minDistanceToRouteM(zone, route.points);
      const radiusM = zoneRadiusM(zone);
      const matched = distanceM <= radiusM + threshold;
      logAiSafety('route zone candidate', {
        name: zone.name,
        zoneLatitude: zone.latitude,
        zoneLongitude: zone.longitude,
        distanceM: Math.round(distanceM),
        radiusM,
        matched,
      });
      return { zone, distanceM, matched };
    })
    .filter((item) => item.matched)
    .sort((a, b) => a.distanceM - b.distanceM);

  const redZones = matchedZones
    .filter((item) => zoneType(item.zone) === 'RED')
    .slice(0, ROUTE_ZONE_LIMIT)
    .map((item) => safeZone(item.zone, item.distanceM, 'distance_from_route'));
  const yellowZones = matchedZones
    .filter((item) => zoneType(item.zone) === 'YELLOW')
    .slice(0, ROUTE_ZONE_LIMIT)
    .map((item) => safeZone(item.zone, item.distanceM, 'distance_from_route'));

  const riskLevel = redZones.length ? 'High' : yellowZones.length ? 'Moderate' : 'Low/Unknown';
  return sanitizeOutput({
    type: 'route_safety_check',
    source: 'SheSafe route safety data',
    origin_label: route.origin_label,
    destination_label: route.destination_label,
    mode,
    route_distance: route.distance_text,
    route_duration: route.duration_text,
    backend_calculated_risk: riskLevel,
    red_zones_on_route: redZones,
    yellow_zones_on_route: yellowZones,
    total_matched_zones: redZones.length + yellowZones.length,
    display_note: matchedZones.length > ROUTE_ZONE_LIMIT ? 'Showing closest matched zones.' : null,
    data_note: matchedZones.length
      ? 'Based on available SheSafe red/yellow zone data near this route. This does not guarantee safety.'
      : 'No SheSafe red/yellow zones were found near this route in available data. This does not guarantee safety.',
  });
}

async function generateRouteRiskBrief(payload) {
  const destination = sanitizeText(payload?.destination || '');
  const locationResolution = destination ? resolveLocationInput(destination) : null;
  logAiSafety('route-risk-brief service started', {
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGoogleMapsKey: Boolean(getMapsApiKey()),
    mode: validateMode(payload?.mode),
  });
  if (locationResolution?.needsClarification) {
    return buildClarificationResponse(
      'route',
      'I could not confidently identify that destination. Please choose one of these or type the destination again.',
      locationResolution.suggestions
    );
  }

  let context;
  try {
    context = await buildRouteContext(payload, locationResolution);
  } catch (error) {
    if (Number(error?.status || 0) === 400 && /route|destination|location/i.test(String(error?.message || ''))) {
      return buildClarificationResponse(
        'route',
        'I could not find a usable route to that destination. Please check the spelling or choose a more specific Dhaka location.',
        locationResolution?.suggestions || KNOWN_LOCATION_ALIASES.slice(0, 4).map((entry) => entry.label)
      );
    }
    throw error;
  }
  let brief;
  try {
    logAiSafety('gemini call started', { context: 'route' });
    brief = await generateRouteBriefFromContext(context);
    logAiSafety('gemini call succeeded', { context: 'route' });
  } catch (error) {
    logAiSafety('gemini call failed', { context: 'route', message: error?.message || 'AI unavailable' });
    brief = buildFallbackRouteBrief(context);
  }
  const contextId = storeSafetyContext('route', buildStoredRouteContext(context, brief));
  logAiSafety('route-risk-brief response ready', { type: 'route_risk_brief', risk: brief.overall_risk });
  return {
    success: true,
    type: 'route_risk_brief',
    contextId,
    data: brief,
  };
}

async function answerAreaBriefFollowUp(payload) {
  const question = validateQuestion(payload?.question);
  const context = loadSafetyContext(payload?.contextId, 'area');
  let answer;
  try {
    answer = await answerSafetyFollowUpFromContext('area', context, question);
  } catch (error) {
    logAiSafety('gemini follow-up failed', { context: 'area', category: geminiFailureCategory(error) });
    answer = buildFallbackSafetyFollowUp('area', context, question);
  }
  return {
    success: true,
    type: 'area_follow_up',
    contextId: payload.contextId,
    data: answer,
  };
}

async function answerRouteRiskBriefFollowUp(payload) {
  const question = validateQuestion(payload?.question);
  const context = loadSafetyContext(payload?.contextId, 'route');
  let answer;
  try {
    answer = await answerSafetyFollowUpFromContext('route', context, question);
  } catch (error) {
    logAiSafety('gemini follow-up failed', { context: 'route', category: geminiFailureCategory(error) });
    answer = buildFallbackSafetyFollowUp('route', context, question);
  }
  return {
    success: true,
    type: 'route_follow_up',
    contextId: payload.contextId,
    data: answer,
  };
}

async function getVolunteerGuidanceContext(rawIncidentId, user) {
  const incidentId = validateIncidentId(rawIncidentId);
  const role = String(user?.role || '').toLowerCase();
  if (!['volunteer', 'admin'].includes(role)) {
    throw httpError(403, 'Volunteer guidance is available for authorized volunteers responding to an incident.');
  }
  const allowed = await canVolunteerRespondToIncident(incidentId, user);
  if (!allowed) {
    throw httpError(403, 'Volunteer guidance is available for authorized volunteers responding to an incident.');
  }
  const context = await getEnrichedIncidentContext(incidentId, user);
  return sanitizeOutput({
    incident: context.incident,
    victim: context.victim,
    responders: context.responders,
    system_events: context.system_events,
    recent_chat: context.chat_messages.slice(-30),
    sanitized_chat_summary_source: context.sanitized_chat_transcript,
    safety_rules: [
      'Volunteer safety comes first.',
      'Avoid confrontation.',
      'Stay in public or well-lit areas when possible.',
      'Wait for help if the situation looks unsafe.',
    ],
  });
}

async function generateVolunteerGuidance(rawIncidentId, user, payload = {}) {
  if (payload?.currentVolunteerLocation) {
    validateLatLng(payload.currentVolunteerLocation, 'current volunteer location');
  }
  const context = await getVolunteerGuidanceContext(rawIncidentId, user);
  let guidance;
  try {
    guidance = normalizeVolunteerGuidance(await generateStructuredJson({
      prompt: buildVolunteerGuidancePrompt(context),
      schema: volunteerGuidanceSchema,
      invalidJsonMessage: 'Gemini returned invalid volunteer guidance JSON.',
      fallbackMessage: 'Could not generate volunteer guidance right now.',
    }));
  } catch (error) {
    logAiSafety('volunteer guidance gemini failed', { category: geminiFailureCategory(error) });
    guidance = buildFallbackVolunteerGuidance(context);
  }
  return {
    success: true,
    type: 'volunteer_guidance',
    incidentId: context.incident.id,
    data: guidance,
  };
}

async function answerVolunteerGuidanceFollowUp(rawIncidentId, rawQuestion, user) {
  const question = validateQuestion(rawQuestion);
  const context = await getVolunteerGuidanceContext(rawIncidentId, user);
  let answer;
  try {
    answer = normalizeSafetyFollowUp(await generateStructuredJson({
      prompt: buildVolunteerFollowUpPrompt(context, question),
      schema: safetyFollowUpSchema,
      invalidJsonMessage: 'Gemini returned invalid volunteer follow-up JSON.',
      fallbackMessage: 'Could not answer volunteer guidance follow-up right now.',
    }));
  } catch (error) {
    logAiSafety('volunteer follow-up gemini failed', { category: geminiFailureCategory(error) });
    answer = buildFallbackVolunteerFollowUp(context, question);
  }
  return {
    success: true,
    type: 'volunteer_guidance_follow_up',
    incidentId: context.incident.id,
    data: answer,
  };
}

async function generateFirstAidGuide(payload = {}) {
  const { categoryKey, category, question } = validateFirstAidInput(payload);
  let guide;
  try {
    guide = normalizeFirstAidGuide(await generateStructuredJson({
      prompt: buildFirstAidPrompt(category, question),
      schema: firstAidGuideSchema,
      invalidJsonMessage: 'Gemini returned invalid first-aid JSON.',
      fallbackMessage: 'Could not generate first-aid guide right now.',
    }));
  } catch (error) {
    logAiSafety('first aid gemini failed', { category: geminiFailureCategory(error) });
    guide = fallbackFirstAidGuide(categoryKey, category, question);
  }
  return {
    success: true,
    type: 'first_aid_guide',
    data: guide,
  };
}

async function answerFirstAidFollowUp(payload = {}) {
  const { categoryKey, category, question } = validateFirstAidInput(payload);
  let answer;
  if (isMedicineRequest(question)) {
    answer = normalizeSafetyFollowUp({
      answer_title: 'Medicine Advice Not Available',
      answer: "I can't give medicine or dosage advice. Please contact a medical professional.",
      supporting_points: [],
      not_available: ['Medicine or dosage advice is not available in this guide.'],
      recommended_actions: ['Contact a doctor, pharmacist, or emergency service if symptoms are serious.'],
      confidence: 'High',
      final_note: 'This is general safety guidance, not medical diagnosis or prescription advice.',
    });
  } else {
    try {
      answer = normalizeSafetyFollowUp(await generateStructuredJson({
        prompt: buildFirstAidFollowUpPrompt(category, question, payload.previousGuide),
        schema: safetyFollowUpSchema,
        invalidJsonMessage: 'Gemini returned invalid first-aid follow-up JSON.',
        fallbackMessage: 'Could not answer first-aid follow-up right now.',
      }));
    } catch (error) {
      logAiSafety('first aid follow-up gemini failed', { category: geminiFailureCategory(error) });
      answer = buildFallbackFirstAidFollowUp(categoryKey, category, question);
    }
  }
  return {
    success: true,
    type: 'first_aid_follow_up',
    data: answer,
  };
}

function parseQuery(rawQuery) {
  const queryText = normalizeText(rawQuery);
  if (queryText.length < 2 || queryText.length > 240) {
    throw httpError(400, 'Query must be between 2 and 240 characters.');
  }

  const lower = queryText.toLowerCase();
  const statusMap = [
    ['RESOLVED', /\b(resolved|closed|completed)\b/i],
    ['CANCELLED', /\b(cancelled|canceled)\b/i],
    ['ACTIVE', /\b(active|live|open|ongoing)\b/i],
    ['IN_PROGRESS', /\b(in progress|responding|accepted)\b/i],
  ];
  const statusHint = statusMap.find(([, pattern]) => pattern.test(queryText))?.[0] || null;
  const wantsLast = /\b(last|latest|recent|most recent)\b/i.test(queryText);

  const codeMatch = queryText.match(/\b(?:incident|case|code|sos)\s*#?\s*([A-Za-z0-9-]{2,24})\b/i);
  const codeCandidate = codeMatch?.[1] ? codeMatch[1].toUpperCase().replace(/^SOS-/, '') : null;
  const shortCode = codeCandidate && /\d/.test(codeCandidate) ? codeCandidate : null;

  let locationKeyword = queryText;
  const locationMatch = queryText.match(/\b(?:of|in|near|at|around)\s+(.+?)(?:\s+incident)?$/i);
  if (locationMatch?.[1]) {
    locationKeyword = locationMatch[1];
  }

  locationKeyword = locationKeyword
    .replace(/\b(give|show|tell|summarize|summary|incident|report|what|happened|about|the|me|my|please|last|latest|recent|resolved|closed|completed|cancelled|canceled|active|live|open|ongoing|in progress|responding|accepted|of|in|near|at|around)\b/gi, ' ')
    .replace(/\b(?:sos[-\s#]*)?[A-Za-z0-9-]{2,24}\b/gi, (match) => {
      if (!shortCode) return match;
      const normalized = match.toUpperCase().replace(/^SOS[-\s#]*/, '');
      return normalized === shortCode ? ' ' : match;
    })
    .replace(/\s+/g, ' ')
    .trim();

  if (locationKeyword.length < 2) locationKeyword = null;

  return { queryText, lower, statusHint, wantsLast, shortCode, locationKeyword };
}

function scoreIncident(incident, parsed) {
  let score = 0;
  const status = String(incident.status || '').toUpperCase();
  const address = String(incident.address || '').toLowerCase();
  const id = String(incident.id);
  const code = displayShortCode(incident).toUpperCase();

  if (parsed.statusHint) {
    if (status !== parsed.statusHint) return 0;
    score += 25;
  }

  if (parsed.shortCode) {
    const queryCode = parsed.shortCode.toUpperCase();
    const matchesCode = id === queryCode || code === `SOS-${queryCode}` || code === queryCode || `#${id}` === queryCode;
    if (!matchesCode) return 0;
    score += 80;
  }

  if (parsed.locationKeyword) {
    const terms = parsed.locationKeyword.toLowerCase().split(/\s+/).filter(Boolean);
    const matchedTerms = terms.filter((term) => address.includes(term));
    if (!matchedTerms.length) return 0;
    score += matchedTerms.length * 12;
    if (matchedTerms.length === terms.length) score += 20;
  }

  if (!parsed.shortCode && !parsed.locationKeyword && !parsed.statusHint && !parsed.wantsLast) {
    const terms = parsed.lower.split(/\s+/).filter((term) => term.length > 2);
    const matchedTerms = terms.filter((term) => address.includes(term));
    if (!matchedTerms.length) return 0;
    score += matchedTerms.length * 8;
  }

  if (parsed.wantsLast) score += 10;
  return score;
}

function toSelectionMatch(incident) {
  return {
    incidentId: String(incident.id),
    title: safeTitle(incident),
    status: incident.status || 'UNKNOWN',
    date: dateOnly(incident.created_at),
    shortCode: displayShortCode(incident),
  };
}

async function searchIncidentSummary(rawQuery, user) {
  const parsed = parseQuery(rawQuery);
  const incidents = await listAccessibleIncidents(user);

  const scored = incidents
    .map((incident) => ({ incident, score: scoreIncident(incident, parsed) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.incident.created_at).getTime() - new Date(a.incident.created_at).getTime();
    });

  if (!scored.length) {
    return { success: true, type: 'no_match', message: NO_MATCH_MESSAGE };
  }

  if (parsed.wantsLast || parsed.shortCode || scored.length === 1) {
    return generateIncidentSummary(scored[0].incident.id, user);
  }

  return {
    success: true,
    type: 'needs_selection',
    matches: scored.slice(0, 10).map((item) => toSelectionMatch(item.incident)),
  };
}

async function answerIncidentFollowUp(rawIncidentId, rawQuestion, user) {
  const question = validateQuestion(rawQuestion);
  const context = await getEnrichedIncidentContext(rawIncidentId, user);
  let answer;
  try {
    answer = await answerIncidentFollowUpFromContext(context, question);
  } catch (error) {
    logAiSafety('incident follow-up gemini failed', { category: geminiFailureCategory(error) });
    answer = buildFallbackIncidentFollowUp(context, question);
  }
  return {
    success: true,
    type: 'follow_up',
    incidentId: context.incident.id,
    data: answer,
  };
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
  getEnrichedIncidentContext,
  canUserAccessIncident,
  generateIncidentSummaryFromContext,
  answerIncidentFollowUpFromContext,
};
