/**
 * incident-chat.tsx — Archived Incident Chat (Standard User)
 * ──────────────────────────────────────────────────────────────
 * Read-only view of a closed/archived incident chat.
 * Loads messages and responders from REST API — no WebSocket.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    StatusBar, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { T, R } from '../../../../src/constants/theme';
import {
    incidentService,
    type IncidentMessageResponse,
    type IncidentRespondersResponse,
} from '../../../../src/services/incidentService';
import { useAuth } from '../../../../src/context/AuthContext';

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
}

function roleBadgeStyle(role: string): { color: string; bg: string } {
    if (role === 'volunteer') return { color: '#C4B5FD', bg: 'rgba(138,56,246,0.15)' };
    if (role === 'standard_user') return { color: T.dangerText, bg: T.dangerBg };
    return { color: T.ink4, bg: 'transparent' };
}

function roleLabel(role: string): string {
    if (role === 'volunteer') return 'VOLUNTEER';
    if (role === 'standard_user') return 'VICTIM';
    return '';
}

function archiveMessage(status: string): string {
    const s = String(status).toUpperCase();
    if (s === 'CANCELLED') return 'This SOS was cancelled. Chat is read-only.';
    if (s === 'RESOLVED') return 'This SOS is resolved. Chat is read-only.';
    return 'This chat is read-only.';
}

// ── Message Components ───────────────────────────────────────────────────────
function SystemBubble({ text }: { text: string }) {
    return (
        <View style={ms.systemWrap}>
            <View style={ms.systemLine} />
            <View style={ms.systemPill}>
                <Text style={ms.systemText}>{text}</Text>
            </View>
            <View style={ms.systemLine} />
        </View>
    );
}

function MessageBubble({ msg, isOwn }: { msg: IncidentMessageResponse; isOwn: boolean }) {
    if (msg.senderRole === 'system') return <SystemBubble text={msg.text} />;

    const badge = roleBadgeStyle(msg.senderRole);
    const label = roleLabel(msg.senderRole);
    const tailStyle = isOwn
        ? { borderBottomRightRadius: 6 }
        : { borderBottomLeftRadius: 6 };

    return (
        <View style={[ms.row, isOwn ? ms.rowOwn : ms.rowOther]}>
            {!isOwn && (
                <UserAvatar uri={msg.senderPhotoUri ?? null} size={32} style={ms.avatar} />
            )}
            <View style={ms.col}>
                {!isOwn && (
                    <View style={ms.senderRow}>
                        <Text style={ms.senderName}>{msg.senderName}</Text>
                        {!!label && (
                            <View style={[ms.roleBadge, { backgroundColor: badge.bg }]}>
                                <Text style={[ms.roleText, { color: badge.color }]}>{label}</Text>
                            </View>
                        )}
                    </View>
                )}
                <View style={[ms.bubble, isOwn ? ms.bubbleOwn : ms.bubbleOther, tailStyle]}>
                    <Text style={[ms.text, isOwn && ms.textOwn]}>{msg.text}</Text>
                </View>
                <Text style={[ms.time, isOwn && ms.timeOwn]}>{formatTime(msg.createdAt)}</Text>
            </View>
        </View>
    );
}

// ── Responders Strip ─────────────────────────────────────────────────────────
function RespondersStrip({ responders }: { responders: IncidentRespondersResponse }) {
    const participants = [
        { id: responders.sosUser.id, name: responders.sosUser.name, photoUri: responders.sosUser.photoUri ?? null, label: 'VICTIM' },
        ...responders.volunteers.map(v => ({ id: v.id, name: v.name, photoUri: v.photoUri ?? null, label: 'VOLUNTEER' })),
    ];
    return (
        <View style={rs.strip}>
            <Text style={rs.heading}>Participants</Text>
            <View style={rs.chips}>
                {participants.map((p) => (
                    <View key={p.id} style={rs.chip}>
                        <UserAvatar uri={p.photoUri} size={26} />
                        <Text style={rs.name} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                        <Text style={rs.role}>{p.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function IncidentChatScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { userId } = useAuth();
    const { incidentId, status } = useLocalSearchParams<{ incidentId: string; status: string }>();

    const [messages, setMessages] = useState<IncidentMessageResponse[]>([]);
    const [responders, setResponders] = useState<IncidentRespondersResponse | null>(null);
    const [loading, setLoading] = useState(!!incidentId);
    const [error, setError] = useState<string | null>(incidentId ? null : 'No incident ID provided.');
    const flatRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!incidentId) {
            return;
        }
        Promise.all([
            incidentService.getIncidentMessages(incidentId),
            incidentService.getIncidentResponders(incidentId),
        ])
            .then(([msgs, resp]) => {
                setMessages(msgs);
                setResponders(resp);
            })
            .catch((err) => setError(err?.message || 'Failed to load incident chat.'))
            .finally(() => setLoading(false));
    }, [incidentId]);

    return (
        <AtmosphericShell>
            <View style={[s.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* Header */}
                <View style={s.headerOuter}>
                    <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={s.headerInner}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={s.headerBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Feather name="chevron-left" size={22} color={T.ink} />
                        </TouchableOpacity>
                        <View style={s.headerTitleBlock}>
                            <Text style={s.headerTitle} numberOfLines={1}>
                                Incident #{incidentId}
                            </Text>
                            <View style={s.archivedPill}>
                                <Feather name="lock" size={9} color={T.ink4} style={{ marginRight: 4 }} />
                                <Text style={s.archivedText}>ARCHIVED</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Participants */}
                {responders && <RespondersStrip responders={responders} />}

                {/* Messages */}
                {loading ? (
                    <View style={s.center}>
                        <ActivityIndicator color={T.violet} size="large" />
                        <Text style={s.loadingText}>Loading messages…</Text>
                    </View>
                ) : error ? (
                    <View style={s.center}>
                        <Feather name="alert-circle" size={28} color={T.danger} />
                        <Text style={s.errorText}>{error}</Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatRef}
                        data={messages}
                        renderItem={({ item }) => (
                            <MessageBubble
                                msg={item}
                                isOwn={item.senderId === String(userId ?? '')}
                            />
                        )}
                        keyExtractor={item => item.id}
                        contentContainerStyle={s.list}
                        showsVerticalScrollIndicator={false}
                        onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
                        ListEmptyComponent={
                            <View style={s.center}>
                                <Feather name="message-circle" size={24} color={T.ink5} />
                                <Text style={s.emptyText}>No messages in this incident.</Text>
                            </View>
                        }
                    />
                )}

                {/* Archive footer */}
                <View style={[s.archiveFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={s.archiveInner}>
                        <Feather name="lock" size={13} color={T.ink4} />
                        <Text style={s.archiveText}>{archiveMessage(status ?? '')}</Text>
                    </View>
                </View>
            </View>
        </AtmosphericShell>
    );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
    systemWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, paddingHorizontal: 16 },
    systemLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: T.lineMid },
    systemPill: {
        paddingHorizontal: 12, paddingVertical: 4,
        backgroundColor: T.surfaceBulky, borderRadius: 20,
        borderWidth: 1, borderColor: T.lineMid, marginHorizontal: 8,
    },
    systemText: { fontSize: 11, color: T.ink4, textAlign: 'center' },

    row: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 14, alignItems: 'flex-end' },
    rowOwn: { justifyContent: 'flex-end' },
    rowOther: { justifyContent: 'flex-start' },
    avatar: { marginRight: 8, marginBottom: 2 },
    col: { maxWidth: '78%' },
    senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    senderName: { fontSize: 12, fontWeight: '700', color: 'rgba(245,245,247,0.66)' },
    roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    roleText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleOwn: { backgroundColor: 'rgba(124,58,237,0.95)' },
    bubbleOther: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
    text: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
    textOwn: { color: '#FFFFFF' },
    time: { fontSize: 10, color: 'rgba(245,245,247,0.34)', marginTop: 4 },
    timeOwn: { textAlign: 'right' },
});

const rs = StyleSheet.create({
    strip: {
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: T.lineMid,
        backgroundColor: T.surfaceGlass,
    },
    heading: { fontSize: 10, fontWeight: '700', color: T.ink4, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    chip: { alignItems: 'center', gap: 3 },
    name: { fontSize: 10, color: T.ink3, fontWeight: '600', maxWidth: 60 },
    role: { fontSize: 8, color: T.ink5, fontWeight: '700', letterSpacing: 0.5 },
});

const s = StyleSheet.create({
    root: { flex: 1 },

    headerOuter: {
        paddingHorizontal: 14, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: T.lineMid,
        overflow: 'hidden',
    },
    headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerBtn: {
        width: 36, height: 36, borderRadius: R.hBtn,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, backgroundColor: T.surfaceBulky,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    headerTitleBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: T.ink, flexShrink: 1 },
    archivedPill: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20,
        paddingHorizontal: 8, paddingVertical: 3,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    archivedText: { fontSize: 9, fontWeight: '800', color: T.ink4, letterSpacing: 1.2 },

    list: { paddingTop: 16, paddingBottom: 24 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
    loadingText: { fontSize: 13, color: T.ink4 },
    errorText: { fontSize: 14, color: T.danger, textAlign: 'center', paddingHorizontal: 24 },
    emptyText: { fontSize: 13, color: T.ink4, textAlign: 'center' },

    archiveFooter: {
        paddingTop: 12, paddingHorizontal: 16,
        borderTopWidth: 1, borderTopColor: T.lineMid,
        overflow: 'hidden',
    },
    archiveInner: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
    archiveText: { fontSize: 12, color: T.ink4, textAlign: 'center', flex: 1 },
});
