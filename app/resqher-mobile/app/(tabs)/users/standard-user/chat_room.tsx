/**
 * chat_room.tsx — Tactical Group Chat (SF-04)
 * ─────────────────────────────────────────────────────────────────────────
 * AtmosphericShell + Directional PillBubble tails (R.pill, radius-0 near avatar).
 * Floating Glass Capsule Header with BlurView glassmorphism.
 * Victim T.danger border glow priority. Icon-only Full View map pill.
 * RESOLVED = "Incident Archived — Case Read-Only" glass pill.
 * LIVE = Floating glass pill input above safe area.
 * Frontend-only, self-contained mock data with auto-reply.
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
    Platform, StatusBar, KeyboardAvoidingView, Keyboard, Image,
    Modal, Pressable, Alert, BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import { DEFAULT_GROUP_CHAT_NAME, type Incident, type Message, type Role } from '../../../../src/types/chat';
import { useChatSocket } from '../../../../src/hooks/useChatSocket';
import { incidentService } from '../../../../src/services/incidentService';
import { chatService } from '../../../../src/services/chatService';
import { incidentHistory } from '../../../../src/services/incidentHistory';
import { notificationStore } from '../../../../src/services/notificationStore';
import { useAuth } from '../../../../src/context/AuthContext';

// ─── Constants ──────────────────────────────────────────────────────────────
const MAP_STRIP_HEIGHT = 180;

// ─── Mock Incidents (lookup) ────────────────────────────────────────────────
const MOCK_INCIDENTS: Record<string, Incident> = {
    'inc-001': {
        id: 'inc-001', type: 'SOS Alert', status: 'LIVE',
        location: { latitude: 23.7956, longitude: 90.3657, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'I need help', sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 3, createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    'inc-002': {
        id: 'inc-002', type: 'Medical Emergency', status: 'RESOLVED',
        location: { latitude: 23.7461, longitude: 90.3742, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'Patient stabilized. Ambulance arrived.', sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 2, createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    'inc-003': {
        id: 'inc-003', type: 'Harassment Report', status: 'RESOLVED',
        location: { latitude: 23.7806, longitude: 90.4194, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'Case filed', sender: { id: 'p1', name: 'Officer Alam', role: 'POLICE' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 4, createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
};

// ─── Mock initial messages per incident ─────────────────────────────────────
const INITIAL_MESSAGES: Record<string, Message[]> = {
    'inc-001': [
        {
            id: 'm-sys-1', incidentId: 'inc-001',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Emergency incident created. Responders notified.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 300000).toISOString(),
        },
        {
            id: 'm1', incidentId: 'inc-001',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            content: 'I need help, someone is following me near Ibrahimpur Bazar, Mirpur',
            type: 'TEXT', timestamp: new Date(Date.now() - 240000).toISOString(),
        },
        {
            id: 'm2', incidentId: 'inc-001',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'Stay calm, I\'m nearby. Can you share your exact location?',
            type: 'TEXT', timestamp: new Date(Date.now() - 180000).toISOString(),
        },
        {
            id: 'm3', incidentId: 'inc-001',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            content: 'I\'m at the bus stop near Ibrahimpur Bazar, Mirpur',
            type: 'TEXT', timestamp: new Date(Date.now() - 120000).toISOString(),
        },
        {
            id: 'm-sys-2', incidentId: 'inc-001',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: '📎 New evidence uploaded · [View]',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 90000).toISOString(),
            evidenceId: 'ev-001',
        },
        {
            id: 'm4', incidentId: 'inc-001',
            sender: { id: 'p1', name: 'Officer Alam', role: 'POLICE' },
            content: 'Unit dispatched to your location. Stay visible and in a lighted area.',
            type: 'TEXT', timestamp: new Date(Date.now() - 60000).toISOString(),
        },
        {
            id: 'm5', incidentId: 'inc-001',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'I can see you. Wearing a blue vest, approaching from the north side.',
            type: 'TEXT', timestamp: new Date(Date.now() - 30000).toISOString(),
        },
    ],
    'inc-002': [
        {
            id: 'm-sys-3', incidentId: 'inc-002',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Medical emergency reported. Nearest volunteers alerted.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 600000).toISOString(),
        },
        {
            id: 'm6', incidentId: 'inc-002',
            sender: { id: 'u2', name: 'Nadia Akter', role: 'USER' },
            content: 'My friend collapsed, we\'re at Dhanmondi Lake park area',
            type: 'TEXT', timestamp: new Date(Date.now() - 500000).toISOString(),
        },
        {
            id: 'm7', incidentId: 'inc-002',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'Volunteer en route, ETA 4 minutes',
            type: 'TEXT', timestamp: new Date(Date.now() - 30000).toISOString(),
        },
    ],
    'inc-003': [
        {
            id: 'm-sys-4', incidentId: 'inc-003',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Incident resolved by Officer Alam.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 1900000).toISOString(),
        },
        {
            id: 'm8', incidentId: 'inc-003',
            sender: { id: 'p1', name: 'Officer Alam', role: 'POLICE' },
            content: 'Case filed. Reference: BD-2026-03-04-0891',
            type: 'TEXT', timestamp: new Date(Date.now() - 1800000).toISOString(),
        },
    ],
};

// ─── Mock auto-reply pool ───────────────────────────────────────────────────
const VOLUNTEER_REPLIES = [
    'Copy that, I\'m 3 minutes away. Stay in a public area.',
    'Understood. Coordinating with nearby responders.',
    'Location received. Heading your way now.',
    'Keep your phone visible. I\'ll find you.',
    'Police have been updated with this info.',
];

// ─── Role badge config ──────────────────────────────────────────────────────
const ROLE_META: Record<Role, {
    label: string; color: string; bg: string; border: string;
    icon: keyof typeof Feather.glyphMap;
    gradientFrom: string; gradientTo: string;
}> = {
    USER: {
        label: 'VICTIM', color: T.dangerText, bg: T.dangerBg,
        border: T.dangerBorder, icon: 'alert-circle',
        gradientFrom: T.danger, gradientTo: '#991B1B',
    },
    VOLUNTEER: {
        label: 'VOLUNTEER', color: '#C4B5FD', bg: T.violetDim,
        border: 'rgba(138,56,246,0.25)', icon: 'heart',
        gradientFrom: T.violet, gradientTo: T.violetDark,
    },
    POLICE: {
        label: 'POLICE', color: '#6EE7B7', bg: T.safeLight,
        border: 'rgba(16,185,129,0.25)', icon: 'shield',
        gradientFrom: T.success, gradientTo: '#047857',
    },
};



// ─── Helpers ────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
}

function caseLabel(id: string, createdAt: string): string {
    const year = new Date(createdAt).getFullYear();
    const num = id.replace(/\D/g, '').padStart(3, '0');
    return `CASE #${year}-${num}`;
}

// ─── RoleBadge ──────────────────────────────────────────────────────────────
const RoleBadge = memo(function RoleBadge({ role }: { role: Role }) {
    const meta = ROLE_META[role];
    return (
        <View style={st.roleBadge}>
            <Text style={[st.roleBadgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
        </View>
    );
});


const SystemBubble = memo(function SystemBubble({ msg }: { msg: Message }) {
    const isEvidence = !!msg.evidenceId;
    return (
        <View style={st.systemWrap}>
            <View style={st.systemLine} />
            <View style={st.systemPill}>
                {isEvidence && <Feather name="paperclip" size={10} color={T.violet} style={{ marginRight: 3 }} />}
                <Text style={[st.systemText, isEvidence && st.systemTextEvidence]}>
                    {msg.content}
                </Text>
            </View>
            <View style={st.systemLine} />
        </View>
    );
});

// ─── PillBubble — Directional tail (R.pill 3 corners, 0 near avatar) ───────
const PillBubble = memo(function PillBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
    if (msg.type === 'SYSTEM') return <SystemBubble msg={msg} />;

    const role = msg.sender.role;
    const isVictimMessage = role === 'USER' && msg.sender.id !== 'system';
    const alignRight = isOwn || isVictimMessage;

    // Directional radii per exact design specs
    const tailStyle = alignRight
        ? {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomRightRadius: 2,
            borderBottomLeftRadius: 16,
        }
        : {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomRightRadius: 16,
            borderBottomLeftRadius: 2,
        };

    return (
        <View style={[st.bubbleRow, alignRight ? st.bubbleRowOwn : st.bubbleRowOther]}>
            {/* Avatar for others */}
            {!alignRight && (
                <Image
                    source={{ uri: `https://i.pravatar.cc/150?u=${msg.sender.id}` }}
                    style={st.avatar}
                />
            )}

            <View style={st.bubbleCol}>
                {/* Sender + badge */}
                {!alignRight && (
                    <View style={st.senderRow}>
                        <Text style={st.senderName}>
                            {msg.sender.name}
                        </Text>
                        <RoleBadge role={role} />
                    </View>
                )}

                {/* Directional pill bubble */}
                <View style={[
                    st.bubble,
                    alignRight ? st.bubbleOwn : st.bubbleOther,
                    tailStyle,
                ]}>
                    {/* Separate absolute view for glass effect to preserve pure white text */}
                    {!alignRight && <View style={[StyleSheet.absoluteFill, st.bubbleOtherBg, tailStyle]} />}
                    {/* Audio type */}
                    {msg.type === 'AUDIO' ? (
                        <View style={st.audioWrap}>
                            <TouchableOpacity style={st.audioPlayBtn}>
                                <Feather name="play" size={13} color={T.onPrimary} />
                            </TouchableOpacity>
                            <View style={st.audioWaveform}>
                                {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.3, 0.65, 0.5, 0.85, 0.4, 0.55, 0.7, 0.3].map((h, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            st.waveBar,
                                            {
                                                height: h * 18,
                                                backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : T.ink4,
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={st.audioDur}>0:22</Text>
                        </View>
                    ) : msg.type === 'IMAGE' ? (
                        <View style={st.imageWrap}>
                            <Feather name="image" size={22} color={T.ink4} />
                            <Text style={st.imageLabel}>Photo attached</Text>
                        </View>
                    ) : (
                        <Text style={[
                            st.msgText,
                            alignRight && st.msgTextOwn
                        ]}>
                            {msg.content}
                        </Text>
                    )}
                </View>

                {/* Timestamp */}
                <Text style={[st.msgTime, alignRight && st.msgTimeOwn]}>
                    {formatTime(msg.timestamp)}
                </Text>
            </View>
        </View>
    );
});



// ─── Floating Glass Pill Input ──────────────────────────────────────────────
function FloatingInput({ onSend, onPhoto, onAudio, bottomInset }: {
    onSend: (text: string) => void;
    onPhoto?: () => void;
    onAudio?: () => void;
    bottomInset: number;
}) {
    const [text, setText] = useState('');
    const [isAttachMenuVisible, setAttachMenuVisible] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const hasText = text.trim().length > 0;

    const handleSend = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        Haptics.selectionAsync();
        onSend(trimmed);
        setText('');
    };

    return (
        <View style={[st.inputOuter, { paddingBottom: Math.max(bottomInset, 30) }]}>
            {/* ── Floating Evidence Menu ── */}
            {isAttachMenuVisible && (
                <View style={st.attachMenuOuter}>
                    <TouchableOpacity
                        style={st.attachOptionRow}
                        activeOpacity={0.7}
                        onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(false); onAudio?.(); }}
                    >
                        <Feather name="mic" size={20} color="#FFFFFF" />
                        <Text style={st.attachOptionText}>Voice Note</Text>
                    </TouchableOpacity>

                    <View style={st.attachOptionDivider} />

                    <TouchableOpacity
                        style={[st.attachOptionRow, { paddingBottom: 12 }]}
                        activeOpacity={0.7}
                        onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(false); onPhoto?.(); }}
                    >
                        <Feather name="image" size={20} color="#FFFFFF" />
                        <Text style={st.attachOptionText}>Send Photo</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={st.inputPillContainer}>
                {/* Background equivalent to #1E153A @ 0.45 */}
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
                    <View style={[StyleSheet.absoluteFill, st.inputPillBg]} />
                </BlurView>

                <View style={st.inputPill}>
                    {/* Attach button */}
                    <TouchableOpacity
                        style={st.inputAction}
                        onPress={() => {
                            Haptics.selectionAsync();
                            setAttachMenuVisible(!isAttachMenuVisible);
                        }}
                        activeOpacity={0.7}
                    >
                        <Feather name="paperclip" size={20} color={isAttachMenuVisible ? T.violet : "#FFFFFF"} />
                    </TouchableOpacity>

                    {/* Text input */}
                    <TextInput
                        ref={inputRef}
                        style={st.input}
                        placeholder="Type a message…"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={text}
                        onChangeText={setText}
                        multiline
                        maxLength={2000}
                        onFocus={() => setAttachMenuVisible(false)}
                    />

                    {/* Send */}
                    <TouchableOpacity
                        style={[st.sendBtn, !hasText && st.sendBtnOff]}
                        onPress={handleSend}
                        disabled={!hasText}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// ─── Read-Only Archive Pill (RESOLVED state) ────────────────────────────────
function ArchivePill({ bottomInset, onDelete }: { bottomInset: number; onDelete: () => void }) {
    return (
        <View style={[st.archiveOuter, { paddingBottom: Math.max(bottomInset, S.s4) }]}>
            <BlurView intensity={30} tint="dark" style={st.archiveBlur}>
                <View style={st.archiveInner}>
                    <Feather name="lock" size={13} color={T.ink4} />
                    <Text style={st.archiveText}>Incident Archived — Case Read-Only</Text>
                </View>
            </BlurView>
            <TouchableOpacity style={st.archiveDeleteBtn} onPress={onDelete} activeOpacity={0.75}>
                <Feather name="trash-2" size={14} color="#FF453A" />
                <Text style={st.archiveDeleteText}>Delete Incident</Text>
            </TouchableOpacity>
        </View>
    );
}

// ─── Main — Chat Room ───────────────────────────────────────────────────────
export default function ChatRoom() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userId } = useAuth();
    const {
        incidentId: rawIncidentId,
        autoMessage,
        userLat,
        userLng,
        userAddress,
        joinMode,
    } = useLocalSearchParams<{
        incidentId: string;
        autoMessage?: string;
        userLat?: string;
        userLng?: string;
        userAddress?: string;
        joinMode?: string;
    }>();
    const incidentId = rawIncidentId || 'inc-001';
    const isJoiner = joinMode === 'true';
    const autoSent = useRef(false);

    // Block hardware back during an active SOS session
    useFocusEffect(
        useCallback(() => {
            if (autoMessage !== 'true') return;
            const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
            return () => sub.remove();
        }, [autoMessage])
    );

    // Live backend data
    const { messages, sendMessage, isConnected } = useChatSocket(incidentId, userId ?? undefined);

    const [incident, setIncident] = useState<Incident | null>(null);
    const flatRef = useRef<FlatList>(null);
    const isLive = (incident?.status ?? 'LIVE') === 'LIVE';
    const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);

    const isRealIncident = !!incidentId && !incidentId.startsWith('temp-') && incidentId !== 'sos-new';

    // Load incident metadata and join as participant
    useEffect(() => {
        incidentService.getOne(incidentId)
            .then((raw) => {
                setIncident({
                    id: String(raw.id),
                    type: 'SOS Alert',
                    status: raw.status === 'ACTIVE' ? 'LIVE' : raw.status as any,
                    location: {
                        latitude: Number(raw.latitude),
                        longitude: Number(raw.longitude),
                        updatedAt: raw.created_at,
                    },
                    participantCount: 1,
                    createdAt: raw.created_at,
                });
            })
            .catch(() => {
                setIncident(MOCK_INCIDENTS[incidentId] ?? MOCK_INCIDENTS['inc-001']);
            });

        if (isRealIncident) {
            chatService.joinIncident(incidentId).catch(() => {});
        }
    }, [incidentId]);

    // Auto-send location + help message when chat opens from SOS trigger.
    // Checks SecureStore directly (1200ms after mount) to avoid race conditions
    // where two useEffects compete to set/read the same ref.
    useEffect(() => {
        if (autoMessage !== 'true') return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            if (cancelled) return;
            // If we already sent for this incidentId, skip
            const sentFor = await SecureStore.getItemAsync('resqher_sos_autosent_v1');
            if (sentFor === incidentId) { autoSent.current = true; return; }

            const lat = parseFloat(userLat ?? '');
            const lng = parseFloat(userLng ?? '');
            const hasCoords = isFinite(lat) && isFinite(lng);
            const locationText = hasCoords
                ? `📍 My location: ${lat.toFixed(5)}, ${lng.toFixed(5)}${userAddress ? ` (${userAddress})` : ''}`
                : '📍 Location not available';

            sendMessage('🆘 SOS ALERT — I need immediate help!', 'TEXT');
            setTimeout(() => { if (!cancelled) sendMessage(locationText, 'TEXT'); }, 600);
            autoSent.current = true;
            await SecureStore.setItemAsync('resqher_sos_autosent_v1', incidentId);
        }, 1200);
        return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoMessage, incidentId]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
        }
    }, [messages.length]);

    const handleSend = useCallback((text: string) => {
        sendMessage(text, 'TEXT');
    }, [sendMessage]);

    const handleSendPhoto = useCallback(async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Allow photo library access to send photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]?.uri) {
            sendMessage(result.assets[0].uri, 'IMAGE');
        }
    }, [sendMessage]);

    const handleSendAudio = useCallback(async () => {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Allow microphone access to record audio.');
            return;
        }
        try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            // Record for max 30 s, then stop automatically
            Alert.alert(
                'Recording…',
                'Tap OK to stop and send the voice note.',
                [{ text: 'Send', onPress: async () => {
                    await recording.stopAndUnloadAsync();
                    const uri = recording.getURI();
                    if (uri) sendMessage(uri, 'AUDIO');
                }}],
                { cancelable: false }
            );
        } catch {
            Alert.alert('Error', 'Could not start recording.');
        }
    }, [sendMessage]);

    const selfId = userId ?? 'self';
    const chatTitle = incident
        ? `${incident.type} · ${caseLabel(incident.id, incident.createdAt)}`
        : DEFAULT_GROUP_CHAT_NAME;

    const isSOSSession = autoMessage === 'true';

    const clearSOSAndLeave = useCallback(async () => {
        await SecureStore.deleteItemAsync('resqher_active_sos_v1');
        router.replace('/(tabs)/users/standard-user/sos_screen' as any);
    }, [router]);

    const afterAction = useCallback(() => {
        setHeaderMenuOpen(false);
        if (isSOSSession) {
            router.replace('/(tabs)/users/standard-user/sos_screen' as any);
        } else {
            router.back();
        }
    }, [isSOSSession, router]);

    const handleResolve = useCallback(() => {
        Alert.alert(
            'Mark as Resolved',
            'This will close the incident and notify all participants.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Resolve', onPress: async () => {
                        try {
                            if (isRealIncident) await incidentService.resolveIncident(incidentId);
                        } catch { /* best-effort */ }
                        await incidentHistory.updateStatus(incidentId, 'RESOLVED');
                        await notificationStore.add({
                            type: 'incident_resolved',
                            title: 'Incident Resolved',
                            body: `Incident ${incidentId} has been marked as resolved`,
                            incidentId,
                        });
                        await SecureStore.deleteItemAsync('resqher_active_sos_v1');
                        await SecureStore.deleteItemAsync('resqher_sos_autosent_v1');
                        afterAction();
                    },
                },
            ]
        );
    }, [incidentId, isRealIncident, afterAction]);

    const handleCloseIncident = useCallback(() => {
        Alert.alert(
            'Close Incident',
            'Cancel this incident and remove it from active chats.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close', style: 'destructive', onPress: async () => {
                        try {
                            if (isRealIncident) await incidentService.cancelIncident(incidentId);
                        } catch { /* best-effort */ }
                        await incidentHistory.updateStatus(incidentId, 'CANCELLED');
                        await notificationStore.add({
                            type: 'incident_cancelled',
                            title: 'Incident Closed',
                            body: `Incident ${incidentId} has been cancelled`,
                            incidentId,
                        });
                        await SecureStore.deleteItemAsync('resqher_active_sos_v1');
                        await SecureStore.deleteItemAsync('resqher_sos_autosent_v1');
                        afterAction();
                    },
                },
            ]
        );
    }, [incidentId, isRealIncident, afterAction]);

    const handleDeleteIncident = useCallback(() => {
        Alert.alert(
            'Delete Incident',
            'This will permanently remove this chat from your history.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        await incidentHistory.remove(incidentId);
                        router.back();
                    },
                },
            ]
        );
    }, [incidentId, router]);

    const handleBack = useCallback(() => {
        Haptics.selectionAsync();
        if (isSOSSession) {
            Alert.alert(
                'Leave Emergency Chat?',
                'This is an active SOS session. Are you sure you want to leave?',
                [
                    { text: 'Stay', style: 'cancel' },
                    {
                        text: 'Leave', style: 'destructive',
                        onPress: () => router.replace('/(tabs)/users/standard-user/sos_screen' as any),
                    },
                ]
            );
        } else {
            router.back();
        }
    }, [isSOSSession, router]);

    const renderMessage = useCallback(({ item }: { item: Message }) => (
        <PillBubble msg={item} isOwn={item.sender.id === selfId} />
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [selfId]);

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Floating Capsule Header (glass, inset from edges) ── */}
                <View style={st.headerOuter}>
                    <BlurView intensity={50} tint="dark" style={st.headerBlur}>
                        <View style={st.headerInner}>

                            {/* ── LEFT ZONE (Navigation & Profile) ── */}
                            <View style={st.headerLeft}>
                                <TouchableOpacity
                                    onPress={handleBack}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    style={st.headerBtn}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="chevron-left" size={22} color={T.ink} />
                                </TouchableOpacity>

                                <View style={st.headerTitleBlock}>
                                    <Text style={st.headerTitle} numberOfLines={1}>
                                        {chatTitle}
                                    </Text>
                                    <View style={st.headerMeta}>
                                        <View style={[
                                            st.headerStatusPill,
                                            isLive ? st.headerStatusPillLive : st.headerStatusPillArchived,
                                        ]}>
                                            <Text style={isLive ? st.headerStatusTextLive : st.headerStatusTextArchived}>
                                                {isLive ? 'LIVE' : 'ARCHIVED'}
                                            </Text>
                                        </View>
                                        <View style={st.connPill}>
                                            <View style={[st.connDot, { backgroundColor: isConnected ? T.success : T.ink5 }]} />
                                            <Text style={st.connTxt}>{isConnected ? 'Connected' : 'Reconnecting…'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* ── RIGHT ZONE (System Actions) ── */}
                            <View style={st.headerRight}>
                                <TouchableOpacity
                                    style={st.liveMapCircularBtn}
                                    activeOpacity={0.7}
                                    onPress={handleBack}
                                >
                                    <View style={[StyleSheet.absoluteFill, st.liveMapCircularBg]} />
                                    <Feather name="map" size={18} color="#FFFFFF" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={st.headerMenuBtn}
                                    activeOpacity={0.7}
                                    onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(true); }}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                >
                                    <Feather name="more-vertical" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>

                        </View>
                    </BlurView>
                </View>

                {/* ── 12px Breathing Space Spacer ──────────────────────────────── */}
                <View style={{ marginTop: 12 }} />

                {/* ── SOS Action Bar — visible only for active SOS sessions ── */}
                {isSOSSession && (
                    <View style={st.sosActionBar}>
                        <View style={st.sosActivePill}>
                            <View style={st.sosActiveDot} />
                            <Text style={st.sosActiveText}>ACTIVE SOS</Text>
                        </View>
                        <View style={st.sosActionBtns}>
                            <TouchableOpacity style={st.resolveBtn} onPress={handleResolve} activeOpacity={0.8}>
                                <Feather name="check-circle" size={13} color="#34C759" />
                                <Text style={st.resolveBtnText}>Resolve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={st.closeIncidentBtn} onPress={handleCloseIncident} activeOpacity={0.8}>
                                <Feather name="x-circle" size={13} color="#FF453A" />
                                <Text style={st.closeIncidentBtnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── Messages + Input ────────────────────── */}
                <KeyboardAvoidingView
                    style={st.chatArea}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={insets.top + 56}
                >
                    <FlatList
                        ref={flatRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.id}
                        contentContainerStyle={st.messageList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={Keyboard.dismiss}
                        ListEmptyComponent={
                            <View style={st.emptyChat}>
                                <View style={st.emptyChatCircle}>
                                    <Feather name="message-circle" size={24} color={T.ink5} />
                                </View>
                                <Text style={st.emptyChatText}>No messages yet</Text>
                            </View>
                        }
                    />

                    {/* ── Input or Archive Pill ───────────── */}
                    {isLive ? (
                        <FloatingInput onSend={handleSend} onPhoto={handleSendPhoto} onAudio={handleSendAudio} bottomInset={insets.bottom} />
                    ) : (
                        <ArchivePill bottomInset={insets.bottom} onDelete={handleDeleteIncident} />
                    )}
                </KeyboardAvoidingView>

                {/* ── Modal Overlay for Header Menu ── */}
                <Modal transparent={true} visible={isHeaderMenuOpen} animationType="fade">
                    <Pressable style={st.headerMenuBackdrop} onPress={() => setHeaderMenuOpen(false)}>
                        <View style={st.headerMenuPanel}>
                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); }}
                            >
                                <Feather name="users" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>View Responders</Text>
                            </TouchableOpacity>

                            <View style={st.headerMenuDivider} />

                            {isLive ? (
                                <>
                                    {!isJoiner && (
                                        <>
                                            <TouchableOpacity
                                                style={st.headerMenuRow}
                                                activeOpacity={0.7}
                                                onPress={handleResolve}
                                            >
                                                <Feather name="check-circle" size={16} color="#34C759" />
                                                <Text style={[st.headerMenuText, { color: '#34C759' }]}>Mark as Resolved</Text>
                                            </TouchableOpacity>

                                            <View style={st.headerMenuDivider} />

                                            <TouchableOpacity
                                                style={st.headerMenuRow}
                                                activeOpacity={0.7}
                                                onPress={handleCloseIncident}
                                            >
                                                <Feather name="x-circle" size={16} color="#FF453A" />
                                                <Text style={[st.headerMenuText, st.headerMenuTextDanger]}>Close Incident</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                    {isJoiner && (
                                        <TouchableOpacity
                                            style={st.headerMenuRow}
                                            activeOpacity={0.7}
                                            onPress={() => { setHeaderMenuOpen(false); router.back(); }}
                                        >
                                            <Feather name="log-out" size={16} color={T.ink3} />
                                            <Text style={st.headerMenuText}>Leave Chat</Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={st.headerMenuRow}
                                    activeOpacity={0.7}
                                    onPress={() => { setHeaderMenuOpen(false); handleDeleteIncident(); }}
                                >
                                    <Feather name="trash-2" size={16} color="#FF453A" />
                                    <Text style={[st.headerMenuText, st.headerMenuTextDanger]}>Delete Incident</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Pressable>
                </Modal>
            </View>
        </AtmosphericShell>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
    root: { flex: 1 },

    // ── SOS Action Bar
    sosActionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: S.s3,
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(255,69,58,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,69,58,0.25)',
    },
    sosActivePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sosActiveDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#FF453A',
    },
    sosActiveText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FF453A',
        letterSpacing: 1,
    },
    sosActionBtns: {
        flexDirection: 'row',
        gap: 8,
    },
    resolveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(52,199,89,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(52,199,89,0.30)',
    },
    resolveBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#34C759',
    },
    closeIncidentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(255,69,58,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,69,58,0.28)',
    },
    closeIncidentBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FF453A',
    },

    // ── Floating Capsule Header — glassmorphism, inset from edges
    headerOuter: {
        paddingHorizontal: S.s3,
        paddingTop: S.s2,
        paddingBottom: S.s2,
        marginBottom: 12,
    },
    headerBlur: {
        borderRadius: R.pill,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        backgroundColor: T.surfaceBulky,
    },
    headerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: S.s3,
        paddingVertical: 8,
        minHeight: 58,
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveMapCircularBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    liveMapCircularBg: {
        backgroundColor: '#1E153A',
        opacity: 0.60,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitleBlock: {
        justifyContent: 'center',
        marginLeft: 8,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerMenuBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Header Menu Modal ──
    headerMenuBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    headerMenuPanel: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: '#1E153A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        minWidth: 220,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: { elevation: 5 },
        }),
    },
    headerMenuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    headerMenuText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    headerMenuTextDanger: {
        color: '#FF453A',
        fontWeight: 'bold',
    },
    headerMenuDivider: {
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 16,
    },

    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
    },
    headerStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
    },
    headerStatusPillLive: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}55`,
    },
    headerStatusPillArchived: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.12)',
    },
    headerStatusTextLive: {
        fontSize: 10,
        fontWeight: '700',
        color: T.violet,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    headerStatusTextArchived: {
        fontSize: 10,
        fontWeight: '700',
        color: T.ink4,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },

    // Removed Map Strip Styles

    // ── Chat area
    chatArea: { flex: 1 },
    messageList: {
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s2,
    },

    // ── Bubble row
    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: S.s2,
    },
    bubbleRowOwn: {
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
    },
    bubbleRowOther: {
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },

    // ── Avatar
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignSelf: 'flex-start',
        flexShrink: 0,
    },

    // ── Bubble column
    bubbleCol: {
        maxWidth: '75%',
    },

    // ── Sender row
    senderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s1 + 2,
        marginBottom: S.s1,
        paddingHorizontal: S.s2,
    },
    senderName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#C4C1D4',
        marginBottom: 2,
    },

    // ── Role badge
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    roleBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    // ── PillBubble — directional tail via per-corner radius
    bubble: {
        paddingVertical: S.s3,
        paddingHorizontal: S.s4,
    },
    bubbleOther: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    bubbleOtherBg: {
        backgroundColor: '#1E153A',
        opacity: 0.70,
    },
    bubbleOwn: {
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}35`,
    },
    bubbleVictim: {
    },

    // ── Message text
    msgText: {
        fontSize: 14,
        color: '#FFFFFF',
        lineHeight: 20,
    },
    msgTextOwn: {
        color: T.ink,
    },
    msgTextVictim: {
        color: '#FFFFFF',
    },
    msgTime: {
        fontSize: 10,
        color: T.ink5,
        marginTop: S.s1,
        paddingHorizontal: S.s2,
        alignSelf: 'flex-start',
    },
    msgTimeOwn: {
        alignSelf: 'flex-end',
        textAlign: 'right',
    },

    // ── System message
    systemWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s2,
        marginVertical: S.s3,
    },
    systemLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
    },
    systemPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: S.s3,
        paddingVertical: S.s1,
    },
    systemText: {
        fontSize: 11,
        color: T.ink4,
        fontStyle: 'italic',
    },
    systemTextEvidence: {
        color: T.violet,
        fontWeight: '600',
        fontStyle: 'normal',
    },

    // ── Audio
    audioWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s2,
    },
    audioPlayBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: T.violet,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioWaveform: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 22,
    },
    waveBar: {
        width: 3,
        borderRadius: 1.5,
    },
    audioDur: {
        fontSize: 10,
        color: T.ink4,
        fontWeight: '600',
    },

    // ── Image placeholder
    imageWrap: {
        width: '100%',
        height: 100,
        borderRadius: R.lg,
        backgroundColor: T.surfaceMid,
        alignItems: 'center',
        justifyContent: 'center',
        gap: S.s2,
    },
    imageLabel: {
        fontSize: 11,
        color: T.ink4,
        fontWeight: '500',
    },

    // ── Floating Glass Input
    inputOuter: {
        width: '90%',
        alignSelf: 'center',
        paddingTop: S.s2,
    },
    inputPillContainer: {
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: -3 },
            },
            android: { elevation: 8 },
        }),
    },
    inputPillBg: {
        backgroundColor: '#1E153A',
        opacity: 0.45,
    },
    inputPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
    },
    inputAction: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#FFFFFF',
        maxHeight: 100,
        paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#8A38F6',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#8A38F6',
                shadowOpacity: 0.8,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 8 },
        }),
    },
    sendBtnOff: {
        opacity: 0.5,
    },

    // ── Floating Evidence Menu ── 
    attachMenuOuter: {
        position: 'absolute',
        bottom: 70,
        left: 20,
        backgroundColor: '#1E153A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingTop: 8,
        paddingHorizontal: 8,
        minWidth: 180,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: { elevation: 5 },
        }),
        zIndex: 10,
    },
    attachOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 10,
    },
    attachOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    attachOptionDivider: {
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 8,
    },

    // ── Archive Pill (RESOLVED read-only) — centered glass capsule
    archiveOuter: {
        paddingHorizontal: S.s4,
        paddingTop: S.s2,
        alignItems: 'center',
        gap: 10,
    },
    archiveBlur: {
        borderRadius: R.pill,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        backgroundColor: T.surfaceBulky,
    },
    archiveInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s2,
        paddingHorizontal: S.s5,
        paddingVertical: S.s3,
    },
    archiveText: {
        fontSize: 13,
        fontWeight: '600',
        color: T.ink4,
        letterSpacing: 0.2,
    },
    archiveDeleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: R.pill,
        backgroundColor: 'rgba(255,69,58,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,69,58,0.28)',
    },
    archiveDeleteText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FF453A',
    },

    // ── Empty
    emptyChat: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: S.s8,
        gap: S.s2,
    },
    emptyChatCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: S.s1,
    },
    emptyChatText: {
        ...Ty.bodySm,
        color: T.ink4,
    },

    // ── Connection status pill (header subtitle row)
    connPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    connDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    connTxt: {
        fontSize: 9,
        fontWeight: '600',
        color: T.ink5,
        letterSpacing: 0.3,
    },
});
