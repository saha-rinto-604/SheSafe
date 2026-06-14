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
import { Feather } from '@expo/vector-icons';
import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';

import { T } from '../../constants/theme';
import { liveVideoService, type LiveStreamIceConfig } from '../../services/liveVideoService';
import type { LiveStreamEvent, LiveStreamSocketPayload, LiveStreamSocketType } from '../../hooks/useChatSocket';

type StreamState = 'preparing' | 'waiting' | 'connecting' | 'live' | 'ended' | 'failed';

type SignalSender = (type: LiveStreamSocketType, payload?: LiveStreamSocketPayload) => void;

type BroadcasterProps = {
  visible: boolean;
  incidentId: string;
  incidentLabel?: string;
  sessionActive: boolean;
  liveStreamEvent: LiveStreamEvent | null;
  sendSignal: SignalSender;
  onClose: () => void;
  onFallbackEvidence?: () => void;
  onStopStreaming?: () => Promise<void> | void;
  onStopAndSaveEvidence?: () => Promise<void> | void;
};

type ViewerProps = {
  visible: boolean;
  incidentId: string;
  incidentLabel?: string;
  liveStreamEvent: LiveStreamEvent | null;
  sendSignal: SignalSender;
  onClose: () => void;
};

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => {
    try { track.stop(); } catch { /* native track may already be stopped */ }
  });
  stream?.release?.();
}

function closePeer(peer: RTCPeerConnection | null) {
  try { peer?.close(); } catch { /* already closed */ }
}

function addPeerListener(peer: RTCPeerConnection, type: string, listener: (event: any) => void) {
  (peer as unknown as { addEventListener: (eventType: string, handler: (event: any) => void) => void })
    .addEventListener(type, listener);
}

function rtcConfig(iceConfig: LiveStreamIceConfig | null) {
  return { iceServers: iceConfig?.iceServers?.length ? iceConfig.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }] };
}

function logIceCounts(config: LiveStreamIceConfig) {
  const urls = config.iceServers.flatMap(server => Array.isArray(server.urls) ? server.urls : [server.urls]);
  const stunCount = urls.filter(url => String(url).startsWith('stun:')).length;
  const turnCount = urls.filter(url => String(url).startsWith('turn:') || String(url).startsWith('turns:')).length;
  console.info(`[LiveSafetyVideo] ICE config loaded: stunCount=${stunCount} turnCount=${turnCount}`);
  if (!turnCount) console.warn('[LiveSafetyVideo] TURN unavailable; stream may fail on restricted networks.');
}

// Saving the exact WebRTC live stream automatically requires server-side recording through SFU/media server.

export function LiveSafetyWebRTCBroadcaster({
  visible,
  incidentId,
  incidentLabel,
  sessionActive,
  liveStreamEvent,
  sendSignal,
  onClose,
  onFallbackEvidence,
  onStopStreaming,
  onStopAndSaveEvidence,
}: BroadcasterProps) {
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const iceConfigRef = useRef<LiveStreamIceConfig | null>(null);
  const viewerIdRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const [localStreamUrl, setLocalStreamUrl] = useState('');
  const [state, setState] = useState<StreamState>('preparing');
  const [elapsed, setElapsed] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [message, setMessage] = useState('Starting Live Safety Video...');
  const [controlVisible, setControlVisible] = useState(false);

  const cleanup = useCallback((notify = true) => {
    if (notify && !stoppingRef.current) {
      stoppingRef.current = true;
      sendSignal('live-stream:stop');
    }
    closePeer(peerRef.current);
    peerRef.current = null;
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStreamUrl('');
    setViewerCount(0);
    setState('ended');
  }, [sendSignal]);

  const createPeerForViewer = useCallback(async (viewerId: string) => {
    const stream = localStreamRef.current;
    const videoTracks = stream?.getVideoTracks() || [];
    console.info(`[LiveSafetyVideo] local video tracks count=${videoTracks.length}`);
    if (!stream || !videoTracks.length) {
      setState('failed');
      setMessage('Live stream connection failed. Try again.');
      return;
    }
    const preparedPeer = peerRef.current;
    const peer = preparedPeer && preparedPeer.connectionState === 'new'
      ? preparedPeer
      : new RTCPeerConnection(rtcConfig(iceConfigRef.current));
    if (peer !== preparedPeer) {
      closePeer(preparedPeer);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
    }
    peerRef.current = peer;
    viewerIdRef.current = viewerId;
    addPeerListener(peer, 'icecandidate', event => {
      if (event.candidate) {
        sendSignal('live-stream:ice-candidate', {
          targetUserId: viewerId,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    });
    addPeerListener(peer, 'connectionstatechange', () => {
      const connectionState = peer.connectionState;
      console.info(`[LiveSafetyVideo] peer connection state=${connectionState}`);
      if (connectionState === 'connected') {
        setState('live');
        setMessage('Live stream connected.');
        setViewerCount(1);
        setControlVisible(true);
      } else if (connectionState === 'failed' || connectionState === 'disconnected') {
        setState('failed');
        setMessage('Live stream connection failed.');
      } else {
        setState('connecting');
        setMessage('Connecting responder...');
      }
    });
    addPeerListener(peer, 'iceconnectionstatechange', () => {
      console.info(`[LiveSafetyVideo] ice connection state=${peer.iceConnectionState}`);
    });
    setState('connecting');
    setMessage('Connecting responder...');
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal('live-stream:offer', { targetUserId: viewerId, offer });
    console.info('[LiveSafetyVideo] offer sent');
  }, [sendSignal]);

  const startBroadcast = useCallback(async () => {
    stoppingRef.current = false;
    setElapsed(0);
    setState('preparing');
    setMessage('Opening front camera for Live Safety Video...');
    try {
      const iceConfig = await liveVideoService.getLiveStreamIceConfig(incidentId);
      logIceCounts(iceConfig);
      iceConfigRef.current = iceConfig;
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: 640,
          height: 480,
          frameRate: 24,
        } as any,
      });
      localStreamRef.current = stream;
      const videoTrackCount = stream.getVideoTracks().length;
      console.info(`[LiveSafetyVideo] local video tracks count=${videoTrackCount}`);
      if (!videoTrackCount) throw new Error('No local video track');
      const peer = new RTCPeerConnection(rtcConfig(iceConfig));
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      peerRef.current = peer;
      setLocalStreamUrl(stream.toURL());
      setState('waiting');
      setMessage('Live stream is ready. Waiting for responder to connect.');
      sendSignal('live-stream:start');
    } catch {
      setState('failed');
      setMessage('Camera permission is needed to start Live Safety Video.');
    }
  }, [incidentId, sendSignal]);

  useEffect(() => {
    if (!visible || state !== 'connecting') return;
    const timeout = setTimeout(() => {
      setState('failed');
      setMessage('Live stream connection failed. Try again.');
    }, 18000);
    return () => clearTimeout(timeout);
  }, [state, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      void startBroadcast();
    }, 0);
    return () => {
      clearTimeout(timer);
      cleanup(false);
    };
  }, [cleanup, startBroadcast, visible]);

  useEffect(() => {
    if (!visible || state === 'ended' || state === 'failed') return;
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [state, visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        cleanup(true);
        onClose();
      }
    });
    return () => sub.remove();
  }, [cleanup, onClose, visible]);

  useEffect(() => {
    if (!visible || sessionActive) return;
    const timer = setTimeout(() => {
      cleanup(true);
      onClose();
    }, 0);
    return () => clearTimeout(timer);
  }, [cleanup, onClose, sessionActive, visible]);

  useEffect(() => {
    if (!visible || !liveStreamEvent) return;
    const timer = setTimeout(() => {
      const payload = liveStreamEvent.payload || {};
      if (liveStreamEvent.type === 'live-stream:join' && payload.viewerId) {
        void createPeerForViewer(String(payload.viewerId));
      }
      if (liveStreamEvent.type === 'live-stream:answer' && payload.answer && peerRef.current) {
        void peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        console.info('[LiveSafetyVideo] answer received');
      }
      if (liveStreamEvent.type === 'live-stream:ice-candidate' && payload.candidate && peerRef.current) {
        void peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        console.info('[LiveSafetyVideo] candidate received');
      }
      if (liveStreamEvent.type === 'live-stream:viewer-left') {
        closePeer(peerRef.current);
        peerRef.current = null;
        viewerIdRef.current = null;
        setViewerCount(0);
        setState('waiting');
        setMessage('Responder left the live viewer. Stream remains visible until you stop.');
      }
      if (liveStreamEvent.type === 'live-stream:stop') {
        cleanup(false);
        onClose();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [cleanup, createPeerForViewer, liveStreamEvent, onClose, visible]);

  const handleStop = useCallback(() => {
    cleanup(true);
    void onStopStreaming?.();
  }, [cleanup, onStopStreaming]);

  const handleStopAndSave = useCallback(() => {
    cleanup(true);
    void onStopAndSaveEvidence?.();
  }, [cleanup, onStopAndSaveEvidence]);

  const retryConnection = useCallback(() => {
    const viewerId = viewerIdRef.current;
    if (viewerId) {
      setMessage('Reconnecting live video...');
      void createPeerForViewer(viewerId);
      return;
    }
    void startBroadcast();
  }, [createPeerForViewer, startBroadcast]);

  const handleFallback = useCallback(() => {
    sendSignal('live-stream:error', {
      allowEvidenceFallback: true,
      message: 'Live stream failed. Evidence recording fallback requested.',
    } as any);
    cleanup(false);
    onFallbackEvidence?.();
  }, [cleanup, onFallbackEvidence, sendSignal]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        {localStreamUrl ? (
          <RTCView streamURL={localStreamUrl} style={StyleSheet.absoluteFill} mirror objectFit="cover" />
        ) : (
          <View style={styles.centerLayer}><ActivityIndicator color="#FFFFFF" size="large" /></View>
        )}

        <View style={styles.topPanel}>
          <View style={styles.row}>
            <View style={[styles.liveDot, state === 'live' && styles.liveDotActive]} />
            <Text style={styles.title}>{state === 'live' ? 'LIVE' : 'Live Safety Video'}</Text>
            <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
          </View>
          <Text style={styles.body}>{incidentLabel || `Incident #${incidentId}`}</Text>
          <Text style={styles.body}>{message}</Text>
          <Text style={styles.body}>{viewerCount ? `${viewerCount} responder watching` : 'No responder connected yet'}</Text>
        </View>

        {state === 'failed' && (
          <View style={styles.dialogCard}>
            <Feather name="alert-circle" size={24} color="#FFFFFF" />
            <Text style={styles.dialogTitle}>Live stream failed</Text>
            <Text style={styles.dialogBody}>{message}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={retryConnection}>
              <Text style={styles.secondaryText}>Retry Connection</Text>
            </TouchableOpacity>
            {!!onFallbackEvidence && <TouchableOpacity style={styles.secondaryButton} onPress={handleFallback}><Text style={styles.secondaryText}>Record Evidence Clip</Text></TouchableOpacity>}
          </View>
        )}

        {controlVisible && state === 'live' && (
          <View style={styles.dialogCard}>
            <Feather name="video" size={24} color="#FFFFFF" />
            <Text style={styles.dialogTitle}>Live Safety Video is active</Text>
            <Text style={styles.dialogBody}>An accepted responder can see your live video. What do you want to do?</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setControlVisible(false)}><Text style={styles.secondaryText}>Continue</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleStop}><Text style={styles.secondaryText}>Stop Streaming</Text></TouchableOpacity>
            <TouchableOpacity style={styles.stopButton} onPress={handleStopAndSave}><Text style={styles.stopButtonText}>Stop & Save Evidence Clip</Text></TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPanel}>
          <Text style={styles.evidenceText}>
            Live stream is active. Evidence clip recording is available after the stream ends on this version.
          </Text>
          <TouchableOpacity style={styles.stopButton} onPress={handleStop} activeOpacity={0.82}>
            <Feather name="square" size={18} color="#FFFFFF" />
            <Text style={styles.stopButtonText}>Stop Streaming</Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'android' && <View style={styles.androidInset} />}
      </View>
    </Modal>
  );
}

export function LiveSafetyWebRTCViewer({
  visible,
  incidentId,
  incidentLabel,
  liveStreamEvent,
  sendSignal,
  onClose,
}: ViewerProps) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const iceConfigRef = useRef<LiveStreamIceConfig | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState('');
  const [state, setState] = useState<StreamState>('connecting');
  const [message, setMessage] = useState('Connecting to Live Safety Video...');
  const retryCountRef = useRef(0);

  const cleanup = useCallback((notify = true) => {
    if (notify) sendSignal('live-stream:viewer-left');
    closePeer(peerRef.current);
    peerRef.current = null;
    setRemoteStreamUrl('');
  }, [sendSignal]);

  const createPeer = useCallback(async () => {
    setState('connecting');
    setMessage('Connecting to Live Safety Video...');
    closePeer(peerRef.current);
    peerRef.current = null;
    setRemoteStreamUrl('');
    const iceConfig = await liveVideoService.getLiveStreamIceConfig(incidentId);
    logIceCounts(iceConfig);
    iceConfigRef.current = iceConfig;
    const peer = new RTCPeerConnection(rtcConfig(iceConfig));
    peerRef.current = peer;
    addPeerListener(peer, 'track', event => {
      const stream = event.streams?.[0];
      console.info(`[LiveSafetyVideo] remote video tracks count=${stream?.getVideoTracks().length || 0}`);
      if (stream) {
        setRemoteStreamUrl(stream.toURL());
        setState('live');
        setMessage('Live Safety Video is active.');
      }
    });
    addPeerListener(peer, 'icecandidate', event => {
      if (event.candidate) {
        sendSignal('live-stream:ice-candidate', {
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    });
    addPeerListener(peer, 'connectionstatechange', () => {
      console.info(`[LiveSafetyVideo] peer connection state=${peer.connectionState}`);
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        setState('failed');
        setMessage('Live Safety Video connection failed.');
      }
    });
    addPeerListener(peer, 'iceconnectionstatechange', () => {
      console.info(`[LiveSafetyVideo] ice connection state=${peer.iceConnectionState}`);
    });
    sendSignal('live-stream:join');
  }, [incidentId, sendSignal]);

  useEffect(() => {
    if (!visible || state !== 'connecting') return;
    const timeout = setTimeout(() => {
      if (retryCountRef.current < 2) {
        retryCountRef.current += 1;
        setMessage('Reconnecting live video...');
        void createPeer();
      } else {
        setState('failed');
        setMessage('Live stream connection failed. Try again.');
      }
    }, 16000);
    return () => clearTimeout(timeout);
  }, [createPeer, state, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      void createPeer().catch(() => {
        setState('failed');
        setMessage('Live Safety Video connection failed.');
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      cleanup(false);
    };
  }, [cleanup, createPeer, visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        cleanup(true);
        onClose();
      }
    });
    return () => sub.remove();
  }, [cleanup, onClose, visible]);

  useEffect(() => {
    if (!visible || !liveStreamEvent) return;
    const timer = setTimeout(() => {
      const payload = liveStreamEvent.payload || {};
      if (liveStreamEvent.type === 'live-stream:offer' && payload.offer && peerRef.current) {
        void (async () => {
          const peer = peerRef.current;
          if (!peer) return;
          await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal('live-stream:answer', { answer });
          console.info('[LiveSafetyVideo] answer sent');
        })();
      }
      if (liveStreamEvent.type === 'live-stream:ice-candidate' && payload.candidate && peerRef.current) {
        void peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        console.info('[LiveSafetyVideo] candidate received');
      }
      if (liveStreamEvent.type === 'live-stream:stop' || liveStreamEvent.type === 'live-stream:declined') {
        cleanup(false);
        setState('ended');
        setMessage(payload.message || 'Live Safety Video ended.');
      }
      if (liveStreamEvent.type === 'live-stream:error') {
        setState('failed');
        setMessage(payload.message || 'Live Safety Video connection failed.');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [cleanup, liveStreamEvent, sendSignal, visible]);

  const leaveViewer = useCallback(() => {
    cleanup(true);
    onClose();
  }, [cleanup, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        {remoteStreamUrl ? (
          <RTCView streamURL={remoteStreamUrl} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <View style={styles.centerLayer}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={styles.body}>{message}</Text>
          </View>
        )}

        <View style={styles.topPanel}>
          <View style={styles.row}>
            <View style={[styles.liveDot, state === 'live' && styles.liveDotActive]} />
            <Text style={styles.title}>{state === 'live' ? 'LIVE' : 'Live Safety Video'}</Text>
          </View>
          <Text style={styles.body}>{incidentLabel || `Incident #${incidentId}`}</Text>
          <Text style={styles.body}>{message}</Text>
        </View>

        {(state === 'ended' || state === 'failed') && (
          <View style={styles.dialogCard}>
            <Feather name={state === 'ended' ? 'check-circle' : 'alert-circle'} size={24} color="#FFFFFF" />
            <Text style={styles.dialogTitle}>{state === 'ended' ? 'Stream ended' : 'Connection failed'}</Text>
            <Text style={styles.dialogBody}>{message}</Text>
            {state === 'failed' && <TouchableOpacity style={styles.secondaryButton} onPress={() => { retryCountRef.current = 0; void createPeer(); }}><Text style={styles.secondaryText}>Retry Connection</Text></TouchableOpacity>}
          </View>
        )}

        <View style={styles.bottomPanel}>
          <TouchableOpacity style={styles.viewerButton} onPress={leaveViewer} activeOpacity={0.82}>
            <Feather name="x" size={18} color="#FFFFFF" />
            <Text style={styles.stopButtonText}>Leave Viewer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  centerLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  topPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 44,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(30,21,58,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.38)' },
  liveDotActive: { backgroundColor: '#EF4444' },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', flex: 1 },
  timer: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  body: { color: T.ink3, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  bottomPanel: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 36,
    alignItems: 'center',
    gap: 12,
  },
  evidenceText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  stopButton: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 24,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  viewerButton: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(30,21,58,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stopButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  dialogCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '38%',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#1E153A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    gap: 10,
  },
  dialogTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  dialogBody: { color: T.ink3, fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 13,
    paddingHorizontal: 16,
    backgroundColor: T.surfaceBulky,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: T.ink, fontSize: 13, fontWeight: '900' },
  androidInset: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, backgroundColor: '#000000' },
});
