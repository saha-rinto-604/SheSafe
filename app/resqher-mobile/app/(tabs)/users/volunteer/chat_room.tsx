/**
 * volunteer/chat_room.tsx — Tactical Group Chat (Volunteer)
 * Mirrors standard-user chat room UI for consistency.
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
    Platform, StatusBar, KeyboardAvoidingView, Keyboard, Image,
    Modal, Pressable, Alert
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { type IncidentCategory } from '../../../../src/types/chat';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

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

// ─── Mock Incidents ─────────────────────────────────────────────────────────
// ASSISTING = volunteer responded to someone else's SOS
// MY_EMERGENCY = volunteer triggered their own SOS
const MOCK_INCIDENTS: Record<string, Incident & { category: IncidentCategory }> = {
    // ── Assisting ──
    'inc-312': {
        id: 'inc-312', type: 'SOS Alert', status: 'LIVE', category: 'ASSISTED',
        location: { latitude: 23.8103, longitude: 90.4125, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'I can see her. Moving to intercept from north side.',
            sender: { id: SELF_ID, name: 'You', role: 'VOLUNTEER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 3, createdAt: new Date(Date.now() - 240000).toISOString(),
    },
    'inc-204': {
        id: 'inc-204', type: 'SOS Alert', status: 'RESOLVED', category: 'ASSISTED',
        location: { latitude: 23.7956, longitude: 90.3657, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'Thank you for coming quickly. I am safe now.', sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 3, createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    'inc-198': {
        id: 'inc-198', type: 'Medical Emergency', status: 'CANCELLED', category: 'ASSISTED',
        location: { latitude: 23.7461, longitude: 90.3742, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'Incident cancelled by victim before responder arrival.', sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 2, createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    'inc-175': {
        id: 'inc-175', type: 'Harassment Report', status: 'RESOLVED', category: 'ASSISTED',
        location: { latitude: 23.7806, longitude: 90.4194, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'Case resolved. Follow-up notes shared.', sender: { id: 'v2', name: 'Raihan Ahmed', role: 'VOLUNTEER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 3, createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    // ── My Emergencies ──
    'inc-301': {
        id: 'inc-301', type: 'SOS Alert', status: 'LIVE', category: 'MY_EMERGENCY',
        location: { latitude: 23.8293, longitude: 90.4182, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: "I'm 3 minutes away. Stay in a lit area.", sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 2, createdAt: new Date(Date.now() - 180000).toISOString(),
    },
    'inc-289': {
        id: 'inc-289', type: 'Harassment Report', status: 'RESOLVED', category: 'MY_EMERGENCY',
        location: { latitude: 23.7806, longitude: 90.4120, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: "Glad you're safe. Incident has been logged.", sender: { id: 'v3', name: 'Raihan Ahmed', role: 'VOLUNTEER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 2, createdAt: new Date(Date.now() - 90000000).toISOString(),
    },
    'inc-270': {
        id: 'inc-270', type: 'Medical Emergency', status: 'CANCELLED', category: 'MY_EMERGENCY',
        location: { latitude: 23.7461, longitude: 90.3800, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'You cancelled this request. No further action taken.', sender: { id: 'system', name: 'System', role: 'USER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 1, createdAt: new Date(Date.now() - 180000000).toISOString(),
    },
};

// ─── Mock initial messages per incident ─────────────────────────────────────
const INITIAL_MESSAGES: Record<string, Message[]> = {
    'inc-204': [
        {
            id: 'm-sys-1', incidentId: 'inc-204',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Emergency incident created. Responders notified.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 300000).toISOString(),
        },
        {
            id: 'm1', incidentId: 'inc-204',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            content: 'I need help, someone is following me near Ibrahimpur Bazar, Mirpur',
            type: 'TEXT', timestamp: new Date(Date.now() - 240000).toISOString(),
        },
        {
            id: 'm2', incidentId: 'inc-204',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'Stay calm, I\'m nearby. Can you share your exact location?',
            type: 'TEXT', timestamp: new Date(Date.now() - 180000).toISOString(),
        },
        {
            id: 'm3', incidentId: 'inc-204',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            content: 'I\'m at the bus stop near Ibrahimpur Bazar, Mirpur',
            type: 'TEXT', timestamp: new Date(Date.now() - 120000).toISOString(),
        },
        {
            id: 'm-sys-2', incidentId: 'inc-204',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: '📎 New evidence uploaded · [View]',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 90000).toISOString(),
            evidenceId: 'ev-001',
        },
        {
            id: 'm5', incidentId: 'inc-204',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'I can see you. Wearing a blue vest, approaching from the north side.',
            type: 'TEXT', timestamp: new Date(Date.now() - 30000).toISOString(),
        },
    ],
    'inc-198': [
        {
            id: 'm-sys-3', incidentId: 'inc-198',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Incident was cancelled by victim before responder arrival.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 600000).toISOString(),
        },
        {
            id: 'm6', incidentId: 'inc-198',
            sender: { id: 'u2', name: 'Nadia Akter', role: 'USER' },
            content: 'No need now, we reached home safely. Cancelling this incident.',
            type: 'TEXT', timestamp: new Date(Date.now() - 500000).toISOString(),
        },
        {
            id: 'm7', incidentId: 'inc-198',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: 'Understood. Marked as cancelled.',
            type: 'TEXT', timestamp: new Date(Date.now() - 30000).toISOString(),
        },
    ],
    'inc-175': [
        {
            id: 'm-sys-4', incidentId: 'inc-175',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Incident resolved by responders.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 1900000).toISOString(),
        },
        {
            id: 'm8', incidentId: 'inc-175',
            sender: { id: 'v2', name: 'Raihan Ahmed', role: 'VOLUNTEER' },
            content: 'Case resolved. Follow-up notes shared.',
            type: 'TEXT', timestamp: new Date(Date.now() - 1800000).toISOString(),
        },
    ],
    // ── My Emergency incidents ──
    'inc-301': [
        {
            id: 'm-sys-301', incidentId: 'inc-301',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Your SOS has been sent. Responders have been notified.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 180000).toISOString(),
        },
        {
            id: 'm301-a', incidentId: 'inc-301',
            sender: { id: SELF_ID, name: 'You', role: 'VOLUNTEER' },
            content: 'I need help — someone is following me near Khilkhet Station.',
            type: 'TEXT', timestamp: new Date(Date.now() - 150000).toISOString(),
        },
        {
            id: 'm301-b', incidentId: 'inc-301',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            content: "I'm 3 minutes away. Stay in a lit area and keep moving.",
            type: 'TEXT', timestamp: new Date(Date.now() - 30000).toISOString(),
        },
    ],
    'inc-289': [
        {
            id: 'm-sys-289', incidentId: 'inc-289',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Incident resolved by responders.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 90000000).toISOString(),
        },
        {
            id: 'm289-a', incidentId: 'inc-289',
            sender: { id: 'v3', name: 'Raihan Ahmed', role: 'VOLUNTEER' },
            content: "Glad you're safe. Incident has been logged.",
            type: 'TEXT', timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
    ],
    'inc-270': [
        {
            id: 'm-sys-270', incidentId: 'inc-270',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'You cancelled this SOS request. No further action taken.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 172800000).toISOString(),
        },
    ],
    // ── Active Assisting (inc-312) ──
    'inc-312': [
        {
            id: 'm-sys-312', incidentId: 'inc-312',
            sender: { id: 'system', name: 'System', role: 'USER' },
            content: 'Emergency incident created. Responders notified.',
            type: 'SYSTEM', timestamp: new Date(Date.now() - 240000).toISOString(),
        },
        {
            id: 'm312-a', incidentId: 'inc-312',
            sender: { id: 'u5', name: 'Sumaiya Hossain', role: 'USER' },
            content: 'Please help me, I am being followed near Gulshan 2 Circle.',
            type: 'TEXT', timestamp: new Date(Date.now() - 200000).toISOString(),
        },
        {
            id: 'm312-b', incidentId: 'inc-312',
            sender: { id: SELF_ID, name: 'You', role: 'VOLUNTEER' },
            content: 'I am on my way. Stay near the shops and keep this call open.',
            type: 'TEXT', timestamp: new Date(Date.now() - 60000).toISOString(),
        },
        {
            id: 'm312-c', incidentId: 'inc-312',
            sender: { id: SELF_ID, name: 'You', role: 'VOLUNTEER' },
            content: 'I can see her. Moving to intercept from north side.',
            type: 'TEXT', timestamp: new Date(Date.now() - 20000).toISOString(),
        },
    ],
};

// ─── Mock auto-reply pool ───────────────────────────────────────────────────
const VOLUNTEER_REPLIES = [
    'Copy that, I\'m 3 minutes away. Stay in a public area.',
    'Understood. Coordinating with nearby responders.',
    'Location received. Heading your way now.',
    'Keep your phone visible. I\'ll find you.',
    'Responders have been updated with this info.',
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
            {!alignRight && (
                <Image
                    source={{ uri: `https://i.pravatar.cc/150?u=${msg.sender.id}` }}
                    style={st.avatar}
                />
            )}

            <View style={st.bubbleCol}>
                {!alignRight && (
                    <View style={st.senderRow}>
                        <Text style={st.senderName}>
                            {msg.sender.name}
                        </Text>
                        <RoleBadge role={role} />
                    </View>
                )}

                <View style={[
                    st.bubble,
                    alignRight ? st.bubbleOwn : st.bubbleOther,
                    tailStyle,
                ]}>
                    {!alignRight && <View style={[StyleSheet.absoluteFill, st.bubbleOtherBg, tailStyle]} />}
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

                <Text style={[st.msgTime, alignRight && st.msgTimeOwn]}>
                    {formatTime(msg.timestamp)}
                </Text>
            </View>
        </View>
    );
});

// ─── Floating Glass Pill Input ──────────────────────────────────────────────
    function FloatingInput({ onSend, bottomInset, onImagePicked }: { onSend: (text: string) => void; bottomInset: number; onImagePicked: (uri: string) => void }) {
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
            {isAttachMenuVisible && (
                <Modal transparent visible animationType="fade">
                    <Pressable style={st.attachModalBackdrop} onPress={() => setAttachMenuVisible(false)}>
                        <View style={st.attachMenuOuterModal}>
                            <TouchableOpacity
                                style={[st.attachOptionRow, { paddingBottom: 12 }]}
                                activeOpacity={0.7}
                                onPress={async () => {
                                    Haptics.selectionAsync();
                                    try {
                                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                        if (status !== 'granted') {
                                            Alert.alert('Permission required', 'Permission to access media library is required.');
                                            return;
                                        }

                                        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
                                        if (!res.canceled && res.assets && res.assets.length > 0) {
                                            const uri = res.assets[0].uri;
                                            onImagePicked(uri);
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setAttachMenuVisible(false);
                                    }
                                }}
                            >
                                <Feather name="image" size={20} color="#FFFFFF" />
                                <Text style={st.attachOptionText}>Photo</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>
            )}

            <View style={st.inputPillContainer}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
                    <View style={[StyleSheet.absoluteFill, st.inputPillBg]} />
                </BlurView>

                <View style={st.inputPill}>
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

const decodePolyline = (t: string, e?: number) => {
    let n = 0, o = 0, r = 0, l = 0, i = 0, a = null;
    const d: { latitude: number; longitude: number }[] = [];
    for (e = e || 5; n < t.length;) {
        a = null, r = 0, l = 0;
        do a = t.charCodeAt(n++) - 63, l |= (31 & a) << r, r += 5; while (a >= 32);
        i = 1 & l ? ~(l >> 1) : l >> 1, r = l = 0, o += i;
        do a = t.charCodeAt(n++) - 63, l |= (31 & a) << r, r += 5; while (a >= 32);
        i = 1 & l ? ~(l >> 1) : l >> 1, d.push({ latitude: o / 10 ** e, longitude: (r += i) / 10 ** e });
    }
    return d.map(p => ({ latitude: p.latitude, longitude: p.longitude - r / 10 ** e + p.longitude })); // quick fix
};

// Real polyline decode from google
function polylineDecode(str: string, precision = 5) {
    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
    while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push({ latitude: lat / factor, longitude: lng / factor });
    }
    return coordinates;
}

// ─── Main — Chat Room ───────────────────────────────────────────────────────
export default function ChatRoom() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { incidentId, category } = useLocalSearchParams<{ incidentId: string; category?: string }>();

    const incident = MOCK_INCIDENTS[incidentId || 'inc-204'] ?? MOCK_INCIDENTS['inc-204'];
    const resolvedCategory: IncidentCategory =
        (category === 'MY_EMERGENCY' ? 'MY_EMERGENCY' : incident.category ?? 'ASSISTED') as IncidentCategory;
    const isMyEmergency = resolvedCategory === 'MY_EMERGENCY';

    const [messages, setMessages] = useState<Message[]>(
        INITIAL_MESSAGES[incidentId || 'inc-204'] ?? INITIAL_MESSAGES['inc-204']
    );
    const flatRef = useRef<FlatList>(null);
    const isLive = incident.status === 'LIVE';
    const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);

    // Map Overlay State
    const [isMapOverlayOpen, setIsMapOverlayOpen] = useState(false);
    const [mapRouteCoords, setMapRouteCoords] = useState<{latitude: number; longitude: number}[]>([]);
    const [mapDistance, setMapDistance] = useState('');
    const [mapDuration, setMapDuration] = useState('');
    const [isLiveNavMode, setIsLiveNavMode] = useState(false);
    const [selectedResponderId, setSelectedResponderId] = useState(RESPONDERS[0].id);
    const mapRef = useRef<MapView>(null);

    // Responders list modal state (local mock list of 5)
    const [isRespondersOpen, setRespondersOpen] = useState(false);
    const [isResponderRemovedOpen, setResponderRemovedOpen] = useState(false);
    const [respondersList, setRespondersList] = useState(() => [
        ...RESPONDERS,
        {
            id: 'v3', name: 'Raihan Ahmed', avatarUri: 'https://i.pravatar.cc/150?img=12', isAdmin: true, role: 'POLICE'
        },
        {
            id: 'v4', name: 'Nadia Akter', avatarUri: 'https://i.pravatar.cc/150?img=13', role: 'VOLUNTEER'
        }
    ]);

    const handleRemoveResponder = useCallback((id: string) => {
        setRespondersList(prev => prev.filter(r => r.id !== id));
        if (id === selectedResponderId) {
            setSelectedResponderId(respondersList[0]?.id ?? '');
        }
        setResponderRemovedOpen(true);
        setTimeout(() => setResponderRemovedOpen(false), 2000);
    }, [selectedResponderId, respondersList]);

    // Edit Case Details modal state
    const [isEditCaseOpen, setEditCaseOpen] = useState(false);
    const [caseDetails, setCaseDetails] = useState(() => incident.latestMessage?.content ?? '');

    const [isSaveConfirmationOpen, setSaveConfirmationOpen] = useState(false);

    const handleSaveCaseDetails = useCallback(() => {
        // Close editor and show styled confirmation
        setEditCaseOpen(false);
        setSaveConfirmationOpen(true);
        // auto-dismiss after 2.2s
        setTimeout(() => setSaveConfirmationOpen(false), 2200);
    }, [caseDetails]);

    // Leave Dispatch confirmation
    const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const handleConfirmLeave = useCallback(() => {
        Haptics.selectionAsync();
        setHeaderMenuOpen(false);
        setLeaveConfirmOpen(false);
        // navigate back to previous screen
        router.back();
    }, [router]);

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
        } catch (e) {
            console.error(e);
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

        const origin = `${selectedResponder.location.latitude},${selectedResponder.location.longitude}`;
        const destination = `${incident.location.latitude},${incident.location.longitude}`;

        if (!GOOGLE_MAPS_API_KEY) {
            setMapRouteCoords([selectedResponder.location, incident.location]);
            setMapDistance(selectedResponder.fallbackDistance);
            setMapDuration(selectedResponder.fallbackDuration);
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
                setMapDistance(leg?.distance?.text ?? 'Unknown');
                setMapDuration(leg?.duration?.text ?? 'Unknown');
                setTimeout(() => {
                    mapRef.current?.fitToCoordinates(coords, {
                        edgePadding: { top: 140, right: 60, bottom: 280, left: 60 },
                        animated: true,
                    });
                }, 400);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load route');
        }
    }, [incident.location, mapRouteCoords.length]);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
        }
    }, [messages.length]);

    const handleSend = useCallback((text: string) => {
        const userMsg: Message = {
            id: `m-self-${Date.now()}`,
            incidentId: incident.id,
            sender: { id: SELF_ID, name: 'You', role: 'VOLUNTEER' },
            content: text,
            type: 'TEXT',
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMsg]);

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
            <View style={[st.root, { paddingTop: insets.top }]}
            >
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={st.headerOuter}>
                    <BlurView intensity={50} tint="dark" style={st.headerBlur}>
                        <View style={st.headerInner}>
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
                                                {isLive ? 'ACTIVE' : 'ARCHIVED'}
                                            </Text>
                                        </View>
                                        {/* Category context pill */}
                                        <View style={[
                                            st.headerStatusPill,
                                            isMyEmergency ? st.headerCategoryPillEmergency : st.headerCategoryPillAssisting,
                                        ]}>
                                            <Text style={isMyEmergency ? st.headerCategoryTextEmergency : st.headerCategoryTextAssisting}>
                                                {isMyEmergency ? 'MY EMERGENCY' : 'ASSISTED'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

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

                <View style={{ marginTop: 12 }} />

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

                    {isLive ? (
                        <FloatingInput onSend={handleSend} bottomInset={insets.bottom} onImagePicked={(uri) => {
                            const imgMsg: Message = {
                                id: `m-img-${Date.now()}`,
                                incidentId: incident.id,
                                sender: { id: SELF_ID, name: 'You', role: 'VOLUNTEER' },
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

                {/* Edit Case Details Modal */}
                <Modal transparent={true} visible={isEditCaseOpen} animationType="slide">
                    <Pressable style={st.caseModalBackdrop} onPress={() => setEditCaseOpen(false)}>
                        <View style={st.caseModalSheet}>
                            <Text style={st.caseModalTitle}>Edit Case Details</Text>
                            <Text style={st.caseModalHint}>Add or update the case description below.</Text>
                            <TextInput
                                style={st.caseModalInput}
                                multiline
                                value={caseDetails}
                                onChangeText={setCaseDetails}
                                placeholder="Enter case details…"
                                placeholderTextColor="rgba(255,255,255,0.35)"
                            />

                            <View style={st.caseModalFooter}>
                                <TouchableOpacity style={st.caseModalCancel} onPress={() => setEditCaseOpen(false)}>
                                    <Text style={st.caseModalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={st.caseModalSave} onPress={handleSaveCaseDetails}>
                                    <Text style={st.caseModalSaveText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Modal>

                {/* Save Confirmation Modal (styled) */}
                <Modal transparent={true} visible={isSaveConfirmationOpen} animationType="fade">
                    <View style={st.saveBackdropCentered}>
                        <View style={st.saveCardColored}>
                            <Text style={st.saveTitleColored}>Saved</Text>
                            <Text style={st.saveMessageColored}>Case details saved.</Text>
                        </View>
                    </View>
                </Modal>

                {/* Leave Dispatch Confirmation Modal */}
                <Modal transparent={true} visible={isLeaveConfirmOpen} animationType="fade">
                    <View style={st.leaveBackdropCentered}>
                        <View style={st.leaveCard}>
                            <Text style={st.leaveTitle}>Are you sure?</Text>
                            <Text style={st.leaveMessage}>Do you want to leave this dispatch? You will no longer receive updates for this case.</Text>

                            <View style={st.leaveActions}>
                                <TouchableOpacity style={st.leaveCancel} onPress={() => setLeaveConfirmOpen(false)}>
                                    <Text style={st.leaveCancelText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={st.leaveYes} onPress={handleConfirmLeave}>
                                    <Text style={st.leaveYesText}>Yes</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <RespondersList
                    visible={isRespondersOpen}
                    onClose={() => setRespondersOpen(false)}
                    data={respondersList}
                    onRemove={handleRemoveResponder}
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
                                    {/* Volunteer Marker A */}
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

                            {isMyEmergency && (
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
                            )}

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
                                                    heading: 145, // mock heading angle
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
    // Category context pills
    headerCategoryPillAssisting: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}40`,
    },
    headerCategoryPillEmergency: {
        backgroundColor: T.dangerLight,
        borderColor: T.dangerBorder,
    },
    headerCategoryTextAssisting: {
        fontSize: 10,
        fontWeight: '700',
        color: T.violet,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    headerCategoryTextEmergency: {
        fontSize: 10,
        fontWeight: '700',
        color: T.danger,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },

    chatArea: { flex: 1 },
    messageList: {
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s2,
    },

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

    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignSelf: 'flex-start',
        flexShrink: 0,
    },

    bubbleCol: {
        maxWidth: '75%',
    },

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
    attachModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    attachMenuOuterModal: {
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
    responderSimpleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    responderSimpleLabel: { color: T.ink4, marginRight: 6, fontWeight: '700' },
    responderSimpleList: { flexDirection: 'row', gap: 8 },
    responderSimpleName: { color: T.onPrimary, backgroundColor: T.violetDim, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, fontSize: 12, marginRight: 6 },
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
    caseModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    caseModalSheet: {
        backgroundColor: '#1E153A',
        borderRadius: 12,
        padding: 16,
        maxHeight: '80%'
    },
    caseModalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6 },
    caseModalHint: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12 },
    caseModalInput: {
        minHeight: 100,
        maxHeight: 300,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 12,
        color: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.02)',
        marginBottom: 12,
        textAlignVertical: 'top'
    },
    caseModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    caseModalCancel: { paddingHorizontal: 14, paddingVertical: 10 },
    caseModalCancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
    caseModalSave: { backgroundColor: T.violet, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    caseModalSaveText: { color: T.onPrimary, fontWeight: '800' },
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
    leaveBackdropCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    leaveCard: { width: '100%', maxWidth: 420, backgroundColor: '#1E153A', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    leaveTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 8 },
    leaveMessage: { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 16 },
    leaveActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    leaveCancel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: 'transparent' },
    leaveCancelText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
    leaveYes: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: T.danger },
    leaveYesText: { color: T.onPrimary, fontWeight: '900' },
});
