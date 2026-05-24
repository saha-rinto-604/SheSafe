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
    Animated, LayoutAnimation, UIManager, ActivityIndicator, Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { type Incident, type IncidentCategory } from '../../../../src/types/chat';
import { incidentService } from '../../../../src/services/incidentService';
import { notificationStore, subscribeUnread } from '../../../../src/services/notificationStore';

const D = {
    cardFill: T.surfaceBulky,
    hairline: 'rgba(255, 255, 255, 0.1)',
    title: '#FFFFFF',
    subtitle: '#C4C1D4',
    timestamp: '#A09CB2',
    neonViolet: T.violet,
    cardRadius: 28,
    cardPadding: 20,
    avatarSize: 44,
} as const;

const SEGMENTS = ['Assisted', 'My Emergencies'] as const;
type Segment = (typeof SEGMENTS)[number];
type VolunteerIncident = Incident & {
    category: IncidentCategory;
    incidentCode?: string;
    updatedAt?: string;
    lastMessage?: { senderName: string; senderRole: string; text: string; createdAt: string } | null;
    sosUser?: { id: string; name: string; photoUri?: string | null };
    responders?: { id: string; name: string; photoUri?: string | null; acceptedAt?: string | null }[];
    responderCount?: number;
    maxResponders?: number;
};

function isActiveStatus(status: Incident['status']): boolean {
    return status === 'ACTIVE' || status === 'LIVE';
}

function isCancelledStatus(status: Incident['status']): boolean {
    return status === 'CANCELLED';
}

function normalizeStatus(status: string): Incident['status'] {
    if (status === 'Active') return 'ACTIVE';
    if (status === 'Resolved') return 'RESOLVED';
    if (status === 'Cancelled') return 'CANCELLED';
    return (status || 'ACTIVE') as Incident['status'];
}

function normalizeLatestMessage(raw: Incident['latestMessage'], fallbackAt: string) {
    if (typeof raw === 'string') {
        return {
            content: raw,
            sender: { id: 'system', name: 'System', role: 'USER' as const },
            timestamp: fallbackAt,
            type: 'TEXT' as const,
        };
    }
    return raw ?? null;
}

function incidentActivityTime(incident: VolunteerIncident): number {
    const latest = normalizeLatestMessage(incident.latestMessage, incident.createdAt);
    const timestamp = incident.lastMessage?.createdAt ?? latest?.timestamp ?? incident.updatedAt ?? incident.acceptedAt ?? incident.createdAt;
    const time = new Date(timestamp).getTime();
    return Number.isFinite(time) ? time : 0;
}

function incidentNumber(incident: VolunteerIncident): number {
    const id = Number(String(incident.id).replace(/\D/g, ''));
    return Number.isFinite(id) ? id : 0;
}

function compareIncidentsForMessages(a: VolunteerIncident, b: VolunteerIncident): number {
    const aLive = isActiveStatus(a.status);
    const bLive = isActiveStatus(b.status);
    if (aLive !== bLive) return aLive ? -1 : 1;
    const byIncidentNumber = incidentNumber(b) - incidentNumber(a);
    if (byIncidentNumber !== 0) return byIncidentNumber;
    return incidentActivityTime(b) - incidentActivityTime(a);
}

function myIncidentToChatIncident(raw: any): VolunteerIncident {
    const status = normalizeStatus(String(raw.status));
    const createdAt = String(raw.occurredAt ?? raw.created_at ?? new Date().toISOString());
    return {
        id: String(raw.id),
        category: 'MY_EMERGENCY',
        type: 'SOS Alert',
        status,
        location: {
            latitude: Number(raw.latitude),
            longitude: Number(raw.longitude),
            updatedAt: createdAt,
        },
        address: raw.location ?? null,
        latestMessage: null,
        participantCount: 1,
        createdAt,
    };
}

function assistedIncidentToChatIncident(raw: any): VolunteerIncident {
    const createdAt = String(raw.createdAt ?? raw.created_at ?? new Date().toISOString());
    const updatedAt = String(raw.updatedAt ?? raw.updated_at ?? raw.lastMessage?.createdAt ?? createdAt);
    return {
        ...raw,
        id: String(raw.id),
        type: raw.type ?? 'SOS Alert',
        status: normalizeStatus(String(raw.status)),
        location: raw.location ?? {
            latitude: Number(raw.latitude ?? 0),
            longitude: Number(raw.longitude ?? 0),
            updatedAt,
        },
        latestMessage: normalizeLatestMessage(raw.latestMessage, updatedAt),
        participantCount: Number(raw.participantCount ?? (Number(raw.responderCount ?? 0) + 1)),
        createdAt,
        updatedAt,
        reporter: raw.sosUser?.name ?? raw.reporter,
        reporterPhotoUrl: raw.sosUser?.photoUri ?? raw.reporterPhotoUrl,
        lastMessage: raw.lastMessage ?? null,
        sosUser: raw.sosUser,
        responders: raw.responders ?? [],
        responderCount: Number(raw.responderCount ?? raw.responders?.length ?? 0),
        maxResponders: Number(raw.maxResponders ?? 3),
        incidentCode: raw.incidentCode ?? `Incident #${raw.id}`,
        category: 'ASSISTED',
    };
}

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
    isLive, uri,
}: { isLive: boolean; isMyEmergency: boolean; uri?: string | null }) {
    return (
        <View style={[st.avatar, isLive ? st.avatarLive : st.avatarResolved]}>
            {uri ? (
                <Image source={{ uri }} style={st.avatarImage} />
            ) : (
                <Feather
                    name="users"
                    size={18}
                    color={isLive ? T.violet : D.subtitle}
                />
            )}
        </View>
    );
});

// ─── Status pill — exact same colors as standard-user chat_home ────────────
function StatusPill({ status }: { status: Incident['status'] }) {
    const isLive = isActiveStatus(status);
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
    incident: VolunteerIncident;
    onPress: () => void;
    isMyEmergency: boolean;
}) {
    const isLive = isActiveStatus(incident.status);
    const latestMessage = normalizeLatestMessage(incident.latestMessage, incident.createdAt);
    const lastMessage = incident.lastMessage?.text ?? latestMessage?.content ?? 'No messages yet';
    const lastSender = incident.lastMessage?.senderName ?? latestMessage?.sender.name ?? (incident.reporter || 'System');
    const activeBorderColor = T.violet;
    const activityAt = incident.lastMessage?.createdAt ?? incident.updatedAt ?? incident.createdAt;
    const responderCount = incident.responderCount ?? Math.max((incident.participantCount ?? 1) - 1, 0);
    const maxResponders = incident.maxResponders ?? 3;

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
                <GroupAvatar isLive={isLive} isMyEmergency={false} uri={incident.sosUser?.photoUri ?? incident.reporterPhotoUrl} />
            </View>

            {/* CENTER — title + last message preview */}
            <View style={[st.cardCenter, { alignSelf: 'center' }]}>
                <Text style={st.cardTitle} numberOfLines={1}>
                    {isMyEmergency ? 'My Emergency ' : ''}{incident.incidentCode ?? `Incident ${caseId(incident.id)}`}
                </Text>
                <Text style={st.cardMeta} numberOfLines={1}>
                    <Text style={st.cardMetaName}>{lastSender}</Text>
                    {': '}
                    {lastMessage}
                </Text>
                {!isMyEmergency && (
                    <View style={st.responderMiniRow}>
                        <Feather name="users" size={12} color={isLive ? T.violet : D.timestamp} />
                        <Text style={st.responderMiniText}>{responderCount}/{maxResponders} responders</Text>
                    </View>
                )}
            </View>

            {/* RIGHT — time + status pill */}
            <View style={st.cardRight}>
                <Text style={st.cardTime}>{timeAgo(activityAt)}</Text>
                <StatusPill status={incident.status} />
            </View>
        </TouchableOpacity>
    );
}

// ─── Empty State ───────────────────────────────────────────────────────────
function EmptyState({ isMyEmergency, isSearching }: { isMyEmergency: boolean; isSearching?: boolean }) {
    return (
        <View style={st.empty}>
            <View style={st.emptyCircle}>
                <Feather name={isMyEmergency ? 'alert-circle' : 'shield'} size={28} color={D.timestamp} />
            </View>
            <Text style={st.emptyTitle}>{isSearching ? 'No matches' : isMyEmergency ? 'No Emergencies' : 'No Incidents'}</Text>
            <Text style={st.emptySub}>
                {isSearching
                    ? 'Try an incident number, #ID, or the name of someone in the chat.'
                    : isMyEmergency
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
    const [segment, setSegment] = useState<Segment>('Assisted');
    const [segmentWidth, setSegmentWidth] = useState(0);
    const [incidents, setIncidents] = useState<VolunteerIncident[]>([]);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasUnreadNotif, setHasUnreadNotif] = useState(false);
    const indicator = useRef(new Animated.Value(0)).current;
    const navigationGuardRef = useRef(false);

    const navigateSafely = useCallback((path: string) => {
        if (navigationGuardRef.current) return;
        navigationGuardRef.current = true;
        router.push(path as any);
        setTimeout(() => { navigationGuardRef.current = false; }, 800);
    }, [router]);

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    // Subscribe to unread count so the red dot updates in real-time.
    useEffect(() => {
        const unsub = subscribeUnread(count => setHasUnreadNotif(count > 0));
        notificationStore.getUnreadCount().catch(() => {});
        return unsub;
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

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(searchQuery), 320);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    const loadIncidents = useCallback(async () => {
        setError(null);
        const [assisted, mine] = await Promise.all([
            incidentService.getVolunteerAssistedIncidents(segment === 'Assisted' ? debouncedSearch : undefined),
            incidentService.getMyIncidents(),
        ]);
        setIncidents([
            ...assisted.map(assistedIncidentToChatIncident),
            ...mine.map(myIncidentToChatIncident),
        ]);
    }, [debouncedSearch, segment]);

    useEffect(() => {
        setLoading(true);
        loadIncidents()
            .catch(error => {
                console.warn('[VolunteerMessages] Failed to load incidents:', error);
                setError(error?.message || 'Unable to load incidents.');
            })
            .finally(() => setLoading(false));
    }, [loadIncidents]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadIncidents();
        } finally {
            setRefreshing(false);
        }
    }, [loadIncidents]);

    const isMyEmergency = segment === 'My Emergencies';
    const categoryKey: IncidentCategory = isMyEmergency ? 'MY_EMERGENCY' : 'ASSISTED';

    const filtered = useMemo(() => {
        const base = incidents
            .filter(i => i.category === categoryKey)
            .filter(i => categoryKey === 'ASSISTED' || !isCancelledStatus(i.status));

        const sorted = [...base].sort(compareIncidentsForMessages);
        if (categoryKey === 'ASSISTED') return sorted;
        if (!searchQuery.trim()) return sorted;
        const q = searchQuery.toLowerCase();
        return sorted.filter(i => {
            const latest = normalizeLatestMessage(i.latestMessage, i.createdAt);
            return (
                i.type.toLowerCase().includes(q) ||
                i.reporter?.toLowerCase().includes(q) ||
                latest?.sender.name.toLowerCase().includes(q) ||
                latest?.content.toLowerCase().includes(q)
            );
        });
    }, [categoryKey, incidents, searchQuery]);

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
                        onPress={() => { Haptics.selectionAsync(); navigateSafely('/(tabs)/users/volunteer/notifications'); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Open volunteer notifications"
                        accessibilityRole="button"
                    >
                        <Ionicons name="notifications-outline" size={20} color={T.ink2} />
                        {hasUnreadNotif && <View style={st.notifDot} />}
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
                {error && (
                    <TouchableOpacity style={st.errorCard} onPress={onRefresh} activeOpacity={0.8}>
                        <Feather name="refresh-cw" size={16} color={T.danger} />
                        <Text style={st.errorText}>{error} Tap to retry.</Text>
                    </TouchableOpacity>
                )}

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
                    contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 24 }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={D.neonViolet}
                            colors={[D.neonViolet]}
                        />
                    }
                    ListEmptyComponent={
                        loading ? (
                            <View style={st.loadingCard}>
                                <ActivityIndicator color={T.violet} />
                                <Text style={st.loadingText}>Loading incidents...</Text>
                            </View>
                        ) : (
                            <EmptyState isMyEmergency={isMyEmergency} isSearching={!!searchQuery.trim()} />
                        )
                    }
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
    notifDot: {
        position: 'absolute',
        top: 7,
        right: 7,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: T.danger,
        borderWidth: 1.5,
        borderColor: T.surface,
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
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
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
    responderMiniRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    responderMiniText: {
        fontSize: 11,
        fontWeight: '700',
        color: D.timestamp,
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
    loadingCard: {
        marginTop: S.s6,
        borderRadius: R.lg,
        paddingVertical: S.s5,
        alignItems: 'center',
        gap: S.s3,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: D.hairline,
    },
    loadingText: {
        color: D.subtitle,
        fontSize: 13,
        fontWeight: '600',
    },
    errorCard: {
        marginHorizontal: 20,
        marginBottom: S.s3,
        borderRadius: R.lg,
        padding: S.s4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s3,
        backgroundColor: 'rgba(226,54,54,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(226,54,54,0.28)',
    },
    errorText: {
        flex: 1,
        color: '#FCA5A5',
        fontSize: 13,
        fontWeight: '600',
    },
});
