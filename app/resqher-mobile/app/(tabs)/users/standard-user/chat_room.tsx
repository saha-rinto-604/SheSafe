/**
 * ChatRoom — Tactical Group Chat
 * Role-based message bubbles, mini-map header, multi-type input.
 * Uses useChatSocket for realtime messaging with polling fallback.
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
    Platform, StatusBar, KeyboardAvoidingView, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Haptics from 'expo-haptics';

import { T, R, S, Ty } from '../../../../src/constants/theme';
import { useChatSocket } from '../../../../src/hooks/useChatSocket';
import { chatService } from '../../../../src/services/chatService';
import type { Incident, Message, Role } from '../../../../src/types/chat';

// ─── Constants ──────────────────────────────────────────────────────────────
const SELF_ID = 'self'; // Current user — matches mock sender id
const MAP_STRIP_HEIGHT = 120;

// ─── Role badge config ──────────────────────────────────────────────────────
const ROLE_META: Record<Role, { label: string; color: string; bg: string; border: string }> = {
    USER: {
        label: 'VICTIM',
        color: T.dangerText,
        bg: T.dangerBg,
        border: T.dangerBorder,
    },
    VOLUNTEER: {
        label: 'VOLUNTEER',
        color: '#C4B5FD', // Light violet
        bg: T.violetDim,
        border: 'rgba(138,56,246,0.25)',
    },
    POLICE: {
        label: 'POLICE',
        color: '#6EE7B7', // Light emerald
        bg: T.safeLight,
        border: 'rgba(16,185,129,0.25)',
    },
};

// ─── Tactical Map Style (same as sos_screen) ────────────────────────────────
const TACTICAL_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#0A0A0C' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#636366' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#08070B' }, { weight: 2 }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2C2C2E' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#222224' }] },
    { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#1A1A1C' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060608' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0D0D10' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
];

// ─── Time formatters ────────────────────────────────────────────────────────
function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
}

// ─── Role Badge ─────────────────────────────────────────────────────────────
const RoleBadge = memo(function RoleBadge({ role }: { role: Role }) {
    const meta = ROLE_META[role];
    return (
        <View style={[st.roleBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
            <Text style={[st.roleBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
    );
});

// ─── System Message ─────────────────────────────────────────────────────────
const SystemBubble = memo(function SystemBubble({ msg }: { msg: Message }) {
    const isEvidence = !!msg.evidenceId;
    return (
        <View style={st.systemWrap}>
            <View style={st.systemLine} />
            <View style={st.systemContent}>
                {isEvidence && <Feather name="paperclip" size={12} color={T.violet} style={{ marginRight: 4 }} />}
                <Text style={[st.systemText, isEvidence && st.systemTextEvidence]}>
                    {msg.content}
                </Text>
            </View>
            <View style={st.systemLine} />
        </View>
    );
});

// ─── Chat Bubble ────────────────────────────────────────────────────────────
const ChatBubble = memo(function ChatBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
    if (msg.type === 'SYSTEM') return <SystemBubble msg={msg} />;

    const role = msg.sender.role;
    const isVictim = role === 'USER' && !isOwn;
    const meta = ROLE_META[role];

    return (
        <View style={[st.bubbleRow, isOwn ? st.bubbleRowOwn : st.bubbleRowOther]}>
            <View style={[
                st.bubble,
                isOwn ? st.bubbleOwn : st.bubbleOther,
                isVictim && st.bubbleVictim,
            ]}>
                {/* Sender info (other only) */}
                {!isOwn && (
                    <View style={st.senderRow}>
                        <Text style={[st.senderName, isVictim && { color: T.dangerText }]}>
                            {msg.sender.name}
                        </Text>
                        <RoleBadge role={role} />
                    </View>
                )}

                {/* Message content */}
                {msg.type === 'IMAGE' && msg.mediaUrl ? (
                    <View style={st.imageWrap}>
                        <Feather name="image" size={28} color={T.ink4} />
                        <Text style={st.imageLabel}>Photo attached</Text>
                    </View>
                ) : msg.type === 'AUDIO' ? (
                    <View style={st.audioWrap}>
                        <Feather name="mic" size={16} color={T.violet} />
                        <View style={st.audioBar} />
                        <Text style={st.audioDur}>0:12</Text>
                    </View>
                ) : (
                    <Text style={[st.msgText, isOwn && st.msgTextOwn]}>{msg.content}</Text>
                )}

                {/* Timestamp */}
                <Text style={[st.msgTime, isOwn && st.msgTimeOwn]}>{formatTime(msg.timestamp)}</Text>
            </View>
        </View>
    );
});

// ─── Mini-Map Header ────────────────────────────────────────────────────────
const MiniMap = memo(function MiniMap({ incident }: { incident: Incident }) {
    if (incident.status !== 'LIVE') return null;
    const { latitude, longitude } = incident.location;

    return (
        <View style={st.mapStrip}>
            <MapView
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                    latitude, longitude,
                    latitudeDelta: 0.006, longitudeDelta: 0.006,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                customMapStyle={TACTICAL_MAP_STYLE}
            >
                <Marker coordinate={{ latitude, longitude }} tracksViewChanges={false}>
                    <View style={st.mapMarker}>
                        <View style={st.mapMarkerInner} />
                    </View>
                </Marker>
            </MapView>
            {/* Overlay label */}
            <View style={st.mapLabel}>
                <View style={st.mapLabelDot} />
                <Text style={st.mapLabelText}>Live Location</Text>
            </View>
        </View>
    );
});

// ─── Input Bar — Text / Image / Audio ───────────────────────────────────────
function InputBar({ onSend }: { onSend: (text: string) => void }) {
    const [text, setText] = useState('');
    const inputRef = useRef<TextInput>(null);

    const handleSend = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        Haptics.selectionAsync();
        onSend(trimmed);
        setText('');
    };

    const handleImage = () => {
        Haptics.selectionAsync();
        // TODO: Open image picker (expo-image-picker)
    };

    const handleAudio = () => {
        Haptics.selectionAsync();
        // TODO: Hold-to-record (expo-av)
    };

    return (
        <View style={st.inputBar}>
            {/* Action buttons */}
            <TouchableOpacity style={st.inputAction} onPress={handleImage}>
                <Feather name="camera" size={19} color={T.ink3} />
            </TouchableOpacity>
            <TouchableOpacity style={st.inputAction} onPress={handleAudio}>
                <Feather name="mic" size={19} color={T.ink3} />
            </TouchableOpacity>

            {/* Text input */}
            <View style={st.inputWrap}>
                <TextInput
                    ref={inputRef}
                    style={st.input}
                    placeholder="Type a message…"
                    placeholderTextColor={T.ink5}
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={2000}
                    returnKeyType="default"
                />
            </View>

            {/* Send button */}
            <TouchableOpacity
                style={[st.sendBtn, !text.trim() && st.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim()}
            >
                <Ionicons name="send" size={18} color={text.trim() ? T.onPrimary : T.ink5} />
            </TouchableOpacity>
        </View>
    );
}

// ─── MAIN — Chat Room ───────────────────────────────────────────────────────
export default function ChatRoom() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { incidentId } = useLocalSearchParams<{ incidentId: string }>();

    const [incident, setIncident] = useState<Incident | null>(null);
    const { messages, isConnected, sendMessage } = useChatSocket(incidentId || '');
    const flatRef = useRef<FlatList>(null);

    // Fetch incident details
    useEffect(() => {
        if (!incidentId) return;
        chatService.getIncident(incidentId).then(data => {
            if (data) setIncident(data);
        });
    }, [incidentId]);

    // Auto-scroll to bottom on new message
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
        }
    }, [messages.length]);

    const handleSend = useCallback((text: string) => {
        sendMessage(text, 'TEXT');
    }, [sendMessage]);

    const isLive = incident?.status === 'LIVE';

    const renderMessage = useCallback(({ item }: { item: Message }) => (
        <ChatBubble msg={item} isOwn={item.sender.id === SELF_ID} />
    ), []);

    return (
        <View style={[st.root, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* ── Header ────────────────────────────────────────────── */}
            <View style={st.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={st.backBtn}
                >
                    <Feather name="chevron-left" size={22} color={T.ink} />
                </TouchableOpacity>

                <View style={st.headerCenter}>
                    <Text style={st.headerTitle} numberOfLines={1}>
                        {incident?.type || 'Chat'}
                    </Text>
                    <View style={st.headerMeta}>
                        {isLive && <View style={st.headerLiveDot} />}
                        <Text style={[st.headerStatus, isLive && { color: T.dangerText }]}>
                            {incident?.status || '…'}
                        </Text>
                        {/* Connection indicator */}
                        <View style={[st.connDot, { backgroundColor: isConnected ? T.success : T.ink4 }]} />
                    </View>
                </View>

                <TouchableOpacity style={st.headerAction}>
                    <Feather name="more-vertical" size={18} color={T.ink2} />
                </TouchableOpacity>
            </View>

            {/* ── Mini-Map (LIVE only) ──────────────────────────────── */}
            {incident && <MiniMap incident={incident} />}

            {/* ── Messages ──────────────────────────────────────────── */}
            <KeyboardAvoidingView
                style={st.chatArea}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={insets.top + 60}
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
                            <Feather name="message-circle" size={36} color={T.ink4} />
                            <Text style={st.emptyChatText}>No messages yet</Text>
                        </View>
                    }
                />

                {/* ── Input Bar ────────────────────────────────────────── */}
                <View style={{ paddingBottom: Math.max(insets.bottom, S.s2) }}>
                    <InputBar onSend={handleSend} />
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },

    // ── Header
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s4, paddingVertical: S.s3,
        borderBottomWidth: 1, borderBottomColor: T.lineMid,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: T.surfaceCard,
        borderWidth: 1, borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
        marginRight: S.s3,
    },
    headerCenter: { flex: 1 },
    headerTitle: {
        fontSize: 16, fontWeight: '700', color: T.ink,
        letterSpacing: -0.2,
    },
    headerMeta: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2,
    },
    headerLiveDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: T.danger,
    },
    headerStatus: {
        fontSize: 10, fontWeight: '700', color: T.ink4,
        letterSpacing: 0.8, textTransform: 'uppercase',
    },
    connDot: {
        width: 5, height: 5, borderRadius: 2.5,
        marginLeft: 4,
    },
    headerAction: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: T.surfaceCard,
        borderWidth: 1, borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
    },

    // ── Mini Map
    mapStrip: {
        height: MAP_STRIP_HEIGHT,
        borderBottomWidth: 1, borderBottomColor: T.lineMid,
        overflow: 'hidden',
    },
    mapMarker: {
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: 'rgba(226,54,54,0.30)',
        alignItems: 'center', justifyContent: 'center',
    },
    mapMarkerInner: {
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: T.danger,
        borderWidth: 2, borderColor: T.onDanger,
    },
    mapLabel: {
        position: 'absolute', bottom: S.s2, left: S.s3,
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: T.surfaceGlass,
        paddingHorizontal: S.s3, paddingVertical: 4,
        borderRadius: R.full,
        borderWidth: 1, borderColor: T.lineMid,
    },
    mapLabelDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: T.danger,
    },
    mapLabelText: {
        fontSize: 10, fontWeight: '700', color: T.dangerText,
        letterSpacing: 0.5, textTransform: 'uppercase',
    },

    // ── Chat area
    chatArea: { flex: 1 },
    messageList: {
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s2,
    },

    // ── Bubble layout
    bubbleRow: {
        marginBottom: S.s3,
    },
    bubbleRowOwn: { alignItems: 'flex-end' },
    bubbleRowOther: { alignItems: 'flex-start' },

    bubble: {
        maxWidth: '78%',
        borderRadius: R.lg,
        padding: S.s3,
        borderWidth: 1,
    },
    bubbleOther: {
        backgroundColor: T.surfaceCard,
        borderColor: T.lineMid,
        borderTopLeftRadius: 4,
    },
    bubbleOwn: {
        backgroundColor: 'rgba(138,56,246,0.15)',
        borderColor: 'rgba(138,56,246,0.25)',
        borderTopRightRadius: 4,
    },
    bubbleVictim: {
        backgroundColor: 'rgba(226,54,54,0.08)',
        borderColor: T.dangerBorder,
        borderLeftWidth: 3,
        borderLeftColor: T.danger,
    },

    // ── Sender info
    senderRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginBottom: 4,
    },
    senderName: {
        fontSize: 12, fontWeight: '700', color: T.ink2,
    },

    // ── Role badge
    roleBadge: {
        paddingHorizontal: 6, paddingVertical: 1,
        borderRadius: R.xs, borderWidth: 1,
    },
    roleBadgeText: {
        fontSize: 8, fontWeight: '800', letterSpacing: 0.8,
    },

    // ── Message content
    msgText: {
        fontSize: 14, color: T.ink2, lineHeight: 20,
    },
    msgTextOwn: { color: T.ink },
    msgTime: {
        fontSize: 10, color: T.ink4, marginTop: 4,
        alignSelf: 'flex-end',
    },
    msgTimeOwn: { color: T.ink4 },

    // ── System message
    systemWrap: {
        flexDirection: 'row', alignItems: 'center', gap: S.s2,
        marginVertical: S.s3, paddingHorizontal: S.s2,
    },
    systemLine: {
        flex: 1, height: 1,
        backgroundColor: T.lineMid,
    },
    systemContent: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.s3, paddingVertical: 4,
    },
    systemText: {
        fontSize: 11, color: T.ink4, fontStyle: 'italic',
        textAlign: 'center',
    },
    systemTextEvidence: {
        color: T.violet, fontWeight: '600', fontStyle: 'normal',
    },

    // ── Image + Audio placeholder
    imageWrap: {
        width: '100%', height: 120,
        borderRadius: R.sm, backgroundColor: T.surfaceMid,
        alignItems: 'center', justifyContent: 'center', gap: S.s2,
    },
    imageLabel: { fontSize: 11, color: T.ink4, fontWeight: '500' },
    audioWrap: {
        flexDirection: 'row', alignItems: 'center', gap: S.s2,
        paddingVertical: S.s1,
    },
    audioBar: {
        flex: 1, height: 3, borderRadius: 1.5,
        backgroundColor: T.violetDim,
    },
    audioDur: { fontSize: 10, color: T.ink4, fontWeight: '600' },

    // ── Input bar
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        paddingHorizontal: S.s3, paddingVertical: S.s2,
        borderTopWidth: 1, borderTopColor: T.lineMid,
        backgroundColor: T.surface,
        gap: S.s2,
    },
    inputAction: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: T.surfaceCard,
        borderWidth: 1, borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
    },
    inputWrap: {
        flex: 1, minHeight: 36, maxHeight: 100,
        backgroundColor: T.surfaceCard,
        borderRadius: R.xl,
        borderWidth: 1, borderColor: T.lineMid,
        paddingHorizontal: S.s4,
        justifyContent: 'center',
    },
    input: {
        fontSize: 14, color: T.ink,
        paddingVertical: Platform.OS === 'ios' ? S.s2 : S.s1,
    },
    sendBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: T.violet,
        alignItems: 'center', justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.30, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
        }),
    },
    sendBtnDisabled: {
        backgroundColor: T.surfaceMid,
        ...Platform.select({
            ios: { shadowOpacity: 0 },
            android: { elevation: 0 },
        }),
    },

    // ── Empty state
    emptyChat: {
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 80, gap: S.s2,
    },
    emptyChatText: {
        ...Ty.bodySm, color: T.ink4,
    },
});
