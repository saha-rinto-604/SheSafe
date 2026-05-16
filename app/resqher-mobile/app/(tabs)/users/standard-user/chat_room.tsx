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
    Modal, Pressable, Alert
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import RespondersList from '../../../../src/components/RespondersList';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import { DEFAULT_GROUP_CHAT_NAME, type Incident, type Message, type Role } from '../../../../src/types/chat';

// ─── Constants ──────────────────────────────────────────────────────────────
const SELF_ID = 'self';
const MAP_STRIP_HEIGHT = 180;
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type Responder = {
    id: string;
    name: string;
    avatarUri: string;
    location: { latitude: number; longitude: number };
    fallbackDistance: string;
    fallbackDuration: string;
};

const RESPONDERS: Responder[] = [
    {
        id: 'v1',
        name: 'Kabir Hossain',
        avatarUri: 'https://i.pravatar.cc/150?img=11',
        location: { latitude: 23.8328, longitude: 90.4189 },
        fallbackDistance: '3.2 km',
        fallbackDuration: '~12 min',
    },
    {
        id: 'v2',
        name: 'Ayesha S.',
        avatarUri: 'https://i.pravatar.cc/150?img=20',
        location: { latitude: 23.8255, longitude: 90.4121 },
        fallbackDistance: '4.0 km',
        fallbackDuration: '~14 min',
    },
];

// Real polyline decode from Google
function polylineDecode(str: string, precision = 5) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates: { latitude: number; longitude: number }[] = [];
    let shift = 0;
    let result = 0;
    let byte = null;
    let latitudeChange;
    let longitudeChange;
    const factor = Math.pow(10, precision);

    while (index < str.length) {
        byte = null;
        shift = 0;
        result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        latitudeChange = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = 0;
        result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        longitudeChange = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitudeChange;
        lng += longitudeChange;
        coordinates.push({ latitude: lat / factor, longitude: lng / factor });
    }
    return coordinates;
}

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
        id: 'inc-003', type: 'Harassment Report', status: 'CANCELLED',
        location: { latitude: 23.7806, longitude: 90.4194, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'Incident cancelled by the victim before responder arrival.', sender: { id: 'system', name: 'System', role: 'USER' },
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
function FloatingInput({ onSend, bottomInset, onImagePicked }: { onSend: (text: string) => void; bottomInset: number; onImagePicked?: (uri: string) => void }) {
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
            {/* Attach menu as modal-like overlay so outside tap closes it */}
            <Modal transparent visible={isAttachMenuVisible} animationType="fade">
                <Pressable style={st.attachModalBackdrop} onPress={() => setAttachMenuVisible(false)}>
                    <View style={st.attachModalCard}>
                        <TouchableOpacity
                            style={st.attachOptionRow}
                            activeOpacity={0.7}
                            onPress={async () => {
                                Haptics.selectionAsync();
                                setAttachMenuVisible(false);
                                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                if (!perm.granted) {
                                    Alert.alert('Permission needed', 'Please allow access to photos.');
                                    return;
                                }
                                const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
                                if (!res.canceled && Array.isArray((res as any).assets) && (res as any).assets.length > 0) {
                                    const uri = (res as any).assets[0].uri as string | undefined;
                                    if (uri) onImagePicked?.(uri);
                                }
                            }}
                        >
                            <Feather name="image" size={20} color="#FFFFFF" />
                            <Text style={st.attachOptionText}>Photo</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

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
function ArchivePill({ bottomInset }: { bottomInset: number }) {
    return (
        <View style={[st.archiveOuter, { paddingBottom: Math.max(bottomInset, S.s4) }]}>
            <BlurView intensity={30} tint="dark" style={st.archiveBlur}>
                <View style={st.archiveInner}>
                    <Feather name="lock" size={13} color={T.ink4} />
                    <Text style={st.archiveText}>Incident Archived — Case Read-Only</Text>
                </View>
            </BlurView>
        </View>
    );
}

// ─── Main — Chat Room ───────────────────────────────────────────────────────
export default function ChatRoom() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { incidentId } = useLocalSearchParams<{ incidentId: string }>();

    const incident = MOCK_INCIDENTS[incidentId || 'inc-001'] ?? MOCK_INCIDENTS['inc-001'];
    const [messages, setMessages] = useState<Message[]>(
        INITIAL_MESSAGES[incidentId || 'inc-001'] ?? INITIAL_MESSAGES['inc-001']
    );
    const flatRef = useRef<FlatList>(null);
    const isLive = incident.status === 'LIVE';
    const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);
    const [isRespondersOpen, setRespondersOpen] = useState(false);
    const [isResponderRemovedOpen, setResponderRemovedOpen] = useState(false);
    const [respondersList, setRespondersList] = useState(() => [
        ...RESPONDERS,
        { id: 'v3', name: 'Raihan Ahmed', avatarUri: 'https://i.pravatar.cc/150?img=12', isAdmin: true, role: 'POLICE' },
        { id: 'v4', name: 'Nadia Akter', avatarUri: 'https://i.pravatar.cc/150?img=13', role: 'VOLUNTEER' },
    ]);

    const handleRemoveResponder = useCallback((id: string) => {
        setRespondersList(prev => prev.filter(r => r.id !== id));
        setResponderRemovedOpen(true);
        setTimeout(() => setResponderRemovedOpen(false), 2000);
    }, []);

    // Edit Case Details
    const [isEditCaseOpen, setEditCaseOpen] = useState(false);
    const [caseDetails, setCaseDetails] = useState(() => incident.latestMessage?.content ?? '');
    const [isSaveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
    const handleSaveCaseDetails = useCallback(() => {
        setEditCaseOpen(false);
        setSaveConfirmationOpen(true);
        setTimeout(() => setSaveConfirmationOpen(false), 2200);
    }, [caseDetails]);

    // Leave confirmation
    const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const handleConfirmLeave = useCallback(() => {
        Haptics.selectionAsync();
        setHeaderMenuOpen(false);
        setLeaveConfirmOpen(false);
        router.back();
    }, [router]);

    // Map Overlay State
    const [isMapOverlayOpen, setIsMapOverlayOpen] = useState(false);
    const [mapRouteCoords, setMapRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [mapDistance, setMapDistance] = useState('');
    const [mapDuration, setMapDuration] = useState('');
    const [isLiveNavMode, setIsLiveNavMode] = useState(false);
    const [selectedResponderId, setSelectedResponderId] = useState(RESPONDERS[0].id);
    const mapRef = useRef<MapView>(null);

    const selectedResponder = React.useMemo(
        () => RESPONDERS.find(responder => responder.id === selectedResponderId) ?? RESPONDERS[0],
        [selectedResponderId]
    );

    const loadRouteForResponder = useCallback(async (responder: Responder) => {
        const origin = `${responder.location.latitude},${responder.location.longitude}`;
        const destination = `${incident.location.latitude},${incident.location.longitude}`;

        if (!GOOGLE_MAPS_API_KEY) {
            setMapRouteCoords([responder.location, incident.location]);
            setMapDistance(responder.fallbackDistance);
            setMapDuration(responder.fallbackDuration);
            return;
        }

        try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data?.routes?.length > 0) {
                const points = data.routes[0].overview_polyline.points;
                const coords = polylineDecode(points);
                const leg = data.routes[0].legs?.[0];
                setMapRouteCoords(coords);
                setMapDistance(leg?.distance?.text ?? responder.fallbackDistance);
                setMapDuration(leg?.duration?.text ?? responder.fallbackDuration);
                setTimeout(() => {
                    mapRef.current?.fitToCoordinates(coords, {
                        edgePadding: { top: 140, right: 60, bottom: 280, left: 60 },
                        animated: true,
                    });
                }, 400);
            }
        } catch {
            Alert.alert('Error', 'Failed to load route');
        }
    }, [incident.location]);

    const handleSelectResponder = useCallback(async (responderId: string) => {
        if (responderId === selectedResponderId) return;
        Haptics.selectionAsync();
        setSelectedResponderId(responderId);
        const responder = RESPONDERS.find(item => item.id === responderId);
        if (responder) {
            await loadRouteForResponder(responder);
        }
    }, [loadRouteForResponder, selectedResponderId]);

    const openMapOverlay = useCallback(async () => {
        setIsMapOverlayOpen(true);
        Haptics.selectionAsync();
        await loadRouteForResponder(selectedResponder);
    }, [loadRouteForResponder, selectedResponder]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
        }
    }, [messages.length]);

    // Send message + mock auto-reply
    const handleSend = useCallback((text: string) => {
        const userMsg: Message = {
            id: `m-self-${Date.now()}`,
            incidentId: incident.id,
            sender: { id: SELF_ID, name: 'You', role: 'USER' },
            content: text,
            type: 'TEXT',
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMsg]);

        // Mock volunteer reply after 1 second
        setTimeout(() => {
            const reply: Message = {
                id: `m-auto-${Date.now()}`,
                incidentId: incident.id,
                sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
                content: VOLUNTEER_REPLIES[Math.floor(Math.random() * VOLUNTEER_REPLIES.length)],
                type: 'TEXT',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, reply]);
        }, 1000);
    }, [incident.id]);

    const renderMessage = useCallback(({ item }: { item: Message }) => (
        <PillBubble msg={item} isOwn={item.sender.id === SELF_ID} />
    ), []);

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
                                    onPress={() => { Haptics.selectionAsync(); router.back(); }}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    style={st.headerBtn}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="chevron-left" size={22} color={T.ink} />
                                </TouchableOpacity>

                                <View style={st.headerTitleBlock}>
                                    <Text style={st.headerTitle} numberOfLines={1}>
                                        {DEFAULT_GROUP_CHAT_NAME}
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
                                    </View>
                                </View>
                            </View>

                            {/* ── RIGHT ZONE (System Actions) ── */}
                            <View style={st.headerRight}>
                                <TouchableOpacity
                                    style={st.liveMapCircularBtn}
                                    activeOpacity={0.7}
                                    onPress={openMapOverlay}
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

                {incident.status === 'CANCELLED' && (
                    <View style={st.cancelledCard}>
                        <Feather name="x-circle" size={18} color={T.danger} />
                        <View style={st.cancelledContent}>
                            <Text style={st.cancelledTitle}>Incident Cancelled</Text>
                            <Text style={st.cancelledSubtitle}>
                                This case was cancelled and the chat has been archived for review.
                            </Text>
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
                        <FloatingInput onSend={handleSend} bottomInset={insets.bottom} onImagePicked={(uri) => {
                            const imgMsg: Message = {
                                id: `m-img-${Date.now()}`,
                                incidentId: incident.id,
                                sender: { id: SELF_ID, name: 'You', role: 'USER' },
                                content: 'Photo',
                                type: 'IMAGE',
                                timestamp: new Date().toISOString(),
                                mediaUrl: uri,
                            };
                            setMessages(prev => [...prev, imgMsg]);
                        }} />
                    ) : (
                        <ArchivePill bottomInset={insets.bottom} />
                    )}
                </KeyboardAvoidingView>

                {/* ── Modal Overlay for Header Menu ── */}
                <Modal transparent={true} visible={isHeaderMenuOpen} animationType="fade">
                    <Pressable style={st.headerMenuBackdrop} onPress={() => setHeaderMenuOpen(false)}>
                        <View style={st.headerMenuPanel}>
                                    <TouchableOpacity
                                        style={st.headerMenuRow}
                                        activeOpacity={0.7}
                                        onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); setRespondersOpen(true); }}
                                    >
                                        <Feather name="users" size={16} color="#FFFFFF" />
                                        <Text style={st.headerMenuText}>View Responders</Text>
                                    </TouchableOpacity>

                            <View style={st.headerMenuDivider} />

                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); setEditCaseOpen(true); }}
                            >
                                <Feather name="edit-2" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>Edit Case Details</Text>
                            </TouchableOpacity>

                            <View style={st.headerMenuDivider} />

                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setLeaveConfirmOpen(true); setHeaderMenuOpen(false); }}
                            >
                                <Feather name="x-circle" size={16} color="#FF453A" />
                                <Text style={[st.headerMenuText, st.headerMenuTextDanger]}>Leave Dispatch</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>

                {/* Responders List Modal (reusable component) */}
                <RespondersList
                    visible={isRespondersOpen}
                    data={respondersList as any}
                    onClose={() => setRespondersOpen(false)}
                    onRemove={(id) => handleRemoveResponder(id)}
                />

                {/* Responder Removed confirmation (styled) */}
                <Modal transparent={true} visible={isResponderRemovedOpen} animationType="fade">
                    <View style={st.saveBackdropCentered}>
                        <View style={st.saveCardColored}>
                            <Text style={st.saveTitleColored}>Responder removed</Text>
                            <Text style={st.saveMessageColored}>The responder was removed from the chat room.</Text>
                        </View>
                    </View>
                </Modal>

                {/* Edit Case Modal */}
                <Modal transparent visible={isEditCaseOpen} animationType="fade">
                    <Pressable style={st.centerBackdrop} onPress={() => setEditCaseOpen(false)}>
                        <View style={st.centerCard}>
                            <Text style={st.centerTitle}>Edit Case Details</Text>
                            <TextInput
                                value={caseDetails}
                                onChangeText={setCaseDetails}
                                multiline
                                style={st.caseInput}
                                placeholder="Describe case details..."
                                placeholderTextColor="rgba(255,255,255,0.35)"
                            />
                            <View style={st.caseBtnsRow}>
                                <TouchableOpacity style={st.caseBtnCancel} onPress={() => setEditCaseOpen(false)}>
                                    <Text style={st.caseBtnCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={st.caseBtnSave} onPress={handleSaveCaseDetails}>
                                    <Text style={st.caseBtnSaveText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Modal>

                {/* Save Confirmation Modal (styled like volunteer) */}
                <Modal transparent={true} visible={isSaveConfirmationOpen} animationType="fade">
                    <View style={st.saveBackdropCentered}>
                        <View style={st.saveCardColored}>
                            <Text style={st.saveTitleColored}>Saved</Text>
                            <Text style={st.saveMessageColored}>Case details saved.</Text>
                        </View>
                    </View>
                </Modal>

                {/* Leave Confirmation */}
                <Modal transparent visible={isLeaveConfirmOpen} animationType="fade">
                    <Pressable style={st.centerBackdrop} onPress={() => setLeaveConfirmOpen(false)}>
                        <View style={st.leaveCard}>
                            <Text style={st.leaveTitle}>Leave Dispatch?</Text>
                            <Text style={st.leaveSub}>Are you sure you want to leave this dispatch?</Text>
                            <View style={st.leaveBtnsRow}>
                                <TouchableOpacity style={st.leaveCancel} onPress={() => setLeaveConfirmOpen(false)}>
                                    <Text style={st.leaveCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={st.leaveYes} onPress={handleConfirmLeave}>
                                    <Text style={st.leaveYesText}>Yes</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Modal>

                {/* ── Map Overlay ─────────────────────────────────────────────────── */}
                {isMapOverlayOpen && (
                    <View style={StyleSheet.absoluteFill}>
                        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                        <MapView
                            ref={mapRef}
                            style={StyleSheet.absoluteFill}
                            userInterfaceStyle="dark"
                            customMapStyle={[
                                { "elementType": "geometry", "stylers": [{ "color": "#0B071A" }] },
                                { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
                                { "elementType": "labels.text.fill", "stylers": [{ "color": "#4A4568" }] },
                                { "elementType": "labels.text.stroke", "stylers": [{ "visibility": "off" }] },
                                { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
                                { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
                                { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#18142A" }] },
                                { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#05030A" }] }
                            ]}
                            pitchEnabled={true}
                            initialRegion={{
                                latitude: 23.8293,
                                longitude: 90.4182,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            }}
                        >
                            {mapRouteCoords.length > 1 && (
                                <Polyline
                                    coordinates={mapRouteCoords}
                                    strokeColor={T.violet}
                                    strokeWidth={4}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            )}
                            {mapRouteCoords.length > 0 && (
                                <>
                                    {/* Responder Marker A */}
                                    <Marker coordinate={mapRouteCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                                        <View style={st.sosMarkerInnerA}>
                                            <Image source={{ uri: selectedResponder.avatarUri }} style={st.sosMarkerAvatar} />
                                        </View>
                                    </Marker>
                                    {/* Victim Marker B */}
                                    <Marker coordinate={mapRouteCoords[mapRouteCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                                        <View style={st.sosMarkerInnerB}>
                                            <Image source={{ uri: incident.latestMessage?.sender?.id ? `https://i.pravatar.cc/150?u=${incident.latestMessage.sender.id}` : 'https://i.pravatar.cc/150?img=5' }} style={st.sosMarkerAvatar} />
                                        </View>
                                    </Marker>
                                </>
                            )}
                        </MapView>

                        {/* Top Header */}
                        <View style={[st.overlayHeader, { top: insets.top + 8 }]}>
                            <TouchableOpacity
                                style={st.headerBtn}
                                onPress={() => { setIsMapOverlayOpen(false); setIsLiveNavMode(false); }}
                            >
                                <Feather name="x" size={22} color={T.ink} />
                            </TouchableOpacity>
                            <View style={st.overlayTitleWrap}>
                                <Text style={st.overlayTitle}>
                                    {isLiveNavMode ? 'Navigating to Victim' : 'Route Overview'}
                                </Text>
                            </View>
                            <View style={{ width: 36 }} />
                        </View>

                        {/* Bottom Card */}
                        <View style={[st.overlayBottomCard, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
                            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={st.overlayCardTint} pointerEvents="none" />

                            <View style={st.responderRow}>
                                {RESPONDERS.map(responder => {
                                    const isSelected = responder.id === selectedResponderId;
                                    return (
                                        <TouchableOpacity
                                            key={responder.id}
                                            style={st.responderAvatarWrap}
                                            onPress={() => handleSelectResponder(responder.id)}
                                            activeOpacity={0.75}
                                        >
                                            <View style={[st.responderAvatarRing, isSelected && st.responderAvatarRingActive]}>
                                                <Image source={{ uri: responder.avatarUri }} style={st.responderAvatar} />
                                            </View>
                                            <Text style={[st.responderAvatarName, isSelected && st.responderAvatarNameActive]} numberOfLines={1}>
                                                {responder.name.split(' ')[0]}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {isLiveNavMode ? (
                                <View style={st.navInstRow}>
                                    <View style={st.navInstIconWrap}>
                                        <Feather name="arrow-up-right" size={32} color={T.violet} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={st.navInstPrimary}>Turn right on Pragati Sarani</Text>
                                        <Text style={st.navInstSecondary}>In 200 meters · {mapDuration}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={st.exitNavBtn}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setIsLiveNavMode(false);
                                            mapRef.current?.animateCamera({ pitch: 0, heading: 0, zoom: 14 });
                                            mapRef.current?.fitToCoordinates(mapRouteCoords, {
                                                edgePadding: { top: 140, right: 60, bottom: 280, left: 60 },
                                                animated: true,
                                            });
                                        }}
                                    >
                                        <Text style={st.exitNavBtnText}>Exit</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={st.overviewRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={st.overviewDist}>{mapDistance}</Text>
                                        <Text style={st.overviewEta}>{mapDuration} drive</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={st.startNavBtn}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setIsLiveNavMode(true);
                                            if (mapRouteCoords.length > 0) {
                                                mapRef.current?.animateCamera({
                                                    center: mapRouteCoords[0],
                                                    pitch: 60,
                                                    heading: 145,
                                                    zoom: 18,
                                                }, { duration: 1000 });
                                            }
                                        }}
                                    >
                                        <Ionicons name="navigate" size={16} color={T.onPrimary} />
                                        <Text style={st.startNavBtnText}>Live Mode</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </View>
        </AtmosphericShell>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
    root: { flex: 1 },

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
    /* Centered modals */
    centerBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    centerCard: {
        width: '100%',
        maxWidth: 720,
        backgroundColor: '#1E153A',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)'
    },
    centerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 8 },
    caseInput: { minHeight: 120, maxHeight: 260, color: '#FFFFFF', padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8 },
    caseBtnsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
    caseBtnCancel: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
    caseBtnCancelText: { color: '#FFFFFF', opacity: 0.6 },
    caseBtnSave: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.violet, alignItems: 'center', justifyContent: 'center' },
    caseBtnSaveText: { color: T.onPrimary, fontWeight: '700' },
    saveBackdropCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    saveCardColored: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#1E153A',
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 18,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 6 },
        }),
    },
    saveTitleColored: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
    saveMessageColored: { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 4 },
    leaveCard: { width: '100%', maxWidth: 720, backgroundColor: '#1E153A', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    leaveTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 8 },
    leaveSub: { color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
    leaveBtnsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    leaveCancel: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
    leaveCancelText: { color: '#FFFFFF', opacity: 0.7 },
    leaveYes: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center' },
    leaveYesText: { color: '#FFFFFF', fontWeight: '800' },
    attachModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    attachModalCard: {
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
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
            android: { elevation: 5 },
        }),
        zIndex: 10,
    },

    // ── Archive Pill (RESOLVED read-only) — centered glass capsule
    archiveOuter: {
        paddingHorizontal: S.s4,
        paddingTop: S.s2,
        alignItems: 'center',
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
    cancelledCard: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        marginHorizontal: S.s4,
        padding: S.s4,
        borderRadius: R.lg,
        backgroundColor: 'rgba(79, 70, 229, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.28)',
    },
    cancelledContent: {
        flex: 1,
    },
    cancelledTitle: {
        color: T.violet,
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 4,
    },
    cancelledSubtitle: {
        color: T.ink4,
        fontSize: 13,
        lineHeight: 18,
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
    overlayHeader: {
        position: 'absolute',
        left: S.s3,
        right: S.s3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    overlayTitleWrap: {
        backgroundColor: 'rgba(30, 21, 58, 0.85)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    overlayTitle: {
        color: T.ink,
        fontSize: 13,
        fontWeight: '700',
    },
    overlayBottomCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(10, 5, 20, 0.5)',
        paddingTop: 20,
        paddingHorizontal: S.s4,
        minHeight: 200,
        zIndex: 10,
    },
    overlayCardTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: `${T.violet}08`,
    },
    responderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 14,
        marginBottom: 16,
    },
    responderAvatarWrap: {
        flex: 1,
        alignItems: 'center',
    },
    responderAvatarRing: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    responderAvatarRingActive: {
        borderColor: T.violet,
        backgroundColor: 'rgba(138,56,246,0.18)',
    },
    responderAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    responderAvatarName: {
        marginTop: 8,
        color: T.ink3,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    responderAvatarNameActive: {
        color: T.violet,
    },
    overviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    overviewDist: {
        color: T.violet,
        fontSize: 24,
        fontWeight: '900',
    },
    overviewEta: {
        color: T.ink3,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 2,
    },
    startNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.violet,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 999,
        gap: 8,
    },
    startNavBtnText: {
        color: T.onPrimary,
        fontSize: 15,
        fontWeight: '700',
    },
    navInstRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    navInstIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(138,56,246,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(138,56,246,0.3)',
    },
    navInstPrimary: {
        color: T.ink,
        fontSize: 16,
        fontWeight: '800',
    },
    navInstSecondary: {
        color: T.ink3,
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
    },
    exitNavBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    exitNavBtnText: {
        color: T.ink2,
        fontSize: 13,
        fontWeight: '700',
    },
    sosMarkerInnerA: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2.5,
        borderColor: T.violet,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    sosMarkerInnerB: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2.5,
        borderColor: T.danger,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    sosMarkerAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
});
