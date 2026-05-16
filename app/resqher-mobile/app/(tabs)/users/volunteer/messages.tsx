/**
 * volunteer/messages.tsx — Incident Chat Hub (Volunteer)
 * Dual-category tabs: "Assisting" (responded to others) vs "My Emergencies" (own SOS).
 * Card design mirrors standard-user chat_home.tsx exactly.
 * Segment switcher mirrors activity.tsx exactly.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    Platform, StatusBar, RefreshControl, TextInput,
    Animated, LayoutAnimation, UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { type Incident, type IncidentCategory } from '../../../../src/types/chat';

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — mirror standard-user chat_home.tsx exactly
// ═══════════════════════════════════════════════════════════════════════════
const D = {
    cardFill: T.surfaceBulky,
    cardFillActive: T.surfaceBulkyActive,
    hairline: 'rgba(255, 255, 255, 0.1)',
    title: '#FFFFFF',
    subtitle: '#C4C1D4',
    timestamp: '#A09CB2',
    neonViolet: T.violet,
    vividRed: '#FF453A',
    sosAvatarBg: T.violetDim,
    sosAvatarBorder: T.violet,
    cardRadius: 28,
    cardPadding: 20,
    avatarSize: 44,
} as const;

const SEGMENTS = ['Assisted', 'My Emergencies'] as const;
type Segment = (typeof SEGMENTS)[number];

// ─── Constants ────────────────────────────────────────────────────────────
const SELF_ID = 'self';

// ─── Mock Data ─────────────────────────────────────────────────────────────
const MOCK_INCIDENTS: (Incident & { category: IncidentCategory })[] = [
    // ── ASSISTED — Active card (new)
    {
        id: 'inc-312',
        category: 'ASSISTED',
        type: 'SOS Alert',
        status: 'LIVE',
        location: { latitude: 23.8103, longitude: 90.4125, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'I can see her. Moving to intercept from north side.',
            sender: { id: SELF_ID, name: 'You', role: 'VOLUNTEER' },
            timestamp: new Date(Date.now() - 20000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 3,
        createdAt: new Date(Date.now() - 240000).toISOString(),
    },
    // ── ASSISTED — Resolved
    {
        id: 'inc-204',
        category: 'ASSISTED',
        type: 'SOS Alert',
        status: 'RESOLVED',
        location: { latitude: 23.7956, longitude: 90.3657, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'Thank you for coming quickly. I am safe now.',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            timestamp: new Date(Date.now() - 60000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 3,
        createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    // ── ASSISTED — Cancelled
    {
        id: 'inc-198',
        category: 'ASSISTED',
        type: 'Medical Emergency',
        status: 'CANCELLED',
        location: { latitude: 23.7461, longitude: 90.3742, updatedAt: new Date(Date.now() - 120000).toISOString() },
        latestMessage: {
            content: 'Incident cancelled by victim before responder arrival.',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            timestamp: new Date(Date.now() - 30000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 2,
        createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    // ── ASSISTED — Resolved
    {
        id: 'inc-175',
        category: 'ASSISTED',
        type: 'Harassment Report',
        status: 'RESOLVED',
        location: { latitude: 23.7806, longitude: 90.4194, updatedAt: new Date(Date.now() - 3600000).toISOString() },
        latestMessage: {
            content: 'Case resolved. Follow-up notes shared with victim.',
            sender: { id: 'v2', name: 'Raihan Ahmed', role: 'VOLUNTEER' },
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 3,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
    },

    // ── MY EMERGENCIES — Active
    {
        id: 'inc-301',
        category: 'MY_EMERGENCY',
        type: 'SOS Alert',
        status: 'LIVE',
        location: { latitude: 23.8293, longitude: 90.4182, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: "I'm 3 minutes away. Stay in a lit area.",
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            timestamp: new Date(Date.now() - 15000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 2,
        createdAt: new Date(Date.now() - 180000).toISOString(),
    },
    // ── MY EMERGENCIES — Resolved
    {
        id: 'inc-289',
        category: 'MY_EMERGENCY',
        type: 'Harassment Report',
        status: 'RESOLVED',
        location: { latitude: 23.7806, longitude: 90.4120, updatedAt: new Date(Date.now() - 86400000).toISOString() },
        latestMessage: {
            content: "Glad you're safe. Incident has been logged.",
            sender: { id: 'v3', name: 'Raihan Ahmed', role: 'VOLUNTEER' },
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 2,
        createdAt: new Date(Date.now() - 90000000).toISOString(),
    },
    // ── MY EMERGENCIES — Cancelled
    {
        id: 'inc-270',
        category: 'MY_EMERGENCY',
        type: 'Medical Emergency',
        status: 'CANCELLED',
        location: { latitude: 23.7461, longitude: 90.3800, updatedAt: new Date(Date.now() - 172800000).toISOString() },
        latestMessage: {
            content: 'You cancelled this request. No further action taken.',
            sender: { id: 'system', name: 'System', role: 'USER' },
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 1,
        createdAt: new Date(Date.now() - 180000000).toISOString(),
    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function caseId(id: string): string {
    return `#${id.replace(/\D/g, '').padStart(3, '0')}`;
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ─── GroupAvatar — mirrors standard-user chat_home exactly ─────────────────
// Active: violet tint + 'users' icon (same as standard user)
// Resolved/Cancelled: muted dark fill
const GroupAvatar = memo(function GroupAvatar({
    isLive,
}: { isLive: boolean; isMyEmergency: boolean }) {
    return (
        <View style={[st.avatar, isLive ? st.avatarLive : st.avatarResolved]}>
            <Feather
                name="users"
                size={18}
                color={isLive ? T.violet : D.subtitle}
            />
        </View>
    );
});

// ─── Status pill — exact same colors as standard-user chat_home ────────────
function StatusPill({ status }: { status: Incident['status'] }) {
    const isLive = status === 'LIVE';
    const isCancelled = status === 'CANCELLED';
    return (
        <View style={[
            st.statusPill,
            isLive ? st.statusPillActive : isCancelled ? st.statusPillCancelled : st.statusPillResolved,
        ]}>
            <Text style={[
                st.statusPillText,
                isLive ? st.statusTextActive : isCancelled ? st.statusTextCancelled : st.statusTextResolved,
            ]}>
                {isLive ? 'ACTIVE' : isCancelled ? 'CANCELLED' : 'RESOLVED'}
            </Text>
        </View>
    );
}

// ─── IncidentCard — styled exactly like standard-user chat_home cards ───────
function IncidentCard({
    incident, onPress, isMyEmergency,
}: {
    incident: Incident & { category: IncidentCategory };
    onPress: () => void;
    isMyEmergency: boolean;
}) {
    const isLive = incident.status === 'LIVE';
    const lastMessage = incident.latestMessage?.content ?? 'No messages yet';
    const lastSender = incident.latestMessage?.sender.name ?? 'Unknown';
    const activeBorderColor = T.violet;

    return (
        <TouchableOpacity
            style={[
                st.card,
                isLive && { borderLeftWidth: 4, borderLeftColor: activeBorderColor },
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* LEFT — avatar */}
            <View style={{ alignSelf: 'center' }}>
                <GroupAvatar isLive={isLive} isMyEmergency={false} />
            </View>

            {/* CENTER — title + last message preview */}
            <View style={[st.cardCenter, { alignSelf: 'center' }]}>
                <Text style={st.cardTitle} numberOfLines={1}>
                    {isMyEmergency ? 'My Emergency ' : 'Incident '}{caseId(incident.id)}
                </Text>
                <Text style={st.cardMeta} numberOfLines={1}>
                    <Text style={st.cardMetaName}>{lastSender}</Text>
                    {': '}
                    {lastMessage}
                </Text>
            </View>

            {/* RIGHT — time + status pill */}
            <View style={st.cardRight}>
                <Text style={st.cardTime}>{timeAgo(incident.createdAt)}</Text>
                <StatusPill status={incident.status} />
            </View>
        </TouchableOpacity>
    );
}

// ─── Empty State ───────────────────────────────────────────────────────────
function EmptyState({ isMyEmergency }: { isMyEmergency: boolean }) {
    return (
        <View style={st.empty}>
            <View style={st.emptyCircle}>
                <Feather name={isMyEmergency ? 'alert-circle' : 'shield'} size={28} color={D.timestamp} />
            </View>
            <Text style={st.emptyTitle}>{isMyEmergency ? 'No Emergencies' : 'No Incidents'}</Text>
            <Text style={st.emptySub}>
                {isMyEmergency
                    ? 'Your personal SOS incidents will appear here'
                    : 'Active incidents you respond to will appear here'}
            </Text>
        </View>
    );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function VolunteerMessages() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [segment, setSegment] = useState<Segment>('Assisting');
    const [segmentWidth, setSegmentWidth] = useState(0);
    const indicator = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    // Sliding indicator animation — identical to activity.tsx
    useEffect(() => {
        Animated.timing(indicator, {
            toValue: segment === 'Assisted' ? 0 : 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [indicator, segment]);

    const indicatorStyle = useMemo(() => {
        const translateX = indicator.interpolate({
            inputRange: [0, 1],
            outputRange: [0, segmentWidth],
        });
        return { transform: [{ translateX }] };
    }, [indicator, segmentWidth]);

    const onSegmentPress = (next: Segment) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSegment(next);
        setSearchQuery('');
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await new Promise(r => setTimeout(r, 800));
        setRefreshing(false);
    }, []);

    const isMyEmergency = segment === 'My Emergencies';
    const categoryKey: IncidentCategory = isMyEmergency ? 'MY_EMERGENCY' : 'ASSISTED';

    const filtered = useMemo(() => {
        const base = MOCK_INCIDENTS.filter(i => i.category === categoryKey);
        if (!searchQuery.trim()) return base;
        const q = searchQuery.toLowerCase();
        return base.filter(i =>
            i.type.toLowerCase().includes(q) ||
            i.latestMessage?.sender.name.toLowerCase().includes(q)
        );
    }, [categoryKey, searchQuery]);

    const openChat = (incidentId: string) => {
        router.push(`/(tabs)/users/volunteer/chat_room?incidentId=${incidentId}&category=${categoryKey}` as any);
    };

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Header — identical to standard-user chat_home ── */}
                <View style={st.header}>
                    <TouchableOpacity
                        onPress={() => { Haptics.selectionAsync(); router.back(); }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={st.headerBtn}
                        activeOpacity={0.7}
                    >
                        <Feather name="chevron-left" size={22} color={D.title} />
                    </TouchableOpacity>

                    <View style={st.headerTitleArea}>
                        <Text style={st.headerTitle}>Chat Room</Text>
                    </View>

                    <TouchableOpacity
                        style={st.headerBtn}
                        activeOpacity={0.7}
                        onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/users/volunteer/notifications'); }}
                    >
                        <Feather name="bell" size={18} color={D.subtitle} />
                    </TouchableOpacity>
                </View>

                {/* 12px breathing space — same as standard user */}
                <View style={{ marginTop: 12 }} />

                {/* ── Segment tabs — identical to activity.tsx ── */}
                <View
                    style={st.segmentWrap}
                    onLayout={e => setSegmentWidth(e.nativeEvent.layout.width / 2)}
                >
                    <Animated.View style={[st.segmentIndicator, indicatorStyle]} />
                    {SEGMENTS.map(label => (
                        <TouchableOpacity
                            key={label}
                            style={st.segmentBtn}
                            activeOpacity={0.7}
                            onPress={() => onSegmentPress(label)}
                        >
                            <Text style={[st.segmentText, segment === label && st.segmentTextActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Search — same as standard-user chat_home ── */}
                <View style={st.searchArea}>
                    <View style={st.searchBlock}>
                        <Feather name="search" size={16} color={D.subtitle} />
                        <TextInput
                            style={st.searchInput}
                            placeholder={isMyEmergency ? 'Search my emergencies...' : 'Search assisted incidents...'}
                            placeholderTextColor={D.timestamp}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                onPress={() => { Haptics.selectionAsync(); setSearchQuery(''); }}
                                activeOpacity={0.7}
                            >
                                <Feather name="x" size={16} color={D.subtitle} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ── List ── */}
                <FlatList
                    style={{ marginHorizontal: 20 }}
                    data={filtered}
                    renderItem={({ item }) => (
                        <IncidentCard
                            incident={item}
                            isMyEmergency={isMyEmergency}
                            onPress={() => openChat(item.id)}
                        />
                    )}
                    keyExtractor={item => item.id}
                    contentContainerStyle={st.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={D.neonViolet}
                            colors={[D.neonViolet]}
                        />
                    }
                    ListEmptyComponent={<EmptyState isMyEmergency={isMyEmergency} />}
                    ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                />
            </View>
        </AtmosphericShell>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — card styles are 1:1 with standard-user chat_home.tsx
// ═══════════════════════════════════════════════════════════════════════════
const st = StyleSheet.create({
    root: { flex: 1 },

    // ── Header ──────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
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
    headerTitleArea: { flex: 1, alignItems: 'center' },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: D.title,
        letterSpacing: -0.3,
    },

    // ── Segment control — exact copy from activity.tsx ──────────────────
    segmentWrap: {
        marginHorizontal: 20,
        marginBottom: 14,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.pill,
        borderWidth: 1,
        borderColor: T.lineMid,
        flexDirection: 'row',
        position: 'relative',
        overflow: 'hidden',
    },
    segmentIndicator: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        width: '50%',
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulkyActive,
        borderWidth: 1,
        borderColor: `${T.violet}55`,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink4,
    },
    segmentTextActive: { color: T.ink },

    // ── Search — exact copy from standard-user chat_home ────────────────
    searchArea: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        paddingBottom: S.s4,
    },
    searchBlock: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: D.cardFill,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: D.cardRadius,
        paddingHorizontal: D.cardPadding,
        height: 50,
        gap: S.s3,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: D.title,
        paddingVertical: 0,
        lineHeight: 20,
    },

    // ── List ────────────────────────────────────────────────────────────
    list: {
        paddingTop: S.s1,
        paddingBottom: S.s5,
    },

    // ── Card — pixel-perfect match with standard-user chat_home ─────────
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: R.lg,
        paddingHorizontal: S.s4,
        paddingVertical: 16,
        gap: 14,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },

    // ── Avatars ──────────────────────────────────────────────────────────
    avatar: {
        width: D.avatarSize,
        height: D.avatarSize,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderWidth: 1,
    },
    avatarLive: {
        backgroundColor: T.violetDim,
        borderColor: T.violet,
    },
    avatarResolved: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.08)',
    },

    // ── Center column ────────────────────────────────────────────────────
    cardCenter: { flex: 1, minWidth: 0, gap: S.s1 },
    cardTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: D.title,
        letterSpacing: 0.1,
    },
    cardMeta: {
        flex: 1,
        fontSize: 12,
        fontWeight: '400',
        color: D.subtitle,
        lineHeight: 16,
    },
    cardMetaName: {
        fontWeight: '700',
        color: D.title,
    },

    // ── Right column ─────────────────────────────────────────────────────
    cardRight: {
        flexShrink: 0,
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: S.s2,
    },
    cardTime: {
        fontSize: 12,
        fontWeight: '500',
        color: D.timestamp,
    },

    // ── Status pills — exact same as standard-user chat_home + CANCELLED ─
    statusPill: {
        minWidth: 70,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    statusPillActive: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}55`,
    },
    statusPillResolved: {
        backgroundColor: 'rgba(16,185,129,0.12)',
        borderColor: 'rgba(16,185,129,0.35)',
    },
    statusPillCancelled: {
        backgroundColor: T.dangerLight,
        borderColor: T.dangerBorder,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    statusTextActive: { color: T.violet },
    statusTextResolved: { color: T.success },
    statusTextCancelled: { color: T.danger },

    // ── Empty ─────────────────────────────────────────────────────────────
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: S.s8 + S.s5,
        gap: S.s3,
    },
    emptyCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: D.cardFill,
        borderWidth: 1,
        borderColor: D.hairline,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: S.s2,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: D.subtitle },
    emptySub: {
        fontSize: 14,
        fontWeight: '400',
        color: D.timestamp,
        textAlign: 'center',
        paddingHorizontal: S.s5,
    },
});
