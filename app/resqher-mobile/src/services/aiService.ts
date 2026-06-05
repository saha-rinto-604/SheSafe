import api from './api';

export type IncidentSummary = {
  report_title: string;
  incident_status: string;
  incident_code: string;
  location: string;
  victim: {
    name: string;
    role: string;
  };
  responders: {
    name: string;
    role: string;
    action: string;
  }[];
  short_summary: string;
  what_happened: string;
  chat_understanding: string;
  timeline: string[];
  victim_reported_concerns: string[];
  responder_actions: string[];
  important_chat_points: string[];
  unresolved_items: string[];
  safety_notes: string[];
  current_or_final_outcome: string;
  confidence: string;
  final_note: string;
};

export type IncidentFollowUpAnswer = {
  answer_title: string;
  answer: string;
  supporting_points: string[];
  not_mentioned: string[];
  confidence: string;
  final_note: string;
};

export type SafetyFollowUpAnswer = {
  answer_title: string;
  emotional_opening?: string;
  direct_answer?: string;
  answer: string;
  breakdown?: {
    point: string;
    simple_explanation: string;
    why_it_matters: string;
    what_to_do_next: string;
  }[];
  example_words_to_say?: string[];
  supporting_points: string[];
  not_available: string[];
  recommended_actions: string[];
  what_to_avoid?: string[];
  urgent_help_signs?: string[];
  confidence: string;
  final_note: string;
};

export type AreaSafetyBrief = {
  title: string;
  area_name: string;
  overall_risk: string;
  risk_summary: string;
  nearby_red_zones: {
    name: string;
    distance: string;
    reason: string;
  }[];
  nearby_yellow_zones: {
    name: string;
    distance: string;
    reason: string;
  }[];
  safety_tips: string[];
  recommended_actions: string[];
  data_note: string;
  confidence: string;
};

export type RouteSafetyBrief = {
  title: string;
  origin_label: string;
  destination_label: string;
  mode: string;
  overall_risk: string;
  route_summary: string;
  red_zones_on_route: {
    name: string;
    distance_from_route: string;
    reason: string;
    advice: string;
  }[];
  yellow_zones_on_route: {
    name: string;
    distance_from_route: string;
    reason: string;
    advice: string;
  }[];
  recommended_actions: string[];
  map_actions: string[];
  data_note: string;
  confidence: string;
};

export type VolunteerGuidance = {
  title: string;
  incident_status: string;
  risk_level: string;
  situation_summary: string;
  first_priority: string;
  approach_guidance: string[];
  communication_tips: string[];
  do_not_do: string[];
  when_to_stop_or_wait: string[];
  missing_information: string[];
  recommended_next_steps: string[];
  confidence: string;
  final_note: string;
};

export type FirstAidGuide = {
  title: string;
  category: string;
  quick_summary: string;
  first_steps: string[];
  do_not_do: string[];
  when_to_get_help: string[];
  safety_reminder: string;
  confidence: string;
  final_note: string;
};

export type SafetyClarificationResponse = {
  success: true;
  type: 'clarification';
  context: 'area' | 'route';
  message: string;
  suggestions: string[];
};

export type IncidentSummaryMatch = {
  incidentId: string;
  title: string;
  status: string;
  date?: string | null;
  shortCode?: string | null;
};

export type IncidentSummaryResponse =
  | { success: true; type: 'summary'; incidentId: string | number; data: IncidentSummary }
  | { success: true; type: 'needs_selection'; matches: IncidentSummaryMatch[] }
  | { success: true; type: 'no_match'; message: string };

export type IncidentFollowUpResponse = {
  success: true;
  type: 'follow_up';
  incidentId: string | number;
  data: IncidentFollowUpAnswer;
};

export type AreaBriefResponse =
  | {
      success: true;
      type: 'area_brief';
      contextId: string;
      data: AreaSafetyBrief;
    }
  | SafetyClarificationResponse;

export type RouteBriefResponse =
  | {
      success: true;
      type: 'route_risk_brief';
      contextId: string;
      data: RouteSafetyBrief;
    }
  | SafetyClarificationResponse;

export type SafetyFollowUpResponse = {
  success: true;
  type: 'area_follow_up' | 'route_follow_up';
  contextId: string;
  data: SafetyFollowUpAnswer;
};

export type VolunteerGuidanceResponse = {
  success: true;
  type: 'volunteer_guidance';
  incidentId: string | number;
  data: VolunteerGuidance;
};

export type FirstAidGuideResponse = {
  success: true;
  type: 'first_aid_guide';
  data: FirstAidGuide;
};

export type VolunteerGuidanceFollowUpResponse = {
  success: true;
  type: 'volunteer_guidance_follow_up';
  incidentId: string | number;
  data: SafetyFollowUpAnswer;
};

export type FirstAidFollowUpResponse = {
  success: true;
  type: 'first_aid_follow_up';
  data: SafetyFollowUpAnswer;
};

export const aiService = {
  async generateIncidentSummary(incidentId: string | number): Promise<IncidentSummaryResponse> {
    const res = await api.post(`/api/ai/incidents/${incidentId}/summary`);
    return res.data as IncidentSummaryResponse;
  },

  async searchIncidentSummary(query: string): Promise<IncidentSummaryResponse> {
    const res = await api.post('/api/ai/incidents/search-summary', { query });
    return res.data as IncidentSummaryResponse;
  },

  async answerIncidentFollowUp(
    incidentId: string | number,
    question: string,
  ): Promise<IncidentFollowUpResponse> {
    const res = await api.post(`/api/ai/incidents/${incidentId}/follow-up`, { question });
    return res.data as IncidentFollowUpResponse;
  },

  async generateAreaBrief(payload: { area?: string; latitude?: number; longitude?: number }): Promise<AreaBriefResponse> {
    const res = await api.post('/api/ai/area-brief', payload);
    return res.data as AreaBriefResponse;
  },

  async generateRouteSafetyBrief(payload: {
    origin: { latitude: number; longitude: number };
    destination: string;
    mode: 'driving' | 'walking';
  }): Promise<RouteBriefResponse> {
    const res = await api.post('/api/ai/route-risk-brief', payload);
    return res.data as RouteBriefResponse;
  },

  async answerAreaBriefFollowUp(contextId: string, question: string): Promise<SafetyFollowUpResponse> {
    const res = await api.post('/api/ai/area-brief/follow-up', { contextId, question });
    return res.data as SafetyFollowUpResponse;
  },

  async answerRouteSafetyFollowUp(contextId: string, question: string): Promise<SafetyFollowUpResponse> {
    const res = await api.post('/api/ai/route-risk-brief/follow-up', { contextId, question });
    return res.data as SafetyFollowUpResponse;
  },

  async generateVolunteerGuidance(incidentId: string | number): Promise<VolunteerGuidanceResponse> {
    const res = await api.post(`/api/ai/incidents/${incidentId}/volunteer-guidance`);
    return res.data as VolunteerGuidanceResponse;
  },

  async answerVolunteerGuidanceFollowUp(
    incidentId: string | number,
    question: string,
  ): Promise<VolunteerGuidanceFollowUpResponse> {
    const res = await api.post(`/api/ai/incidents/${incidentId}/volunteer-guidance/follow-up`, { question });
    return res.data as VolunteerGuidanceFollowUpResponse;
  },

  async generateFirstAidGuide(payload: { category?: string; question?: string }): Promise<FirstAidGuideResponse> {
    const res = await api.post('/api/ai/first-aid-guide', payload);
    return res.data as FirstAidGuideResponse;
  },

  async answerFirstAidFollowUp(payload: {
    category?: string;
    question: string;
    previousGuide?: FirstAidGuide;
  }): Promise<FirstAidFollowUpResponse> {
    const res = await api.post('/api/ai/first-aid-guide/follow-up', payload);
    return res.data as FirstAidFollowUpResponse;
  },
};
