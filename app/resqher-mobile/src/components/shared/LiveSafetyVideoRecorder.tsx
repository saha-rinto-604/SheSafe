import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { T } from '../../constants/theme';
import { LIVE_VIDEO_CLIP_SECONDS, LIVE_VIDEO_MAX_BYTES } from '../../services/liveVideoService';

type Phase = 'preparing' | 'recording' | 'uploading' | 'error' | 'stopping';

type Props = {
  visible: boolean;
  incidentLabel?: string;
  sessionActive: boolean;
  onClipRecorded: (uri: string, clipNumber: number) => Promise<void>;
  onStopSession: () => Promise<void> | void;
};

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function LiveSafetyVideoRecorder({
  visible,
  incidentLabel,
  sessionActive,
  onClipRecorded,
  onStopSession,
}: Props) {
  const cameraRef = useRef<CameraView | null>(null);
  const recordingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const skipRequestedRef = useRef(false);
  const endingRef = useRef(false);
  const pendingUriRef = useRef<string | null>(null);
  const clipNumberRef = useRef(1);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase('stopping');
    try {
      await onStopSession();
    } finally {
      endingRef.current = false;
    }
  }, [onStopSession]);

  const stopSession = useCallback(() => {
    stopRequestedRef.current = true;
    setPhase('stopping');
    if (recordingRef.current) {
      try {
        cameraRef.current?.stopRecording();
      } catch {
        void endSession();
      }
      return;
    }
    void endSession();
  }, [endSession]);

  const stopAndSendNow = useCallback(() => {
    stopRequestedRef.current = true;
    setPhase('stopping');
    try {
      cameraRef.current?.stopRecording();
    } catch {
      void endSession();
    }
  }, [endSession]);

  const skip = useCallback(() => {
    skipRequestedRef.current = true;
    stopRequestedRef.current = true;
    setPhase('stopping');
    if (recordingRef.current) {
      try {
        cameraRef.current?.stopRecording();
      } catch {
        void endSession();
      }
      return;
    }
    void endSession();
  }, [endSession]);

  const uploadClip = useCallback(async (uri: string, number: number) => {
    pendingUriRef.current = uri;
    setPhase('uploading');
    try {
      await onClipRecorded(uri, number);
      pendingUriRef.current = null;
      await endSession();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Video upload failed. Please check your connection and try again.');
      setPhase('error');
    }
  }, [endSession, onClipRecorded]);

  const startClip = useCallback(async () => {
    const camera = cameraRef.current;
    if (
      !camera
      || recordingRef.current
      || stopRequestedRef.current
      || !visible
      || !sessionActive
      || AppState.currentState !== 'active'
    ) return;

    const number = clipNumberRef.current;
    setElapsed(0);
    setPhase('recording');
    recordingRef.current = true;
    try {
      const result = await camera.recordAsync({
        maxDuration: LIVE_VIDEO_CLIP_SECONDS,
        maxFileSize: LIVE_VIDEO_MAX_BYTES,
      });
      if (result?.uri && !skipRequestedRef.current) {
        await uploadClip(result.uri, number);
      } else if (skipRequestedRef.current) {
        await endSession();
      } else if (!stopRequestedRef.current) {
        setErrorMessage('Video upload failed. Please check your connection and try again.');
        setPhase('error');
      }
    } catch {
      if (!stopRequestedRef.current) {
        setErrorMessage('Video upload failed. Please check your connection and try again.');
        setPhase('error');
      }
    } finally {
      recordingRef.current = false;
      if (stopRequestedRef.current && !pendingUriRef.current) {
        void endSession();
      }
    }
  }, [endSession, sessionActive, uploadClip, visible]);

  const retryUpload = useCallback(() => {
    const uri = pendingUriRef.current;
    if (!uri) {
      stopSession();
      return;
    }
    void uploadClip(uri, clipNumberRef.current);
  }, [stopSession, uploadClip]);

  useEffect(() => {
    if (!visible) return;
    stopRequestedRef.current = false;
    skipRequestedRef.current = false;
    endingRef.current = false;
    pendingUriRef.current = null;
    clipNumberRef.current = 1;
    const resetTimer = setTimeout(() => {
      setElapsed(0);
      setErrorMessage('');
      setPhase('preparing');
      setCameraReady(false);
    }, 0);

    let cancelled = false;
    async function requestPermissions() {
      try {
        const cameraStatus = await Camera.getCameraPermissionsAsync();
        const cameraResult = cameraStatus.granted ? cameraStatus : await Camera.requestCameraPermissionsAsync();
        if (!cameraResult.granted) {
          setErrorMessage('Camera permission is needed to start Live Safety Video.');
          setPhase('error');
          return;
        }
        const micStatus = await Camera.getMicrophonePermissionsAsync();
        const micResult = micStatus.granted ? micStatus : await Camera.requestMicrophonePermissionsAsync();
        if (!micResult.granted) {
          setErrorMessage('Microphone permission is needed to include audio.');
          setPhase('error');
          return;
        }
        if (!cancelled) setHasPermissions(true);
      } catch {
        if (!cancelled) {
          setErrorMessage('Camera permission is needed to start Live Safety Video.');
          setPhase('error');
        }
      }
    }
    void requestPermissions();
    return () => {
      cancelled = true;
      clearTimeout(resetTimer);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !hasPermissions || !cameraReady || phase !== 'preparing') return;
    const timer = setTimeout(() => void startClip(), 400);
    return () => clearTimeout(timer);
  }, [cameraReady, hasPermissions, phase, startClip, visible]);

  useEffect(() => {
    if (!visible || phase !== 'recording') return;
    const timer = setInterval(() => setElapsed(prev => Math.min(prev + 1, LIVE_VIDEO_CLIP_SECONDS)), 1000);
    return () => clearInterval(timer);
  }, [phase, visible]);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') stopSession();
    });
    return () => subscription.remove();
  }, [stopSession, visible]);

  useEffect(() => {
    if (visible) return;
    stopRequestedRef.current = true;
    if (recordingRef.current) {
      try {
        cameraRef.current?.stopRecording();
      } catch {
        // The camera may already be stopping as the screen closes.
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || sessionActive) return;
    const timer = setTimeout(stopSession, 0);
    return () => clearTimeout(timer);
  }, [sessionActive, stopSession, visible]);

  const statusText = phase === 'recording'
    ? 'Recording'
    : phase === 'uploading'
      ? 'Uploading safety clip...'
      : phase === 'stopping'
          ? 'Ending Live Safety Video...'
          : 'Saving Evidence Clip';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        {hasPermissions ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            mode="video"
            facing="front"
            mute={false}
            mirror
            active={visible && sessionActive}
            videoQuality="480p"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => {
              setErrorMessage('Camera permission is needed to start Live Safety Video.');
              setPhase('error');
            }}
          />
        ) : (
          <View style={styles.loadingLayer}><ActivityIndicator color="#FFFFFF" size="large" /></View>
        )}

        <View style={styles.topOverlay} pointerEvents="box-none">
          <BlurView intensity={35} tint="dark" style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.dot, phase === 'recording' && styles.dotActive]} />
              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle}>{statusText}</Text>
                <Text style={styles.clipText}>One 20-second saved evidence clip</Text>
              </View>
            </View>
            <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
          </BlurView>
          <Text style={styles.contextText}>{incidentLabel || 'Active SOS'} - Evidence Clip</Text>
        </View>

        {phase === 'error' && (
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <View style={styles.dialogIcon}>
                <Feather name={phase === 'error' ? 'alert-circle' : 'video'} size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.dialogTitle}>
                Evidence Clip needs attention
              </Text>
              <Text style={styles.dialogBody}>
                {errorMessage}
              </Text>
              <View style={styles.dialogActions}>
                <TouchableOpacity style={styles.primaryButton} onPress={retryUpload}>
                  <Text style={styles.primaryText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={skip}>
                  <Text style={styles.secondaryText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bottomOverlay}>
          {phase === 'preparing' && (
            <View style={styles.waitCard}>
              <ActivityIndicator color={T.violet} />
              <Text style={styles.waitText}>The live stream has ended. SheSafe will record one short 20-second safety evidence clip.</Text>
            </View>
          )}
          {phase === 'uploading' && <View style={styles.waitCard}><ActivityIndicator color={T.violet} /><Text style={styles.waitText}>Uploading Evidence Clip...</Text></View>}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.stopButton, phase === 'stopping' && styles.stopButtonDisabled]} activeOpacity={0.82} onPress={stopAndSendNow} disabled={phase !== 'recording'}>
              <Feather name="send" size={18} color="#FFFFFF" />
              <Text style={styles.stopButtonText}>Stop & Send Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} activeOpacity={0.82} onPress={skip} disabled={phase === 'uploading'}>
              <Text style={styles.stopButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>

        {Platform.OS === 'android' && <View style={styles.androidSafeInset} pointerEvents="none" />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  loadingLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  topOverlay: { position: 'absolute', left: 16, right: 16, top: 44, gap: 10 },
  header: { minHeight: 58, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  headerCopy: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.42)' },
  dotActive: { backgroundColor: '#EF4444' },
  headerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  clipText: { color: 'rgba(255,255,255,0.64)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  timer: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  contextText: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  dialogBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 4 },
  dialogCard: { width: '100%', maxWidth: 420, borderRadius: 18, backgroundColor: '#1E153A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 20, alignItems: 'center', gap: 12 },
  dialogIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  dialogBody: { color: T.ink3, fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '600' },
  dialogActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  primaryButton: { minHeight: 44, borderRadius: 13, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', flex: 1 },
  secondaryButton: { minHeight: 44, borderRadius: 13, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', flex: 1 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryText: { color: T.ink, fontSize: 13, fontWeight: '800' },
  bottomOverlay: { position: 'absolute', left: 20, right: 20, bottom: 36, alignItems: 'center', gap: 14, zIndex: 5 },
  actionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  stopButton: { minHeight: 56, borderRadius: 16, paddingHorizontal: 24, backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  skipButton: { minHeight: 56, borderRadius: 16, paddingHorizontal: 24, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  stopButtonDisabled: { opacity: 0.7 },
  stopButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  waitCard: { minHeight: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  waitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  androidSafeInset: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, backgroundColor: '#000000' },
});
