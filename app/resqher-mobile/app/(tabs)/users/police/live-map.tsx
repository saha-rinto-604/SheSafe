import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type MapViewRef } from '../../../../src/components/shared/MapViewCompat';
import { T, Ty, R, S } from '../../../../src/constants/theme';
import { incidentService, type PoliceTask } from '../../../../src/services/incidentService';
import { getForwardRouteProgress, OFF_ROUTE_THRESHOLD_M, REROUTE_THROTTLE_MS } from '../../../../src/utils/routeRealtime';
import { haversineDistance, type LatLng } from '../../../../src/utils/routeSafety';
import { useDispatchSocket } from '../../../../src/hooks/useDispatchSocket';
import IncidentStatusAlert from '../../../../src/components/IncidentStatusAlert';
import ExploreRouteNavigationCard, { getExploreManeuverIcon } from '../../../../src/components/shared/map/ExploreRouteNavigationCard';

type Point = { latitude: number; longitude: number; heading?: number | null };
type IncidentEndStatus = 'RESOLVED' | 'CANCELLED';
type TravelMode = 'driving' | 'walking';
type NavStep = { instruction: string; distance: string; maneuver?: string; endLocation?: Point };

type RouteResult = {
  coords: LatLng[];
  steps: NavStep[];
  distanceText: string;
  mode: TravelMode;
};

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const ACTIVE_INCIDENT_STATUSES = new Set(['ACTIVE', 'IN_PROGRESS', 'LIVE', 'ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE']);
const INACTIVE_INCIDENT_STATUSES = new Set(['RESOLVED', 'CANCELLED']);
const DEFAULT_REGION = {
  latitude: 23.8103,
  longitude: 90.4125,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

function toFiniteNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function usablePoint(point?: Partial<Point> | null): Point | null {
  if (!point) return null;
  const latitude = toFiniteNumber(point.latitude);
  const longitude = toFiniteNumber(point.longitude);

  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) return null;

  return {
    latitude,
    longitude,
    heading: typeof point.heading === 'number' && Number.isFinite(point.heading) ? point.heading : null,
  };
}

function pointFromAny(source: any): Point | null {
  if (!source) return null;

  return (
    usablePoint(source) ||
    usablePoint(source.location) ||
    usablePoint(source.coords) ||
    usablePoint(source.coordinate) ||
    usablePoint(source.victimLiveLocation) ||
    usablePoint(source.liveLocation) ||
    usablePoint(source.sosLocation) ||
    usablePoint(source.incidentLocation) ||
    usablePoint(source.requesterLocation) ||
    usablePoint(source.triggererLocation) ||
    usablePoint({ latitude: source.lat, longitude: source.lng }) ||
    usablePoint({ latitude: source.victimLatitude, longitude: source.victimLongitude }) ||
    usablePoint({ latitude: source.userLatitude, longitude: source.userLongitude }) ||
    usablePoint({ latitude: source.incidentLatitude, longitude: source.incidentLongitude }) ||
    null
  );
}

function victimPointFromTask(task: PoliceTask | null): Point | null {
  if (!task) return null;
  const raw: any = task;
  return (
    pointFromAny(raw.victimLiveLocation) ||
    pointFromAny(raw.liveLocation) ||
    pointFromAny(raw.sosLocation) ||
    pointFromAny(raw.incidentLocation) ||
    pointFromAny(raw.requesterLocation) ||
    pointFromAny(raw.triggererLocation) ||
    pointFromAny(raw.victim) ||
    usablePoint({ latitude: raw.latitude, longitude: raw.longitude }) ||
    null
  );
}

function stripHtml(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodePolyline(encoded: string): LatLng[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: LatLng[] = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
}

function directRoute(origin: Point, destination: Point): LatLng[] {
  return [
    { latitude: origin.latitude, longitude: origin.longitude },
    { latitude: destination.latitude, longitude: destination.longitude },
  ];
}

function distanceLabel(a: Point, b: Point) {
  const meters = haversineDistance(a, b);
  if (!Number.isFinite(meters)) return 'Route preview';
  if (meters < 10) return `${Math.max(1, Math.round(meters))} m`;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function samePoint(a: Point | null, b: Point | null, thresholdM = 8) {
  if (!a || !b) return false;
  return haversineDistance(a, b) <= thresholdM;
}

function buildDirectionsUrl(origin: Point, destination: Point, mode: TravelMode) {
  const params = [
    `origin=${origin.latitude},${origin.longitude}`,
    `destination=${destination.latitude},${destination.longitude}`,
    `mode=${mode}`,
    'alternatives=true',
    'departure_time=now',
    `key=${GOOGLE_MAPS_API_KEY}`,
  ];
  return `https://maps.googleapis.com/maps/api/directions/json?${params.join('&')}`;
}

async function fetchDirectionsRoute(origin: Point, destination: Point, mode: TravelMode): Promise<RouteResult | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const response = await fetch(buildDirectionsUrl(origin, destination, mode));
  const data = await response.json();
  const route = data?.routes?.[0];
  const leg = route?.legs?.[0];
  const coords = decodePolyline(route?.overview_polyline?.points || '');

  if (!route || !leg || coords.length <= 1) {
    if (isDev) {
      console.log('[PoliceLiveMap] Directions unavailable', {
        mode,
        status: data?.status,
        errorMessage: data?.error_message,
      });
    }
    return null;
  }

  const steps: NavStep[] = (leg.steps || [])
    .map((step: any) => ({
      instruction: stripHtml(step.html_instructions) || 'Continue on route',
      distance: step.distance?.text || '',
      maneuver: step.maneuver,
      endLocation: step.end_location
        ? usablePoint({ latitude: step.end_location.lat, longitude: step.end_location.lng }) || undefined
        : undefined,
    }))
    .filter((step: NavStep) => step.instruction.length > 0);

  return {
    coords,
    steps: steps.length
      ? steps
      : [{ instruction: 'Route ready to victim live location.', distance: leg.distance?.text || distanceLabel(origin, destination) }],
    distanceText: leg.distance?.text || distanceLabel(origin, destination),
    mode,
  };
}

function closestVisibleRegion(a: Point, b: Point) {
  const midpoint = {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
  };
  const latSpan = Math.abs(a.latitude - b.latitude);
  const lngSpan = Math.abs(a.longitude - b.longitude);
  return {
    ...midpoint,
    latitudeDelta: Math.max(0.006, latSpan * 4),
    longitudeDelta: Math.max(0.006, lngSpan * 4),
  };
}

export default function PoliceLiveMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewRef>(null);
  const { requestId, incidentId } = useLocalSearchParams<{ requestId?: string; incidentId?: string }>();

  const [task, setTask] = useState<PoliceTask | null>(null);
  const [policeLoc, setPoliceLoc] = useState<Point | null>(null);
  const [victimLoc, setVictimLoc] = useState<Point | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [navInstructions, setNavInstructions] = useState<NavStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [statusAlert, setStatusAlert] = useState<{ status: IncidentEndStatus; message?: string } | null>(null);

  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offRouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRerouteAtRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const lastRoutePairRef = useRef('');
  const lastSpokenStepRef = useRef(-1);
  const endingRef = useRef(false);
  const navigationDoneRef = useRef(false);

  const stopAudio = useCallback(() => {
    try {
      Speech.stop();
    } catch {
      // Expo Speech stop is best-effort.
    }
  }, []);

  const stopLocalTracking = useCallback(() => {
    watcherRef.current?.remove();
    watcherRef.current = null;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (offRouteTimerRef.current) {
      clearTimeout(offRouteTimerRef.current);
      offRouteTimerRef.current = null;
    }
    if (stepAdvanceTimerRef.current) {
      clearTimeout(stepAdvanceTimerRef.current);
      stepAdvanceTimerRef.current = null;
    }
    stopAudio();
  }, [stopAudio]);

  const returnToDashboard = useCallback(() => {
    if (navigationDoneRef.current) return;
    navigationDoneRef.current = true;
    setIsLive(false);
    setAudioEnabled(false);
    stopLocalTracking();
    if (autoReturnTimerRef.current) {
      clearTimeout(autoReturnTimerRef.current);
      autoReturnTimerRef.current = null;
    }
    router.replace('/(tabs)/users/police/dashboard' as any);
  }, [router, stopLocalTracking]);

  const handleIncidentEnded = useCallback((statusValue: string, message?: string) => {
    const status = String(statusValue || '').toUpperCase();
    if (!INACTIVE_INCIDENT_STATUSES.has(status) || endingRef.current) return;

    endingRef.current = true;
    setIsLive(false);
    setShowReview(false);
    setAudioEnabled(false);
    stopLocalTracking();

    setStatusAlert({
      status: status as IncidentEndStatus,
      message:
        message ||
        (status === 'RESOLVED'
          ? 'This incident has been resolved. Returning you to your dashboard.'
          : 'This incident is no longer active. Returning you to your dashboard.'),
    });

    autoReturnTimerRef.current = setTimeout(returnToDashboard, 1800);
  }, [returnToDashboard, stopLocalTracking]);

  useDispatchSocket({
    onIncidentStatusUpdated: (payload) => {
      const matchesIncident = !!incidentId && String(payload.incidentId) === String(incidentId);
      const matchesRequest = !!requestId && !!payload.requestId && String(payload.requestId) === String(requestId);

      if (matchesIncident || matchesRequest) {
        handleIncidentEnded(payload.status || 'CANCELLED', payload.message || undefined);
      }
    },
  });

  const refreshVictimFromIncident = useCallback(async (): Promise<Point | null> => {
    if (!incidentId) return null;

    try {
      const context = await incidentService.getIncidentRouteContext(incidentId);
      const contextPoint = pointFromAny(context?.victim);
      if (contextPoint) return contextPoint;
    } catch {
      // Route context is best-effort for police map fallback.
    }

    try {
      const incident = await incidentService.getOne(incidentId);
      return pointFromAny(incident);
    } catch {
      return null;
    }
  }, [incidentId]);

  const loadRoute = useCallback(async (origin: Point, destination: Point) => {
    const requestNo = ++routeRequestIdRef.current;
    setRouteLoading(true);
    setRouteError(null);

    const directDistance = haversineDistance(origin, destination);
    if (!Number.isFinite(directDistance)) {
      setRouteCoords([]);
      setNavInstructions([]);
      setRouteError('Route location data is invalid.');
      setRouteLoading(false);
      return;
    }

    try {
      let result: RouteResult | null = null;

      if (directDistance >= 15) {
        result = await fetchDirectionsRoute(origin, destination, 'driving');
        if (!result) result = await fetchDirectionsRoute(origin, destination, 'walking');
      }

      if (routeRequestIdRef.current !== requestNo) return;

      if (result) {
        setRouteCoords(result.coords);
        setNavInstructions(result.steps);
        setCurrentStepIdx(0);
        setRouteError(null);
      } else {
        const fallback = directRoute(origin, destination);
        const nearText = directDistance < 15
          ? 'You are already near the victim live location.'
          : 'Follow the direct preview to the victim live location.';

        setRouteCoords(fallback);
        setNavInstructions([{ instruction: nearText, distance: distanceLabel(origin, destination) }]);
        setCurrentStepIdx(0);
        setRouteError(
          directDistance < 15
            ? null
            : 'Detailed route unavailable. Showing direct preview.'
        );
      }
    } catch {
      if (routeRequestIdRef.current !== requestNo) return;

      const fallback = directRoute(origin, destination);
      setRouteCoords(fallback);
      setNavInstructions([{ instruction: 'Follow the direct preview to the victim live location.', distance: distanceLabel(origin, destination) }]);
      setCurrentStepIdx(0);
      setRouteError('Detailed route unavailable. Showing direct preview.');
    } finally {
      if (routeRequestIdRef.current === requestNo) setRouteLoading(false);
    }
  }, []);

  const loadTask = useCallback(async () => {
    const tasks = await incidentService.getPoliceTasks();
    const next = tasks.find((item: any) => {
      const itemRequestId = String(item.id ?? item.requestId ?? '');
      const itemIncidentId = String(item.incidentId ?? item.incident?.id ?? '');
      return (
        (!!requestId && itemRequestId === String(requestId)) ||
        (!!incidentId && itemIncidentId === String(incidentId))
      );
    }) || null;

    if (!next) {
      setTask(null);
      let endedStatus: IncidentEndStatus = 'CANCELLED';

      try {
        if (incidentId) {
          const currentStatus = await incidentService.getLawEnforcementStatus(incidentId);
          const normalizedStatus = String(currentStatus.status || '').toUpperCase();
          if (normalizedStatus === 'RESOLVED' || normalizedStatus === 'CANCELLED') {
            endedStatus = normalizedStatus;
          }
        }
      } catch {
        // If the task vanished, return the officer safely to the dashboard.
      }

      handleIncidentEnded(
        endedStatus,
        endedStatus === 'RESOLVED'
          ? 'This incident has been resolved. Returning you to your dashboard.'
          : 'This incident is no longer active. Returning you to your dashboard.'
      );
      return;
    }

    const nextStatus = String((next as any).incidentStatus || (next as any).status || '').toUpperCase();
    if (INACTIVE_INCIDENT_STATUSES.has(nextStatus)) {
      handleIncidentEnded(
        nextStatus,
        nextStatus === 'RESOLVED'
          ? 'This incident has been resolved. Returning you to your dashboard.'
          : 'This incident is no longer active. Returning you to your dashboard.'
      );
      return;
    }

    if (nextStatus && !ACTIVE_INCIDENT_STATUSES.has(nextStatus)) {
      // Keep unknown backend active-like statuses visible, but log during development.
      if (isDev) console.log('[PoliceLiveMap] Unrecognized active task status:', nextStatus);
    }

    setTask(next);

    const pointFromTask = victimPointFromTask(next);
    const nextVictim = pointFromTask || await refreshVictimFromIncident();

    if (nextVictim) {
      setVictimLoc((prev) => (samePoint(prev, nextVictim, 5) ? prev : nextVictim));
    }
  }, [handleIncidentEnded, incidentId, refreshVictimFromIncident, requestId]);

  useEffect(() => {
    let mounted = true;

    Location.requestForegroundPermissionsAsync()
      .then(async ({ status }) => {
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!mounted) return;

        setPoliceLoc({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading,
        });

        watcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 3000,
          },
          (next) => {
            setPoliceLoc({
              latitude: next.coords.latitude,
              longitude: next.coords.longitude,
              heading: next.coords.heading,
            });
          }
        );
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, []);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      loadTask().finally(() => setLoading(false));
    }, 0);

    pollTimerRef.current = setInterval(() => {
      loadTask().catch(() => undefined);
    }, 5000);

    return () => {
      clearTimeout(initialTimer);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [loadTask]);

  useEffect(() => {
    if (!policeLoc || !victimLoc) return;

    const pair = [
      policeLoc.latitude.toFixed(5),
      policeLoc.longitude.toFixed(5),
      victimLoc.latitude.toFixed(5),
      victimLoc.longitude.toFixed(5),
    ].join(':');

    if (pair === lastRoutePairRef.current && routeCoords.length > 1) return;

    lastRoutePairRef.current = pair;
    loadRoute(policeLoc, victimLoc);
  }, [loadRoute, policeLoc, routeCoords.length, victimLoc]);

  useEffect(() => {
    if (!policeLoc || !victimLoc || isLive) return;

    const distance = haversineDistance(policeLoc, victimLoc);

    if (Number.isFinite(distance) && distance < 120) {
      mapRef.current?.animateToRegion(closestVisibleRegion(policeLoc, victimLoc), 650);
      return;
    }

    mapRef.current?.fitToCoordinates([policeLoc, victimLoc], {
      edgePadding: { top: 150, right: 80, bottom: 330, left: 80 },
      animated: true,
    });
  }, [isLive, policeLoc, victimLoc]);

  useEffect(() => {
    if (!isLive || !policeLoc) return;

    const liveDistance = victimLoc ? haversineDistance(policeLoc, victimLoc) : 0;
    mapRef.current?.animateCamera(
      {
        center: { latitude: policeLoc.latitude, longitude: policeLoc.longitude },
        pitch: 45,
        heading: policeLoc.heading ?? 0,
        zoom: liveDistance > 0 && liveDistance < 120 ? 17 : 18.5,
      },
      { duration: 900 }
    );

    if (routeCoords.length > 1) {
      const progress = getForwardRouteProgress(policeLoc, routeCoords);

      const currentStep = navInstructions[currentStepIdx];
      if (currentStep?.endLocation && currentStepIdx < navInstructions.length - 1) {
        const distanceToStepEnd = haversineDistance(policeLoc, currentStep.endLocation);
        if (distanceToStepEnd <= 25 && !stepAdvanceTimerRef.current) {
          stepAdvanceTimerRef.current = setTimeout(() => {
            stepAdvanceTimerRef.current = null;
            setCurrentStepIdx((prev) => Math.min(prev + 1, navInstructions.length - 1));
          }, 0);
        }
      }

      if (progress.nearestDistanceM > OFF_ROUTE_THRESHOLD_M && victimLoc) {
        if (!offRouteTimerRef.current) {
          offRouteTimerRef.current = setTimeout(() => {
            offRouteTimerRef.current = null;
            const now = Date.now();
            if (now - lastRerouteAtRef.current < REROUTE_THROTTLE_MS) return;
            lastRerouteAtRef.current = now;
            loadRoute(policeLoc, victimLoc);
          }, 1500);
        }
      } else if (offRouteTimerRef.current) {
        clearTimeout(offRouteTimerRef.current);
        offRouteTimerRef.current = null;
      }
    }
  }, [currentStepIdx, isLive, loadRoute, navInstructions, policeLoc, routeCoords, victimLoc]);

  useEffect(() => {
    if (!isLive) {
      lastSpokenStepRef.current = -1;
      stopAudio();
      return;
    }

    if (!audioEnabled || navInstructions.length === 0 || currentStepIdx === lastSpokenStepRef.current) return;

    const instruction = navInstructions[currentStepIdx]?.instruction;
    if (!instruction) return;

    lastSpokenStepRef.current = currentStepIdx;
    stopAudio();
    const speakTimer = setTimeout(() => {
      Speech.speak(instruction, {
        language: 'en',
        pitch: 1.0,
        rate: Platform.OS === 'android' ? 0.9 : 0.95,
      });
    }, 100);

    return () => clearTimeout(speakTimer);
  }, [audioEnabled, currentStepIdx, isLive, navInstructions, stopAudio]);

  useEffect(() => () => {
    stopLocalTracking();
    if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
  }, [stopLocalTracking]);

  const currentInstruction = navInstructions[currentStepIdx] || null;
  const liveRouteProgress = useMemo(() => {
    if (!isLive || !policeLoc || routeCoords.length <= 1) return null;
    return getForwardRouteProgress(policeLoc, routeCoords);
  }, [isLive, policeLoc, routeCoords]);
  const completedRouteCoords = liveRouteProgress?.completedRouteCoords ?? [];
  const activeRoute = isLive
    ? liveRouteProgress?.remainingRouteCoords.length && liveRouteProgress.remainingRouteCoords.length > 1
      ? liveRouteProgress.remainingRouteCoords
      : routeCoords.slice(-2)
    : routeCoords;

  const routeSummary = useMemo(() => {
    if (routeLoading) return 'Calculating route...';
    if (currentInstruction?.distance) return currentInstruction.distance;
    if (policeLoc && victimLoc) return distanceLabel(policeLoc, victimLoc);
    if (!policeLoc) return 'Waiting for your location';
    if (!victimLoc) return 'Waiting for victim location';
    return 'Route preview';
  }, [currentInstruction?.distance, policeLoc, routeLoading, victimLoc]);

  const initialRegion = useMemo(() => ({
    latitude: victimLoc?.latitude ?? policeLoc?.latitude ?? DEFAULT_REGION.latitude,
    longitude: victimLoc?.longitude ?? policeLoc?.longitude ?? DEFAULT_REGION.longitude,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  }), [policeLoc, victimLoc]);

  const canGoLive = !!policeLoc && !!victimLoc && routeCoords.length > 1 && !routeLoading;

  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={!isLive}
        showsMyLocationButton={false}
        showsCompass={false}
        moveOnMarkerPress={false}
        customMapStyle={EXPLORE_TACTICAL_MAP_STYLE}
      >
        {victimLoc && (
          <Marker
            coordinate={{ latitude: victimLoc.latitude, longitude: victimLoc.longitude }}
            pinColor={T.danger}
            title="Victim Live Location"
            description={task?.address || 'SOS location'}
            zIndex={999}
          />
        )}

        {!isLive && policeLoc && (
          <Marker
            coordinate={{ latitude: policeLoc.latitude, longitude: policeLoc.longitude }}
            pinColor={T.violet}
            title="You"
            description="Police current location"
            zIndex={1000}
          />
        )}

        {isLive && policeLoc && (
          <Marker
            coordinate={{ latitude: policeLoc.latitude, longitude: policeLoc.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={policeLoc.heading || 0}
            flat
            zIndex={1001}
          >
            <View style={st.liveMarkerWrap}>
              <View style={st.liveMarkerHalo} />
              <View style={st.liveMarkerCore}>
                <Ionicons name="navigate" size={18} color={T.violet} style={st.liveMarkerIcon} />
              </View>
            </View>
          </Marker>
        )}

        {completedRouteCoords.length > 1 && (
          <Polyline
            coordinates={completedRouteCoords}
            strokeColor="#3B82F6"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            zIndex={3}
          />
        )}

        {activeRoute.length > 1 && (
          <Polyline
            coordinates={activeRoute}
            strokeColor="rgba(138, 56, 246, 0.22)"
            strokeWidth={10}
            lineCap="round"
            lineJoin="round"
            zIndex={4}
          />
        )}

        {activeRoute.length > 1 && (
          <Polyline
            coordinates={activeRoute}
            strokeColor={T.violet}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
            zIndex={5}
          />
        )}
      </MapView>

      {!isLive && (
        <View style={[st.topBar, { top: insets.top + S.s3 }]}>
          <TouchableOpacity style={st.iconBtn} onPress={returnToDashboard} activeOpacity={0.78}>
            <Feather name="chevron-left" size={22} color={T.ink} />
          </TouchableOpacity>
          <Text style={st.topTitle}>Police Navigation</Text>
        </View>
      )}

      {isLive && currentInstruction && (
        <View style={[st.liveBannerWrap, { top: insets.top + 8 }]}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={st.liveBannerTint} pointerEvents="none" />
          <View style={st.liveBannerBody}>
            <View style={st.liveIconWrap}>
              <Ionicons
                name={getExploreManeuverIcon(currentInstruction.maneuver) as any}
                size={28}
                color={T.violet}
              />
            </View>
            <View style={st.liveTextWrap}>
              <Text style={st.liveDistText}>{routeSummary}</Text>
              <Text style={st.liveInstrText} numberOfLines={2}>{currentInstruction.instruction}</Text>
            </View>
            <TouchableOpacity
              style={st.audioBtn}
              onPress={() => {
                setAudioEnabled((prev) => {
                  if (prev) stopAudio();
                  return !prev;
                });
              }}
              activeOpacity={0.7}
              accessibilityLabel="Toggle audio guidance"
            >
              <Ionicons name={audioEnabled ? 'volume-high' : 'volume-mute'} size={22} color={audioEnabled ? T.violet : T.ink4} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ExploreRouteNavigationCard
        bottom={insets.bottom + S.s4}
        loading={loading || routeLoading}
        step={currentInstruction}
        currentStepIndex={currentStepIdx}
        stepCount={Math.max(navInstructions.length, 1)}
        isLive={isLive}
        isReviewMode={showReview}
        goLiveDisabled={!canGoLive}
        fallbackInstruction={
          !policeLoc
            ? 'Waiting for your current police location.'
            : !victimLoc
              ? 'Waiting for victim live location.'
              : routeLoading
                ? 'Calculating route to victim live location.'
                : 'Route ready to victim live location.'
        }
        fallbackDistance={routeSummary}
        routeError={!showReview ? routeError : null}
        onPrevious={() => setCurrentStepIdx((prev) => Math.max(prev - 1, 0))}
        onNext={() => setCurrentStepIdx((prev) => Math.min(prev + 1, navInstructions.length - 1))}
        onGoLive={() => {
          if (!canGoLive) return;
          setShowReview(false);
          setIsLive(true);
          setAudioEnabled(true);
        }}
        onToggleReview={() => setShowReview((prev) => !prev)}
        onExitLive={() => {
          setIsLive(false);
          setAudioEnabled(false);
          stopAudio();
        }}
      />

      <IncidentStatusAlert
        visible={!!statusAlert}
        status={statusAlert?.status || 'CANCELLED'}
        message={statusAlert?.message}
        confirmLabel="Back to Dashboard"
        onConfirm={returnToDashboard}
      />
    </SafeAreaView>
  );
}

const EXPLORE_TACTICAL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0A0A0C' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7A8D' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0C' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a0d' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1C2333' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0A0A0C' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5a6a7a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e2530' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2C3E58' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1f2a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8090a8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07070A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a4060' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0a0f1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1f2a' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#4a5a70' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#6a7a90' }] },
];

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  topBar: {
    position: 'absolute',
    left: S.s4,
    right: S.s4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s3,
    zIndex: 300,
  },
  iconBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(31,21,52,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
    }),
  },
  topTitle: {
    ...Ty.h3,
    color: T.ink,
    paddingHorizontal: S.s5,
    height: 54,
    lineHeight: 54,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(31,21,52,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  liveBannerWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: R.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 360,
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 10 },
    }),
  },
  liveBannerTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,10,18,0.85)' },
  liveBannerBody: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.s4,
    paddingVertical: S.s4,
    gap: S.s4,
  },
  liveIconWrap: {
    width: 48,
    height: 48,
    borderRadius: R.sm,
    backgroundColor: T.violetDim,
    borderWidth: 1,
    borderColor: `${T.violet}35`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTextWrap: { flex: 1 },
  liveDistText: { fontSize: 16, fontWeight: '800', color: T.violet, marginBottom: 4, letterSpacing: -0.2 },
  liveInstrText: { fontSize: 18, fontWeight: '700', color: T.ink, letterSpacing: -0.3, lineHeight: 22 },
  audioBtn: {
    width: 44,
    height: 44,
    borderRadius: R.hBtn,
    backgroundColor: `${T.violet}10`,
    borderWidth: 1,
    borderColor: `${T.violet}25`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveMarkerWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  liveMarkerHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(138,56,246,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(138,56,246,0.4)',
  },
  liveMarkerCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8A38F6',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  liveMarkerIcon: { transform: [{ rotate: '-45deg' }, { translateY: -1 }] },
});
