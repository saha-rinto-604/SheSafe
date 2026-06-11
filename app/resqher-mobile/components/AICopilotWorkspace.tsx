import React, { type ComponentProps, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { R, S, T } from '../src/constants/theme';
import { getAccessToken } from '../src/services/api';
import {
  aiService,
  type AreaSafetyBrief,
  type FirstAidGuide,
  type IncidentFollowUpAnswer,
  type IncidentSummary,
  type IncidentSummaryMatch,
  type RouteSafetyBrief,
  type SafetyFollowUpAnswer,
  type VolunteerGuidance,
} from '../src/services/aiService';

const COPILOT_ICON = require('../assets/images/aicopiloticon.png');

export type AICopilotMode =
  | 'incident_summary'
  | 'area_safety'
  | 'route_risk'
  | 'volunteer_guidance'
  | 'first_aid';

type Props = {
  visible: boolean;
  mode: AICopilotMode;
  incidentId?: string | number | null;
  onClose: () => void;
};

type ModeConfig = {
  title: string;
  description: string;
  icon: ComponentProps<typeof Feather>['name'];
  inputPlaceholder: string;
  uses: string;
  idleText: string;
  resultTitle: string;
};

type ResultState = {
  kind: 'message';
  title: string;
  body: string;
  tone?: 'normal' | 'error';
  suggestions?: string[];
  suggestionMode?: 'area' | 'route';
} | {
  kind: 'matches';
  matches: IncidentSummaryMatch[];
};

type FollowUpCard = {
  id: string;
  question: string;
  answer: IncidentFollowUpAnswer;
};

type SafetyFollowUpCard = {
  id: string;
  question: string;
  answer: SafetyFollowUpAnswer;
};

const MODE_CONFIG: Record<AICopilotMode, ModeConfig> = {
  incident_summary: {
    title: 'AI Incident Summary',
    description: 'Summarize this incident using chat, location, status, and timeline.',
    icon: 'file-text',
    inputPlaceholder: 'Ask a follow-up...',
    uses: 'incident chat · location · status · timeline',
    idleText: 'Ready to generate a structured summary for this incident.',
    resultTitle: 'Incident summary preview',
  },
  area_safety: {
    title: 'Area Safety Brief',
    description: 'Check safety risk for an area using SheSafe red/yellow zone data.',
    icon: 'shield',
    inputPlaceholder: 'Ask about area safety...',
    uses: 'current/selected area · red/yellow zone data',
    idleText: 'Choose current location or enter an area name to prepare a safety brief.',
    resultTitle: 'Area safety brief preview',
  },
  route_risk: {
    title: 'Route Safety Check',
    description: 'Check risky zones between your current location and destination.',
    icon: 'navigation',
    inputPlaceholder: 'Ask about route safety...',
    uses: 'current location · destination · travel mode · red/yellow zones',
    idleText: 'Enter a destination and travel mode to prepare route safety check.',
    resultTitle: 'Route safety preview',
  },
  volunteer_guidance: {
    title: 'Volunteer Guidance',
    description: 'Get safe response guidance for the active incident.',
    icon: 'users',
    inputPlaceholder: 'Ask about response guidance...',
    uses: 'active incident · risk area · response context',
    idleText: 'Ready to prepare safe response guidance for an active incident.',
    resultTitle: 'Volunteer guidance preview',
  },
  first_aid: {
    title: 'First Aid Guide',
    description: 'Choose the emergency type to prepare first-aid guidance.',
    icon: 'heart',
    inputPlaceholder: 'Ask about first aid...',
    uses: 'selected first-aid topic · verified protocol later',
    idleText: 'Choose an emergency type to prepare first-aid guidance.',
    resultTitle: 'First-aid guide preview',
  },
};

const FIRST_AID_TOPICS = [
  'Burn',
  'Bleeding',
  'Fainting',
  'Panic Attack',
  'Road Accident',
  'Breathing Problem',
] as const;

const FOLLOW_UP_CHIPS = [
  'Who helped me?',
  'Volunteer actions',
  'Unresolved issues',
  'Timeline',
  'Final outcome',
  'Important chat points',
] as const;

const AREA_FOLLOW_UP_CHIPS = [
  'Is this area safe?',
  'Nearby red zones',
  'What should I avoid?',
  'Safety tips',
  'Short version',
  'Detailed version',
] as const;

const ROUTE_FOLLOW_UP_CHIPS = [
  'Is this route safe?',
  'Red zones on route',
  'Highest risk part',
  'Driving or walking?',
  'Safety actions',
  'Short version',
] as const;

const VOLUNTEER_FOLLOW_UP_CHIPS = [
  'What should I do first?',
  'What should I say?',
  'Should I go alone?',
  'What should I avoid?',
  'When should I wait?',
] as const;

const FIRST_AID_FOLLOW_UP_CHIPS = [
  'What should I avoid?',
  'When should I get help?',
  'Short steps',
  'What should I do first?',
] as const;

export default function AICopilotWorkspace({ visible, mode, incidentId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const config = MODE_CONFIG[mode];
  const [areaName, setAreaName] = useState('');
  const [destination, setDestination] = useState('');
  const [travelMode, setTravelMode] = useState<'Driving' | 'Walking'>('Driving');
  const [selectedFirstAidTopic, setSelectedFirstAidTopic] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [result, setResult] = useState<ResultState | null>(null);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [activeIncidentIdForSummary, setActiveIncidentIdForSummary] = useState<string | number | null>(incidentId ?? null);
  const [followUpAnswers, setFollowUpAnswers] = useState<FollowUpCard[]>([]);
  const [areaBrief, setAreaBrief] = useState<AreaSafetyBrief | null>(null);
  const [routeBrief, setRouteBrief] = useState<RouteSafetyBrief | null>(null);
  const [volunteerGuidance, setVolunteerGuidance] = useState<VolunteerGuidance | null>(null);
  const [firstAidGuide, setFirstAidGuide] = useState<FirstAidGuide | null>(null);
  const [areaContextId, setAreaContextId] = useState<string | null>(null);
  const [routeContextId, setRouteContextId] = useState<string | null>(null);
  const [safetyFollowUps, setSafetyFollowUps] = useState<SafetyFollowUpCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const showResult = (body: string, title = config.resultTitle) => {
    setResult({ kind: 'message', title, body });
  };

  const showSummaryResponse = (response: Awaited<ReturnType<typeof aiService.generateIncidentSummary>>) => {
    if (response.type === 'summary') {
      setSummary(response.data);
      setActiveIncidentIdForSummary(response.incidentId);
      setFollowUpAnswers([]);
      setResult(null);
      return;
    }
    if (response.type === 'needs_selection') {
      setResult({ kind: 'matches', matches: response.matches });
      return;
    }
    setResult({ kind: 'message', title: 'No matching incident', body: response.message });
  };

  const showIncidentSummaryError = () => {
    setResult({
      kind: 'message',
      title: 'Summary unavailable',
      body: 'Could not generate incident summary right now. Please try again.',
      tone: 'error',
    });
  };

  const handleGenerateIncidentSummary = async (selectedIncidentId?: string | number) => {
    if (loading) return;
    const targetIncidentId = selectedIncidentId ?? incidentId;
    const query = followUp.trim();

    if (!targetIncidentId && !query) {
      setResult({
        kind: 'message',
        title: 'Select an incident first',
        body: 'Search by incident location, incident ID, or open this from an incident chat.',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setSummary(null);
    setFollowUpAnswers([]);
    try {
      const response = targetIncidentId
        ? await aiService.generateIncidentSummary(targetIncidentId)
        : await aiService.searchIncidentSummary(query);
      showSummaryResponse(response);
      if (!targetIncidentId && response.type === 'summary') {
        setFollowUp('');
      }
    } catch {
      showIncidentSummaryError();
    } finally {
      setLoading(false);
    }
  };

  const handleAskFollowUp = async (presetQuestion?: string) => {
    if (followUpLoading) return;
    const question = (presetQuestion ?? followUp).trim();
    if (!question) return;

    if (!activeIncidentIdForSummary) {
      setResult({
        kind: 'message',
        title: 'Generate or select an incident summary first',
        body: 'Follow-up answers are locked to one selected incident.',
      });
      return;
    }

    setFollowUpLoading(true);
    try {
      const response = await aiService.answerIncidentFollowUp(activeIncidentIdForSummary, question);
      setActiveIncidentIdForSummary(response.incidentId);
      setFollowUpAnswers(prev => [
        ...prev,
        { id: `${Date.now()}-${prev.length}`, question, answer: response.data },
      ]);
      setFollowUp('');
    } catch {
      setFollowUpAnswers(prev => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          question,
          answer: {
            answer_title: 'Follow-up unavailable',
            answer: 'Could not answer this incident follow-up right now. Please try again.',
            supporting_points: [],
            not_mentioned: [],
            confidence: 'Not mentioned',
            final_note: 'No private backend details were shown.',
          },
        },
      ]);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const resetSafetyResults = () => {
    setResult(null);
    setAreaBrief(null);
    setRouteBrief(null);
    setVolunteerGuidance(null);
    setFirstAidGuide(null);
    setSafetyFollowUps([]);
  };

  const getCurrentCoordinates = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('location-denied');
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  };

  const showHelper = (
    title: string,
    body: string,
    suggestions?: string[],
    suggestionMode?: 'area' | 'route',
  ) => {
    setResult({ kind: 'message', title, body, suggestions, suggestionMode });
  };

  const getSafeApiMessage = (error: unknown, fallback: string) => {
    const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    if (!message || message.length > 180 || /stack|sql|token|password|secret/i.test(message)) {
      return fallback;
    }
    if (/geocoding|location/i.test(message)) {
      return "I couldn't find this location clearly. Please check the spelling or choose another nearby place.";
    }
    if (/directions|route/i.test(message) && /failed|access|key|configured/i.test(message)) {
      return "I couldn't check this route right now. Please try again.";
    }
    if (/google maps|maps key|api access/i.test(message)) {
      return 'Map service is not configured correctly. Please check the map setup and try again.';
    }
    return message;
  };

  const showClarification = (
    title: string,
    response: { message: string; suggestions?: string[] },
    suggestionMode: 'area' | 'route',
  ) => {
    showHelper(title, response.message, response.suggestions ?? [], suggestionMode);
  };

  const handleGenerateAreaBrief = async (useCurrentLocation = false) => {
    if (loading) return;
    const area = areaName.trim();
    if (!useCurrentLocation && !area) {
      showHelper('Area needed', 'Use your current location or enter an area name first.');
      return;
    }

    setLoading(true);
    resetSafetyResults();
    try {
      const payload = useCurrentLocation ? await getCurrentCoordinates() : { area };
      const token = await getAccessToken();
      if (__DEV__) {
        console.info('[AI Safety]', 'area-brief request', {
          endpoint: '/api/ai/area-brief',
          payloadKeys: Object.keys(payload),
          usesCurrentLocation: useCurrentLocation,
          hasAuthToken: Boolean(token),
        });
      }
      const response = await aiService.generateAreaBrief(payload);
      if (__DEV__) {
        console.info('[AI Safety]', 'area-brief response', { type: response.type });
      }
      if (response.type === 'clarification') {
        showClarification('Check the area name', response, 'area');
        return;
      }
      setAreaBrief(response.data);
      setAreaContextId(response.contextId);
      setFollowUp('');
    } catch (error) {
      const message = error instanceof Error && error.message === 'location-denied'
        ? 'Current location is needed to check nearby area safety.'
        : getSafeApiMessage(error, 'Could not generate area safety brief right now. Please try again.');
      showHelper('Area Safety Brief unavailable', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRouteBrief = async () => {
    if (loading) return;
    const destinationText = destination.trim();
    if (!destinationText) {
      showHelper('Destination needed', 'Enter a destination first.');
      return;
    }

    setLoading(true);
    resetSafetyResults();
    try {
      const origin = await getCurrentCoordinates();
      const token = await getAccessToken();
      if (__DEV__) {
        console.info('[AI Safety]', 'route-risk-brief request', {
          endpoint: '/api/ai/route-risk-brief',
          payloadKeys: ['origin', 'destination', 'mode'],
          hasCurrentLocation: Boolean(origin.latitude && origin.longitude),
          mode: travelMode.toLowerCase(),
          hasAuthToken: Boolean(token),
        });
      }
      const response = await aiService.generateRouteSafetyBrief({
        origin,
        destination: destinationText,
        mode: travelMode.toLowerCase() as 'driving' | 'walking',
      });
      if (__DEV__) {
        console.info('[AI Safety]', 'route-risk-brief response', { type: response.type });
      }
      if (response.type === 'clarification') {
        showClarification('Check the destination', response, 'route');
        return;
      }
      setRouteBrief(response.data);
      setRouteContextId(response.contextId);
      setFollowUp('');
    } catch (error) {
      const message = error instanceof Error && error.message === 'location-denied'
        ? 'Current location is needed to check route safety.'
        : getSafeApiMessage(error, 'Could not generate route safety check right now. Please try again.');
      showHelper('Route Safety Check unavailable', message);
    } finally {
      setLoading(false);
    }
  };

  const handleAskSafetyFollowUp = async (kind: 'area' | 'route', presetQuestion?: string) => {
    if (followUpLoading) return;
    const question = (presetQuestion ?? followUp).trim();
    if (!question) return;

    const contextId = kind === 'area' ? areaContextId : routeContextId;
    if (!contextId) {
      showHelper('Generate a safety result first', kind === 'area'
        ? 'Create an Area Safety Brief before asking follow-up questions.'
        : 'Create a Route Safety Check before asking follow-up questions.');
      return;
    }

    setFollowUpLoading(true);
    try {
      const response = kind === 'area'
        ? await aiService.answerAreaBriefFollowUp(contextId, question)
        : await aiService.answerRouteSafetyFollowUp(contextId, question);
      setSafetyFollowUps(prev => [
        ...prev,
        { id: `${kind}-${Date.now()}-${prev.length}`, question, answer: response.data },
      ]);
      setFollowUp('');
    } catch {
      setSafetyFollowUps(prev => [
        ...prev,
        {
          id: `${kind}-${Date.now()}-${prev.length}`,
          question,
          answer: {
            answer_title: 'Follow-up unavailable',
            answer: 'Could not answer this safety follow-up right now. Please try again.',
            supporting_points: [],
            not_available: [],
            recommended_actions: [],
            confidence: 'Not available',
            final_note: 'No private backend details were shown.',
          },
        },
      ]);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleGenerateVolunteerGuidance = async () => {
    if (loading) return;
    if (!incidentId) {
      showHelper('Open an active incident first', 'Open this from an active or accepted SOS incident to generate volunteer guidance.');
      return;
    }
    setLoading(true);
    resetSafetyResults();
    try {
      const response = await aiService.generateVolunteerGuidance(incidentId);
      setVolunteerGuidance(response.data);
      setFollowUp('');
    } catch (error) {
      showHelper(
        'Volunteer guidance unavailable',
        getSafeApiMessage(error, 'Volunteer guidance is available for authorized volunteers responding to an incident.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAskVolunteerFollowUp = async (presetQuestion?: string) => {
    if (followUpLoading || !incidentId) return;
    const question = (presetQuestion ?? followUp).trim();
    if (!question) return;
    if (!volunteerGuidance) {
      showHelper('Generate volunteer guidance first', 'Create volunteer guidance before asking follow-up questions.');
      return;
    }
    setFollowUpLoading(true);
    try {
      const response = await aiService.answerVolunteerGuidanceFollowUp(incidentId, question);
      setSafetyFollowUps(prev => [
        ...prev,
        { id: `volunteer-${Date.now()}-${prev.length}`, question, answer: response.data },
      ]);
      setFollowUp('');
    } catch {
      setSafetyFollowUps(prev => [
        ...prev,
        {
          id: `volunteer-${Date.now()}-${prev.length}`,
          question,
          answer: {
            answer_title: 'Volunteer Guidance',
            answer: 'Stay safe first, keep communication calm, and avoid direct confrontation.',
            supporting_points: ['Volunteer safety comes first.'],
            not_available: [],
            recommended_actions: ['Message the user before approaching.', 'Wait if the area looks unsafe.'],
            confidence: 'Medium',
            final_note: 'Based on available incident information.',
          },
        },
      ]);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleGenerateFirstAidGuide = async (category?: string) => {
    if (loading) return;
    const question = followUp.trim();
    if (!category && !question) {
      showHelper('Choose a first-aid topic', 'Choose an emergency type or ask a first-aid question.');
      return;
    }
    setLoading(true);
    resetSafetyResults();
    try {
      const response = await aiService.generateFirstAidGuide({ category, question: category ? undefined : question });
      setFirstAidGuide(response.data);
      setSelectedFirstAidTopic(category ?? response.data.category);
      setFollowUp('');
    } catch (error) {
      showHelper('First Aid Guide unavailable', getSafeApiMessage(error, 'Choose an emergency type or ask a first-aid question.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAskFirstAidFollowUp = async (presetQuestion?: string) => {
    if (followUpLoading) return;
    const question = (presetQuestion ?? followUp).trim();
    if (!question) return;
    if (!firstAidGuide) {
      handleGenerateFirstAidGuide();
      return;
    }
    setFollowUpLoading(true);
    try {
      const response = await aiService.answerFirstAidFollowUp({
        category: firstAidGuide.category,
        question,
        previousGuide: firstAidGuide,
      });
      setSafetyFollowUps(prev => [
        ...prev,
        { id: `first-aid-${Date.now()}-${prev.length}`, question, answer: response.data },
      ]);
      setFollowUp('');
    } catch {
      setSafetyFollowUps(prev => [
        ...prev,
        {
          id: `first-aid-${Date.now()}-${prev.length}`,
          question,
          answer: {
            answer_title: 'First Aid Follow-up',
            answer: 'This is general safety guidance. Get professional help if symptoms are serious or unclear.',
            supporting_points: [],
            not_available: [],
            recommended_actions: ['Contact emergency help if the situation is serious.'],
            confidence: 'Medium',
            final_note: 'This is not a medical diagnosis.',
          },
        },
      ]);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleFollowUp = () => {
    if (mode === 'incident_summary') {
      if (summary) {
        handleAskFollowUp();
        return;
      }
      handleGenerateIncidentSummary();
      return;
    }
    if (mode === 'area_safety') {
      if (areaBrief) {
        handleAskSafetyFollowUp('area');
        return;
      }
      handleGenerateAreaBrief(false);
      return;
    }
    if (mode === 'route_risk') {
      if (routeBrief) {
        handleAskSafetyFollowUp('route');
        return;
      }
      handleGenerateRouteBrief();
      return;
    }
    if (mode === 'volunteer_guidance') {
      if (volunteerGuidance) {
        handleAskVolunteerFollowUp();
        return;
      }
      handleGenerateVolunteerGuidance();
      return;
    }
    if (mode === 'first_aid') {
      if (firstAidGuide) {
        handleAskFirstAidFollowUp();
        return;
      }
      handleGenerateFirstAidGuide();
      return;
    }
    showResult('This follow-up will be connected to SheSafe AI in the next step.', 'Follow-up preview');
    setFollowUp('');
  };

  const renderModeControls = () => {
    switch (mode) {
      case 'incident_summary':
        return (
          <PrimaryButton
            label={loading ? 'Generating incident summary...' : 'Generate Incident Summary'}
            icon="file-text"
            disabled={loading}
            onPress={() => handleGenerateIncidentSummary()}
          />
        );
      case 'area_safety':
        return (
          <View style={st.controlStack}>
            <SecondaryButton
              label="Use Current Location"
              icon="map-pin"
              onPress={() => handleGenerateAreaBrief(true)}
            />
            <View style={st.orRow}>
              <View style={st.orLine} />
              <Text style={st.orText}>or</Text>
              <View style={st.orLine} />
            </View>
            <TextInput
              value={areaName}
              onChangeText={setAreaName}
              placeholder="Enter area name"
              placeholderTextColor="rgba(245,245,247,0.38)"
              style={st.field}
              returnKeyType="done"
            />
            <PrimaryButton
              label={loading ? 'Generating area brief...' : 'Generate Area Brief'}
              icon="shield"
              disabled={loading}
              onPress={() => handleGenerateAreaBrief(false)}
            />
          </View>
        );
      case 'route_risk':
        return (
          <View style={st.controlStack}>
            <TextInput
              value={destination}
              onChangeText={setDestination}
              placeholder="Where are you going?"
              placeholderTextColor="rgba(245,245,247,0.38)"
              style={st.field}
              returnKeyType="done"
            />
            <View style={st.segment}>
              {(['Driving', 'Walking'] as const).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[st.segmentBtn, travelMode === option && st.segmentBtnActive]}
                  activeOpacity={0.82}
                  onPress={() => setTravelMode(option)}
                >
                  <Text style={[st.segmentText, travelMode === option && st.segmentTextActive]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <PrimaryButton
              label={loading ? 'Checking route safety...' : 'Check Route Safety'}
              icon="navigation"
              disabled={loading}
              onPress={handleGenerateRouteBrief}
            />
          </View>
        );
      case 'volunteer_guidance':
        return (
          <PrimaryButton
            label={loading ? 'Generating volunteer guidance...' : 'Generate Volunteer Guidance'}
            icon="users"
            disabled={loading}
            onPress={handleGenerateVolunteerGuidance}
          />
        );
      case 'first_aid':
        return (
          <View style={st.topicGrid}>
            {FIRST_AID_TOPICS.map(topic => (
              <TouchableOpacity
                key={topic}
                style={[st.topicButton, selectedFirstAidTopic === topic && st.topicButtonActive]}
                activeOpacity={0.82}
                onPress={() => {
                  setSelectedFirstAidTopic(topic);
                  handleGenerateFirstAidGuide(topic);
                }}
              >
                <Text style={[st.topicText, selectedFirstAidTopic === topic && st.topicTextActive]}>
                  {topic}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  const renderListSection = (title: string, items: string[]) => {
    const safeItems = Array.isArray(items) && items.length ? items : ['Not mentioned'];
    return (
      <View style={st.summarySection}>
        <Text style={st.summarySectionTitle}>{title}</Text>
        {safeItems.map((item, index) => (
          <Text key={`${title}-${index}`} style={st.summaryBullet}>- {item || 'Not mentioned'}</Text>
        ))}
      </View>
    );
  };

  const renderOptionalListSection = (title: string, items?: string[]) => {
    const safeItems = Array.isArray(items)
      ? items.filter(item => {
        const text = String(item || '').trim();
        return text && !/ai wording|backend|fallback|saved context|schema|json|api|database/i.test(text);
      })
      : [];
    if (!safeItems.length) return null;
    return (
      <View style={st.summarySection}>
        <Text style={st.summarySectionTitle}>{title}</Text>
        {safeItems.map((item, index) => (
          <Text key={`${title}-${index}`} style={st.summaryBullet}>- {item}</Text>
        ))}
      </View>
    );
  };

  const renderSummary = (summary: IncidentSummary) => (
    <View style={st.resultCard}>
      <View style={st.resultHeader}>
        <View style={st.resultIcon}>
          <Feather name="file-text" size={15} color={T.violetLight} />
        </View>
        <Text style={st.resultTitle}>{summary.report_title || 'Incident Summary'}</Text>
      </View>
      <View style={st.statusPill}>
        <Text style={st.statusPillText}>{summary.incident_status || 'Status not mentioned'}</Text>
      </View>
      <View style={st.metaStack}>
        {!!summary.incident_code && summary.incident_code !== 'Not mentioned' && (
          <Text style={st.metaText}>Code: {summary.incident_code}</Text>
        )}
        {!!summary.location && summary.location !== 'Not mentioned' && (
          <Text style={st.metaText}>Location: {summary.location}</Text>
        )}
      </View>
      <View style={st.summaryDivider} />
      <View style={st.peopleBox}>
        <Text style={st.summarySectionTitle}>People Involved</Text>
        <Text style={st.resultText}>Victim: {summary.victim?.name || 'Not mentioned'} ({summary.victim?.role || 'Not mentioned'})</Text>
        {summary.responders?.length ? (
          summary.responders.map((responder, index) => (
            <Text key={`${responder.name}-${index}`} style={st.summaryBullet}>
              - {responder.name || 'Not mentioned'} ({responder.role || 'Not mentioned'}): {responder.action || 'Not mentioned'}
            </Text>
          ))
        ) : (
          <Text style={st.summaryBullet}>- Responders/Volunteers: Not mentioned</Text>
        )}
      </View>
      <SummaryText title="Short Summary" text={summary.short_summary} />
      <SummaryText title="What Happened" text={summary.what_happened} />
      <SummaryText title="Chat Understanding" text={summary.chat_understanding} />
      {renderListSection('Timeline', summary.timeline)}
      {renderListSection('Victim Concerns', summary.victim_reported_concerns)}
      {renderListSection('Responder Actions', summary.responder_actions)}
      {renderListSection('Important Chat Points', summary.important_chat_points)}
      {renderListSection('Unresolved Items', summary.unresolved_items)}
      {renderListSection('Safety Notes', summary.safety_notes)}
      <SummaryText title="Current / Final Outcome" text={summary.current_or_final_outcome} />
      <SummaryText title="Confidence" text={summary.confidence} />
      <SummaryText title="Final Note" text={summary.final_note} />
    </View>
  );

  const renderFollowUpChips = () => {
    if (mode !== 'incident_summary' || !summary) return null;
    return (
      <View style={st.chipWrap}>
        {FOLLOW_UP_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip}
            style={st.followChip}
            activeOpacity={0.84}
            disabled={followUpLoading}
            onPress={() => handleAskFollowUp(chip)}
          >
            <Text style={st.followChipText}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderFollowUpAnswer = (item: FollowUpCard) => (
    <View key={item.id} style={st.followCard}>
      <View style={st.followQuestionRow}>
        <Feather name="message-circle" size={14} color={T.violetLight} />
        <Text style={st.followQuestion}>{item.question}</Text>
      </View>
      <Text style={st.resultTitle}>{item.answer.answer_title || 'Incident Follow-up'}</Text>
      <Text style={st.resultText}>{item.answer.answer || 'Not mentioned'}</Text>
      {renderOptionalListSection('Supporting Points', item.answer.supporting_points)}
      {renderOptionalListSection('Not Mentioned', item.answer.not_mentioned)}
      <SummaryText title="Confidence" text={item.answer.confidence} />
      <SummaryText title="Final Note" text={item.answer.final_note} />
    </View>
  );

  const renderSafetyZoneList = (
    title: string,
    zones: { name: string; distance?: string; distance_from_route?: string; reason: string; advice?: string }[],
  ) => {
    const safeZones = Array.isArray(zones) ? zones : [];
    return (
      <View style={st.summarySection}>
        <Text style={st.summarySectionTitle}>{title}</Text>
        {safeZones.length ? safeZones.map((zone, index) => (
          <View key={`${title}-${zone.name}-${index}`} style={st.zoneRow}>
            <Text style={st.zoneName}>{zone.name || 'SheSafe zone'}</Text>
            <Text style={st.zoneMeta}>{zone.distance || zone.distance_from_route || 'Distance not available'}</Text>
            <Text style={st.resultText}>{zone.reason || 'Based on available SheSafe zone data.'}</Text>
            {!!zone.advice && <Text style={st.summaryBullet}>- {zone.advice}</Text>}
          </View>
        )) : (
          <Text style={st.summaryBullet}>- Not found in available SheSafe data</Text>
        )}
      </View>
    );
  };

  const renderAreaBrief = (brief: AreaSafetyBrief) => (
    <View style={st.resultCard}>
      <View style={st.resultHeader}>
        <View style={st.resultIcon}>
          <Feather name="shield" size={15} color={T.violetLight} />
        </View>
        <Text style={st.resultTitle}>{brief.title || 'Area Safety Brief'}</Text>
      </View>
      <View style={st.statusPill}>
        <Text style={st.statusPillText}>{brief.overall_risk || 'Risk not available'}</Text>
      </View>
      <Text style={st.metaText}>Area: {brief.area_name || 'Not available'}</Text>
      <SummaryText title="Risk Summary" text={brief.risk_summary} />
      {renderSafetyZoneList('Nearby Red Zones', brief.nearby_red_zones)}
      {renderSafetyZoneList('Nearby Yellow Zones', brief.nearby_yellow_zones)}
      {renderListSection('Safety Tips', brief.safety_tips)}
      {renderListSection('Recommended Actions', brief.recommended_actions)}
      <SummaryText title="Data Note" text={brief.data_note} />
      <SummaryText title="Confidence" text={brief.confidence} />
    </View>
  );

  const renderRouteBrief = (brief: RouteSafetyBrief) => (
    <View style={st.resultCard}>
      <View style={st.resultHeader}>
        <View style={st.resultIcon}>
          <Feather name="navigation" size={15} color={T.violetLight} />
        </View>
        <Text style={st.resultTitle}>{brief.title || 'Route Safety Check'}</Text>
      </View>
      <View style={st.statusPill}>
        <Text style={st.statusPillText}>{brief.overall_risk || 'Risk not available'}</Text>
      </View>
      <Text style={st.metaText}>{brief.origin_label || 'Origin'} -&gt; {brief.destination_label || 'Destination'}</Text>
      <Text style={st.metaText}>Mode: {brief.mode || 'Not available'}</Text>
      <SummaryText title="Route Summary" text={brief.route_summary} />
      {renderSafetyZoneList('Red Zones On Route', brief.red_zones_on_route)}
      {renderSafetyZoneList('Yellow Zones On Route', brief.yellow_zones_on_route)}
      {renderListSection('Recommended Actions', brief.recommended_actions)}
      {renderListSection('Map Actions', brief.map_actions)}
      <SummaryText title="Data Note" text={brief.data_note} />
      <SummaryText title="Confidence" text={brief.confidence} />
    </View>
  );

  const renderVolunteerGuidance = (guidance: VolunteerGuidance) => (
    <View style={st.resultCard}>
      <View style={st.resultHeader}>
        <View style={st.resultIcon}>
          <Feather name="users" size={15} color={T.violetLight} />
        </View>
        <Text style={st.resultTitle}>{guidance.title || 'Volunteer Guidance'}</Text>
      </View>
      <View style={st.statusPill}>
        <Text style={st.statusPillText}>{guidance.risk_level || 'Use caution'}</Text>
      </View>
      <Text style={st.metaText}>Status: {guidance.incident_status || 'Not available'}</Text>
      <SummaryText title="Situation Summary" text={guidance.situation_summary} />
      <SummaryText title="First Priority" text={guidance.first_priority} />
      {renderListSection('Approach Guidance', guidance.approach_guidance)}
      {renderListSection('Communication Tips', guidance.communication_tips)}
      {renderListSection('Do Not Do', guidance.do_not_do)}
      {renderListSection('When To Stop Or Wait', guidance.when_to_stop_or_wait)}
      {renderOptionalListSection('Missing Information', guidance.missing_information)}
      {renderListSection('Recommended Next Steps', guidance.recommended_next_steps)}
      <SummaryText title="Final Note" text={guidance.final_note} />
    </View>
  );

  const renderFirstAidGuide = (guide: FirstAidGuide) => (
    <View style={st.resultCard}>
      <View style={st.resultHeader}>
        <View style={st.resultIcon}>
          <Feather name="heart" size={15} color={T.violetLight} />
        </View>
        <Text style={st.resultTitle}>{guide.title || 'First Aid Guide'}</Text>
      </View>
      <View style={st.statusPill}>
        <Text style={st.statusPillText}>{guide.category || 'Safety Tips'}</Text>
      </View>
      <SummaryText title="Quick Summary" text={guide.quick_summary} />
      {renderListSection('First Steps', guide.first_steps)}
      {renderListSection('Do Not Do', guide.do_not_do)}
      {renderListSection('When To Get Help', guide.when_to_get_help)}
      <SummaryText title="Safety Reminder" text={guide.safety_reminder} />
      <SummaryText title="Final Note" text={guide.final_note} />
    </View>
  );

  const renderSafetyChips = (kind: 'area' | 'route') => {
    const chips = kind === 'area' ? AREA_FOLLOW_UP_CHIPS : ROUTE_FOLLOW_UP_CHIPS;
    return (
      <View style={st.chipWrap}>
        {chips.map(chip => (
          <TouchableOpacity
            key={chip}
            style={st.followChip}
            activeOpacity={0.84}
            disabled={followUpLoading}
            onPress={() => handleAskSafetyFollowUp(kind, chip)}
          >
            <Text style={st.followChipText}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderVolunteerChips = () => (
    <View style={st.chipWrap}>
      {VOLUNTEER_FOLLOW_UP_CHIPS.map(chip => (
        <TouchableOpacity
          key={chip}
          style={st.followChip}
          activeOpacity={0.84}
          disabled={followUpLoading}
          onPress={() => handleAskVolunteerFollowUp(chip)}
        >
          <Text style={st.followChipText}>{chip}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFirstAidChips = () => (
    <View style={st.chipWrap}>
      {FIRST_AID_FOLLOW_UP_CHIPS.map(chip => (
        <TouchableOpacity
          key={chip}
          style={st.followChip}
          activeOpacity={0.84}
          disabled={followUpLoading}
          onPress={() => handleAskFirstAidFollowUp(chip)}
        >
          <Text style={st.followChipText}>{chip}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSafetyFollowUpAnswer = (item: SafetyFollowUpCard) => (
    <View key={item.id} style={st.followCard}>
      <View style={st.followQuestionRow}>
        <Feather name="message-circle" size={14} color={T.violetLight} />
        <Text style={st.followQuestion}>{item.question}</Text>
      </View>
      <Text style={st.resultTitle}>{item.answer.answer_title || 'Safety Follow-up'}</Text>
      {!!item.answer.emotional_opening && (
        <Text style={st.resultText}>{item.answer.emotional_opening}</Text>
      )}
      <Text style={st.resultText}>{item.answer.direct_answer || item.answer.answer || 'Not available'}</Text>
      {!!item.answer.breakdown?.length && (
        <View style={st.summarySection}>
          <Text style={st.summarySectionTitle}>Step By Step</Text>
          {item.answer.breakdown.map((entry, index) => (
            <View key={`${item.id}-breakdown-${index}`} style={st.zoneRow}>
              <Text style={st.zoneName}>{entry.point || `Point ${index + 1}`}</Text>
              {!!entry.simple_explanation && <Text style={st.resultText}>{entry.simple_explanation}</Text>}
              {!!entry.why_it_matters && <Text style={st.summaryBullet}>- Why it matters: {entry.why_it_matters}</Text>}
              {!!entry.what_to_do_next && <Text style={st.summaryBullet}>- Next: {entry.what_to_do_next}</Text>}
            </View>
          ))}
        </View>
      )}
      {renderOptionalListSection('Words You Can Say', item.answer.example_words_to_say)}
      {renderOptionalListSection('Supporting Points', item.answer.supporting_points)}
      {renderOptionalListSection('Not Available', item.answer.not_available)}
      {renderOptionalListSection('Urgent Help Signs', item.answer.urgent_help_signs)}
      {renderOptionalListSection('Recommended Actions', item.answer.recommended_actions)}
      {renderOptionalListSection('What To Avoid', item.answer.what_to_avoid)}
      <SummaryText title="Confidence" text={item.answer.confidence} />
      <SummaryText title="Final Note" text={item.answer.final_note} />
    </View>
  );

  const renderMatches = (matches: IncidentSummaryMatch[]) => (
    <View style={st.resultCard}>
      <View style={st.resultHeader}>
        <View style={st.resultIcon}>
          <Feather name="list" size={15} color={T.violetLight} />
        </View>
        <Text style={st.resultTitle}>Select an incident</Text>
      </View>
      <Text style={st.resultText}>I found more than one matching incident in your accessible history.</Text>
      <View style={st.matchStack}>
        {matches.map(match => (
          <TouchableOpacity
            key={match.incidentId}
            style={st.matchCard}
            activeOpacity={0.84}
            onPress={() => handleGenerateIncidentSummary(match.incidentId)}
            disabled={loading}
          >
            <View style={st.matchTopRow}>
              <Text style={st.matchTitle} numberOfLines={1}>{match.title || 'Incident'}</Text>
              <Text style={st.matchStatus}>{match.status}</Text>
            </View>
            <Text style={st.matchMeta}>
              {[match.date, match.shortCode].filter(Boolean).join('  |  ') || 'Incident details'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderResult = () => {
    if (loading) {
      const loadingText = mode === 'area_safety'
        ? 'Generating area safety brief...'
        : mode === 'route_risk'
          ? 'Checking route safety...'
          : mode === 'volunteer_guidance'
            ? 'Generating volunteer guidance...'
            : mode === 'first_aid'
              ? 'Preparing first-aid guide...'
              : 'Generating incident summary...';
      return (
        <View style={st.idleCard}>
          <ActivityIndicator size="small" color={T.violetLight} />
          <Text style={st.idleText}>{loadingText}</Text>
        </View>
      );
    }

    if (!result && !summary && !areaBrief && !routeBrief && !volunteerGuidance && !firstAidGuide) {
      return (
        <View style={st.idleCard}>
          <Feather name="zap" size={15} color={T.violetLight} />
          <Text style={st.idleText}>{config.idleText}</Text>
        </View>
      );
    }

    if (volunteerGuidance) {
      return (
        <>
          {renderVolunteerGuidance(volunteerGuidance)}
          {renderVolunteerChips()}
          {safetyFollowUps.map(renderSafetyFollowUpAnswer)}
          {followUpLoading && (
            <View style={st.idleCard}>
              <ActivityIndicator size="small" color={T.violetLight} />
              <Text style={st.idleText}>Answering follow-up...</Text>
            </View>
          )}
        </>
      );
    }

    if (firstAidGuide) {
      return (
        <>
          {renderFirstAidGuide(firstAidGuide)}
          {renderFirstAidChips()}
          {safetyFollowUps.map(renderSafetyFollowUpAnswer)}
          {followUpLoading && (
            <View style={st.idleCard}>
              <ActivityIndicator size="small" color={T.violetLight} />
              <Text style={st.idleText}>Answering follow-up...</Text>
            </View>
          )}
        </>
      );
    }

    if (areaBrief) {
      return (
        <>
          {renderAreaBrief(areaBrief)}
          {renderSafetyChips('area')}
          {safetyFollowUps.map(renderSafetyFollowUpAnswer)}
          {followUpLoading && (
            <View style={st.idleCard}>
              <ActivityIndicator size="small" color={T.violetLight} />
              <Text style={st.idleText}>Answering follow-up...</Text>
            </View>
          )}
        </>
      );
    }

    if (routeBrief) {
      return (
        <>
          {renderRouteBrief(routeBrief)}
          {renderSafetyChips('route')}
          {safetyFollowUps.map(renderSafetyFollowUpAnswer)}
          {followUpLoading && (
            <View style={st.idleCard}>
              <ActivityIndicator size="small" color={T.violetLight} />
              <Text style={st.idleText}>Answering follow-up...</Text>
            </View>
          )}
        </>
      );
    }

    if (summary) {
      return (
        <>
          {renderSummary(summary)}
          {renderFollowUpChips()}
          {followUpAnswers.map(renderFollowUpAnswer)}
          {followUpLoading && (
            <View style={st.idleCard}>
              <ActivityIndicator size="small" color={T.violetLight} />
              <Text style={st.idleText}>Answering follow-up...</Text>
            </View>
          )}
        </>
      );
    }

    if (result?.kind === 'matches') return renderMatches(result.matches);

    const messageResult = result;
    if (!messageResult) return null;

    return (
      <View style={[st.resultCard, messageResult.tone === 'error' && st.errorCard]}>
        <View style={st.resultHeader}>
          <View style={st.resultIcon}>
            <Feather name={messageResult.tone === 'error' ? 'alert-circle' : 'info'} size={15} color={T.violetLight} />
          </View>
          <Text style={st.resultTitle}>{messageResult.title}</Text>
        </View>
        <Text style={st.resultText}>{messageResult.body}</Text>
        {!!messageResult.suggestions?.length && (
          <View style={st.chipWrap}>
            {messageResult.suggestions.map(suggestion => (
              <TouchableOpacity
                key={suggestion}
                style={st.followChip}
                activeOpacity={0.84}
                onPress={() => {
                  if (messageResult.suggestionMode === 'area') {
                    setAreaName(suggestion);
                  }
                  if (messageResult.suggestionMode === 'route') {
                    setDestination(suggestion);
                  }
                  setResult(null);
                }}
              >
                <Text style={st.followChipText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={st.safe}>
        <LinearGradient
          colors={['#000000', 'rgba(10,6,20,0.98)', 'rgba(30,21,58,0.88)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          style={st.flex}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={st.headerWrap}>
            <View style={st.header}>
              <TouchableOpacity
                style={st.backBtn}
                activeOpacity={0.78}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Feather name="chevron-left" size={22} color={T.ink} />
              </TouchableOpacity>
              <View style={st.headerLogoWrap}>
                <Image source={COPILOT_ICON} style={st.headerLogo} resizeMode="contain" />
              </View>
              <View style={st.headerCopy}>
                <Text style={st.headerTitle} numberOfLines={1}>{config.title}</Text>
                <Text style={st.headerSubtitle}>SheSafe AI Safety Copilot</Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={st.scroll}
            contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 104 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <View style={st.focusCard}>
              <View style={st.focusIcon}>
                <Feather name={config.icon} size={18} color={T.violetLight} />
              </View>
              <Text style={st.focusTitle}>{config.title}</Text>
              <Text style={st.focusDescription}>{config.description}</Text>
              <View style={st.controls}>
                {renderModeControls()}
              </View>
              <UsesRow text={config.uses} />
            </View>

            {renderResult()}
          </ScrollView>

          <View style={[st.inputWrap, { paddingBottom: Math.max(insets.bottom, S.s2) }]}>
            <View style={st.inputBar}>
              <TextInput
                value={followUp}
                onChangeText={setFollowUp}
                placeholder={config.inputPlaceholder}
                placeholderTextColor="rgba(245,245,247,0.38)"
                style={st.followInput}
                multiline
                maxLength={2000}
                textAlignVertical="top"
                scrollEnabled
              />
              <TouchableOpacity
                style={st.sendBtn}
                activeOpacity={0.82}
                onPress={handleFollowUp}
                accessibilityRole="button"
                accessibilityLabel="Send follow-up"
              >
                <Feather name="send" size={16} color={T.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function PrimaryButton({ label, icon, onPress, disabled }: { label: string; icon: ComponentProps<typeof Feather>['name']; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[st.primaryButton, disabled && st.disabledButton]} activeOpacity={0.84} onPress={onPress} disabled={disabled}>
      <Feather name={icon} size={16} color={T.violetLight} />
      <Text style={st.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, icon, onPress }: { label: string; icon: ComponentProps<typeof Feather>['name']; onPress: () => void }) {
  return (
    <TouchableOpacity style={st.secondaryButton} activeOpacity={0.84} onPress={onPress}>
      <Feather name={icon} size={16} color={T.violetLight} />
      <Text style={st.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

function UsesRow({ text }: { text: string }) {
  return (
    <View style={st.usesRow}>
      <Feather name="info" size={13} color={T.ink3} />
      <Text style={st.usesText}>
        <Text style={st.usesLabel}>Uses: </Text>
        {text}
      </Text>
    </View>
  );
}

function SummaryText({ title, text }: { title: string; text?: string }) {
  return (
    <View style={st.summarySection}>
      <Text style={st.summarySectionTitle}>{title}</Text>
      <Text style={st.resultText}>{text || 'Not mentioned'}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.bg,
  },
  flex: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: S.s3,
    paddingTop: S.s2,
    paddingBottom: S.s2,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s3,
    borderRadius: R.pill,
    paddingHorizontal: S.s3,
    paddingVertical: S.s2,
    backgroundColor: T.surfaceBulkyGlass,
    borderWidth: 1,
    borderColor: T.hairlineMicro,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: R.hBtn,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headerLogoWrap: {
    width: 38,
    height: 38,
    borderRadius: R.hBtn,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,56,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.20)',
  },
  headerLogo: {
    width: 30,
    height: 30,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: T.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  headerSubtitle: {
    marginTop: 2,
    color: 'rgba(245,245,247,0.56)',
    fontSize: 11,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: S.s4,
    paddingTop: S.s3,
  },
  focusCard: {
    borderRadius: R.xl,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.052)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  focusIcon: {
    width: 36,
    height: 36,
    borderRadius: R.hBtn,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,56,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.22)',
  },
  focusTitle: {
    marginTop: 10,
    color: T.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  focusDescription: {
    marginTop: 6,
    color: 'rgba(245,245,247,0.62)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  controls: {
    marginTop: S.s3,
  },
  controlStack: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.s2,
    borderRadius: R.md,
    paddingHorizontal: S.s3,
    backgroundColor: 'rgba(138,56,246,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
    ...Platform.select({
      ios: {
        shadowColor: '#8A38F6',
        shadowOpacity: 0.10,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryText: {
    color: T.onPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.72,
  },
  secondaryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.s2,
    borderRadius: R.md,
    paddingHorizontal: S.s4,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  secondaryText: {
    color: T.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s2,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  orText: {
    color: T.ink4,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  field: {
    minHeight: 44,
    borderRadius: R.md,
    paddingHorizontal: S.s3,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: T.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    includeFontPadding: false,
  },
  segment: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: R.md,
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  segmentBtn: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.sm,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(138,56,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.24)',
  },
  segmentText: {
    color: T.ink3,
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: T.ink,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: R.sm,
    paddingHorizontal: 11,
    backgroundColor: 'rgba(255,255,255,0.048)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  topicButtonActive: {
    backgroundColor: 'rgba(138,56,246,0.16)',
    borderColor: 'rgba(168,85,247,0.28)',
  },
  topicText: {
    color: T.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  topicTextActive: {
    color: T.ink,
  },
  usesRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: S.s3,
    borderRadius: R.pill,
    paddingHorizontal: S.s3,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.040)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.075)',
  },
  usesText: {
    flex: 1,
    color: 'rgba(245,245,247,0.54)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  usesLabel: {
    color: 'rgba(245,245,247,0.68)',
    fontWeight: '900',
  },
  idleCard: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s2,
    marginTop: S.s3,
    borderRadius: R.lg,
    paddingHorizontal: S.s3,
    paddingVertical: S.s3,
    backgroundColor: 'rgba(255,255,255,0.042)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  idleText: {
    flex: 1,
    color: 'rgba(245,245,247,0.58)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  resultCard: {
    marginTop: S.s3,
    borderRadius: R.lg,
    padding: S.s3,
    backgroundColor: 'rgba(30,21,58,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  errorCard: {
    backgroundColor: 'rgba(20,13,35,0.72)',
    borderColor: 'rgba(255,255,255,0.13)',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s2,
    marginBottom: S.s2,
  },
  resultIcon: {
    width: 26,
    height: 26,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,56,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.22)',
  },
  resultTitle: {
    color: T.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  resultText: {
    color: 'rgba(245,245,247,0.70)',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginBottom: S.s2,
    borderRadius: R.pill,
    paddingHorizontal: S.s3,
    paddingVertical: 6,
    backgroundColor: 'rgba(138,56,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.22)',
  },
  statusPillText: {
    color: T.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  summarySection: {
    marginTop: S.s2,
  },
  summarySectionTitle: {
    marginBottom: 4,
    color: T.violetLight,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryBullet: {
    color: 'rgba(245,245,247,0.70)',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  metaStack: {
    gap: 5,
    marginBottom: S.s2,
  },
  metaText: {
    color: 'rgba(245,245,247,0.68)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  summaryDivider: {
    height: 1,
    marginVertical: S.s2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  peopleBox: {
    borderRadius: R.md,
    padding: S.s3,
    backgroundColor: 'rgba(255,255,255,0.040)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: S.s3,
  },
  followChip: {
    borderRadius: R.pill,
    paddingHorizontal: S.s3,
    paddingVertical: 8,
    backgroundColor: 'rgba(138,56,246,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.20)',
  },
  followChipText: {
    color: T.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  followCard: {
    marginTop: S.s3,
    borderRadius: R.lg,
    padding: S.s3,
    backgroundColor: 'rgba(255,255,255,0.048)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  followQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s2,
    marginBottom: S.s2,
  },
  followQuestion: {
    flex: 1,
    color: 'rgba(245,245,247,0.72)',
    fontSize: 12,
    fontWeight: '800',
  },
  zoneRow: {
    marginTop: 7,
    borderRadius: R.md,
    padding: S.s2,
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  zoneName: {
    color: T.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  zoneMeta: {
    marginTop: 2,
    marginBottom: 3,
    color: T.violetLight,
    fontSize: 11,
    fontWeight: '800',
  },
  matchStack: {
    marginTop: S.s2,
    gap: S.s2,
  },
  matchCard: {
    borderRadius: R.md,
    padding: S.s3,
    backgroundColor: 'rgba(255,255,255,0.052)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  matchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s2,
  },
  matchTitle: {
    flex: 1,
    color: T.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  matchStatus: {
    color: T.violetLight,
    fontSize: 10,
    fontWeight: '900',
  },
  matchMeta: {
    marginTop: 5,
    color: T.ink3,
    fontSize: 11,
    fontWeight: '700',
  },
  inputWrap: {
    paddingHorizontal: S.s3,
    paddingTop: S.s2,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 760,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  inputBar: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: S.s2,
    borderRadius: R.pill,
    paddingLeft: S.s4,
    paddingRight: 6,
    paddingVertical: 5,
    backgroundColor: T.surfaceBulkyGlass,
    borderWidth: 1,
    borderColor: T.hairlineMicro,
  },
  followInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 112,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    color: T.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    includeFontPadding: false,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,56,246,0.72)',
  },
});
