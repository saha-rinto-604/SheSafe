import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { T } from '../constants/theme';
import { useAuth } from './AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { incidentService } from '../services/incidentService';
import { liveVideoService } from '../services/liveVideoService';
import { liveVideoNavigation } from '../services/liveVideoNavigation';
import type { LiveVideoRequest } from '../types/chat';
import LiveSafetyVideoRecorder from '../components/shared/LiveSafetyVideoRecorder';
import { LiveSafetyWebRTCBroadcaster } from '../components/shared/LiveSafetyWebRTCStream';
import { useToast } from '../components/Toast';

const Context = createContext<{ managedIncidentId: string | null }>({ managedIncidentId: null });
const ACTIVE = new Set(['PENDING', 'APPROVED', 'STREAMING', 'RECORDING']);

export function GlobalLiveSafetyVideoProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, role, userId } = useAuth();
  const { showToast } = useToast();
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [request, setRequest] = useState<LiveVideoRequest | null>(null);
  const [autoStart, setAutoStart] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [promptVisible, setPromptVisible] = useState(false);
  const [broadcasterVisible, setBroadcasterVisible] = useState(false);
  const [controlVisible, setControlVisible] = useState(false);
  const [evidenceVisible, setEvidenceVisible] = useState(false);
  const startingRef = useRef(false);
  const eligible = isSignedIn && (role === 'USER' || role === 'VOLUNTEER');
  const {
    liveVideoRequest,
    liveVideoEvent,
    liveStreamEvent,
    sendLiveStreamSignal,
    clearLiveVideoRequest,
  } = useChatSocket(eligible ? incidentId || '' : '', userId || undefined, role === 'VOLUNTEER' ? 'VOLUNTEER' : 'USER');

  const closeFlow = useCallback(() => {
    setPromptVisible(false);
    setBroadcasterVisible(false);
    setControlVisible(false);
    setEvidenceVisible(false);
    setRequest(null);
    setAutoStart(false);
    clearLiveVideoRequest();
  }, [clearLiveVideoRequest]);

  const refresh = useCallback(async (focus = false) => {
    if (!eligible || AppState.currentState !== 'active') return;
    try {
      const incident = await incidentService.getMyActiveSos();
      if (!incident) {
        setIncidentId(null);
        closeFlow();
        if (focus) showToast({ type: 'info', title: 'Live Safety Video', message: 'This live stream request is no longer active.' });
        return;
      }
      const nextId = String(incident.id || incident.incidentId);
      setIncidentId(nextId);
      const result = await liveVideoService.getPendingLiveVideoRequest(nextId);
      const active = result.request && ACTIVE.has(result.request.status) ? result.request : null;
      if (!active) {
        setRequest(null);
        setPromptVisible(false);
        if (focus) showToast({ type: 'info', title: 'Live Safety Video', message: 'This live stream request is no longer active.' });
        return;
      }
      setRequest(active);
      if (active.status === 'PENDING') {
        setAutoStart(Boolean(result.autoStartAllowed));
        setCountdown(10);
        setPromptVisible(true);
      } else if (focus) {
        setControlVisible(true);
      }
    } catch {
      if (focus) showToast({ type: 'info', title: 'Live Safety Video', message: 'This live stream request is no longer active.' });
    }
  }, [closeFlow, eligible, showToast]);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 15000);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    const unsubscribe = liveVideoNavigation.subscribe(target => {
      if (!target || !incidentId || target === incidentId) void refresh(true);
    });
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      appState.remove();
      unsubscribe();
    };
  }, [incidentId, refresh]);

  useEffect(() => {
    const incoming = liveVideoRequest;
    if (!incoming || String(incoming.victimId) !== String(userId) || incoming.status !== 'PENDING') return;
    const timer = setTimeout(() => {
      setRequest(incoming);
      setAutoStart(liveVideoEvent?.type === 'requested' && liveVideoEvent.autoStartAllowed);
      setCountdown(10);
      setPromptVisible(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [liveVideoEvent, liveVideoRequest, userId]);

  const start = useCallback(async () => {
    if (!request || !incidentId || startingRef.current || AppState.currentState !== 'active') return;
    startingRef.current = true;
    try {
      await liveVideoService.respondLiveVideoRequest(incidentId, request.id, 'APPROVED');
      setRequest({ ...request, status: 'APPROVED' });
      setPromptVisible(false);
      setBroadcasterVisible(true);
    } catch (error: any) {
      showToast({ type: 'error', title: 'Live Safety Video', message: error?.message || 'This live stream request is no longer active.' });
      void refresh();
    } finally {
      startingRef.current = false;
    }
  }, [incidentId, refresh, request, showToast]);

  const decline = useCallback(async () => {
    if (request && incidentId) await liveVideoService.respondLiveVideoRequest(incidentId, request.id, 'DECLINED').catch(() => undefined);
    closeFlow();
  }, [closeFlow, incidentId, request]);

  useEffect(() => {
    if (!promptVisible || !autoStart || !request || AppState.currentState !== 'active') return;
    const interval = setInterval(() => setCountdown(value => {
      if (value <= 1) {
        clearInterval(interval);
        void start();
        return 0;
      }
      return value - 1;
    }), 1000);
    return () => clearInterval(interval);
  }, [autoStart, promptVisible, request, start]);

  const stopBackend = useCallback(async () => {
    if (request && incidentId) await liveVideoService.respondLiveVideoRequest(incidentId, request.id, 'STOPPED').catch(() => undefined);
  }, [incidentId, request]);

  const stop = useCallback(async () => {
    await stopBackend();
    setBroadcasterVisible(false);
    setControlVisible(false);
    setRequest(null);
  }, [stopBackend]);

  const stopAndSave = useCallback(async () => {
    await stopBackend();
    setBroadcasterVisible(false);
    setControlVisible(false);
    setTimeout(() => setEvidenceVisible(true), 700);
  }, [stopBackend]);

  const uploadEvidence = useCallback(async (uri: string) => {
    if (!incidentId) throw new Error('This incident is no longer active.');
    await liveVideoService.uploadLiveVideo(incidentId, uri);
  }, [incidentId]);

  const value = useMemo(() => ({ managedIncidentId: incidentId }), [incidentId]);

  return (
    <Context.Provider value={value}>
      {children}
      <Modal transparent visible={promptVisible && !!request && !broadcasterVisible && !evidenceVisible} animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.icon}><Feather name="video" size={23} color="#FFFFFF" /></View>
            <Text style={styles.title}>Live Safety Video Request</Text>
            <Text style={styles.body}>
              {autoStart ? `Live Safety Video will start in ${countdown} seconds.` : 'An accepted responder is requesting live video to better understand your situation.'}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.button, styles.primary]} onPress={start}>
                <Text style={styles.primaryText}>{autoStart ? 'Start Now' : 'Start Live Stream'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.secondary]} onPress={decline}>
                <Text style={styles.secondaryText}>{autoStart ? 'Cancel' : 'Not Now'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={controlVisible && !!request && !evidenceVisible} animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.icon}><Feather name="video" size={23} color="#FFFFFF" /></View>
            <Text style={styles.title}>Live Safety Video is active</Text>
            <Text style={styles.body}>An accepted responder can see your live video. What do you want to do?</Text>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => setControlVisible(false)}><Text style={styles.secondaryText}>Continue</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => void stop()}><Text style={styles.secondaryText}>Stop Streaming</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={() => void stopAndSave()}><Text style={styles.primaryText}>Stop & Save Evidence Clip</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      {!!incidentId && (
        <LiveSafetyWebRTCBroadcaster
          visible={broadcasterVisible}
          incidentId={incidentId}
          sessionActive={broadcasterVisible && AppState.currentState === 'active'}
          liveStreamEvent={liveStreamEvent}
          sendSignal={sendLiveStreamSignal}
          onClose={() => void stop()}
          onStopStreaming={stop}
          onStopAndSaveEvidence={stopAndSave}
        />
      )}
      <LiveSafetyVideoRecorder
        visible={evidenceVisible}
        incidentLabel={incidentId ? `Incident #${incidentId}` : 'Active SOS'}
        sessionActive={evidenceVisible && AppState.currentState === 'active'}
        onClipRecorded={uploadEvidence}
        onStopSession={() => {
          setEvidenceVisible(false);
          setRequest(null);
        }}
      />
    </Context.Provider>
  );
}

export function useGlobalLiveSafetyVideo() {
  return useContext(Context);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, borderRadius: 18, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: T.line, padding: 20, alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.dangerMid, alignItems: 'center', justifyContent: 'center' },
  title: { color: T.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  body: { color: T.ink3, fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  button: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primary: { backgroundColor: T.dangerMid },
  secondary: { backgroundColor: T.surfaceMid, borderWidth: 1, borderColor: T.line },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryText: { color: T.ink, fontSize: 13, fontWeight: '800' },
});
