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
    Modal, Pressable
} from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withRepeat, withSequence, withTiming,
    Easing as REasing,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import type { Incident, Message, Role } from '../../../../src/types/chat';

// ─── Constants ──────────────────────────────────────────────────────────────
const SELF_ID = 'self';
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

// ─── LivePulse — header heartbeat ───────────────────────────────────────────
const LivePulse = memo(function LivePulse() {
    const scale = useSharedValue(1);
    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.5, { duration: 250, easing: REasing.out(REasing.quad) }),
                withTiming(1.0, { duration: 200, easing: REasing.in(REasing.quad) }),
                withTiming(1.35, { duration: 220, easing: REasing.out(REasing.quad) }),
                withTiming(1.0, { duration: 700, easing: REasing.inOut(REasing.ease) }),
            ),
            -1,
        );
    }, []);
    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));
    return <Animated.View style={[st.livePulseDot, animStyle]} />;
});

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
    const isVictim = role === 'USER' && !isOwn;

    // Directional radii per exact design specs
    const tailStyle = isOwn
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
        <View style={[st.bubbleRow, isOwn ? st.bubbleRowOwn : st.bubbleRowOther]}>
            {/* Avatar for others */}
            {!isOwn && (
                <Image
                    source={{ uri: `https://i.pravatar.cc/150?u=${msg.sender.id}` }}
                    style={st.avatar}
                />
            )}

            <View style={st.bubbleCol}>
                {/* Sender + badge */}
                {!isOwn && (
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
                    isOwn ? st.bubbleOwn : st.bubbleOther,
                    isVictim && st.bubbleVictim,
                    tailStyle,
                ]}>
                    {/* Separate absolute view for glass effect to preserve pure white text */}
                    {!isOwn && <View style={[StyleSheet.absoluteFill, st.bubbleOtherBg, tailStyle]} />}
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
                            isOwn && st.msgTextOwn
                        ]}>
                            {msg.content}
                        </Text>
                    )}
                </View>

                {/* Timestamp */}
                <Text style={[st.msgTime, isOwn && st.msgTimeOwn]}>
                    {formatTime(msg.timestamp)}
                </Text>
            </View>
        </View>
    );
});



// ─── Floating Glass Pill Input ──────────────────────────────────────────────
function FloatingInput({ onSend, bottomInset }: { onSend: (text: string) => void; bottomInset: number }) {
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
                        onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(false); }}
                    >
                        <Feather name="mic" size={20} color="#FFFFFF" />
                        <Text style={st.attachOptionText}>Audio Note</Text>
                    </TouchableOpacity>

                    <View style={st.attachOptionDivider} />

                    <TouchableOpacity
                        style={st.attachOptionRow}
                        activeOpacity={0.7}
                        onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(false); }}
                    >
                        <Feather name="video" size={20} color="#FFFFFF" />
                        <Text style={st.attachOptionText}>Video Evidence</Text>
                    </TouchableOpacity>

                    <View style={st.attachOptionDivider} />

                    <TouchableOpacity
                        style={[st.attachOptionRow, { paddingBottom: 12 }]}
                        activeOpacity={0.7}
                        onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(false); }}
                    >
                        <Feather name="image" size={20} color="#FFFFFF" />
                        <Text style={st.attachOptionText}>Photo</Text>
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
                                    <Feather name="chevron-left" size={24} color="#FFFFFF" />
                                </TouchableOpacity>

                                <Image
                                    source={{ uri: 'https://i.pravatar.cc/150?u=case' }}
                                    style={st.headerAvatar}
                                />

                                <View style={st.headerTitleBlock}>
                                    <Text style={st.headerTitle} numberOfLines={1}>
                                        {caseLabel(incident.id, incident.createdAt)}
                                    </Text>
                                    <View style={st.headerMeta}>
                                        {isLive && <LivePulse />}
                                        <Text style={[st.headerStatus, isLive && { color: T.dangerText }]}>
                                            {isLive ? 'LIVE' : 'ARCHIVED'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* ── RIGHT ZONE (System Actions) ── */}
                            <View style={st.headerRight}>
                                <TouchableOpacity
                                    style={st.liveMapCircularBtn}
                                    activeOpacity={0.7}
                                    onPress={() => { Haptics.selectionAsync(); router.back(); }}
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
                        <FloatingInput onSend={handleSend} bottomInset={insets.bottom} />
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
                                onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); }}
                            >
                                <Feather name="users" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>View Responders</Text>
                            </TouchableOpacity>

                            <View style={st.headerMenuDivider} />

                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); }}
                            >
                                <Feather name="edit-2" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>Edit Case Details</Text>
                            </TouchableOpacity>

                            <View style={st.headerMenuDivider} />

                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); }}
                            >
                                <Feather name="x-circle" size={16} color="#FF453A" />
                                <Text style={[st.headerMenuText, st.headerMenuTextDanger]}>Leave Dispatch</Text>
                            </TouchableOpacity>
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
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginLeft: 12,
    },
    headerTitleBlock: {
        justifyContent: 'center',
        marginLeft: 12,
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
    livePulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: T.danger,
    },
    headerStatus: {
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
        backgroundColor: T.violet,
        borderWidth: 0,
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
        color: '#FFFFFF',
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
});
