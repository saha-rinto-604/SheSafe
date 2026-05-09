/**
 * chat_home.tsx — Incident Hub (SF-04)
 * ─────────────────────────────────────────────────────────────────────────
 * 9.8/10 Premium — 'Bulky One-Unit' Substantial Architecture
 *
 * • Background: Deep Midnight Violet → Dark Indigo (AtmosphericShell)
 * • Cards: Solid #1E153A, radius 28, padding 20, hairline 0.03 border
 * • SOS: Red-tinted avatar (rgba(255,69,58,0.15) + 1px #FF453A border)
 *        with Neon Red pulsing dot — Chromatic Monochromatism
 * • Non-SOS LIVE: Violet avatar, Neon Violet pulse
 * • Resolved: 0.45 opacity solid recede
 * • NO navbar — list occupies full screen height
 */

import React, { useState, useCallback, memo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    Platform, StatusBar, RefreshControl, TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import { DEFAULT_GROUP_CHAT_NAME, type Incident } from '../../../../src/types/chat';

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════
const D = {
    // Universal Glass Mandate — uses global T tokens for material consistency
    cardFill: T.surfaceBulky,
    cardFillActive: T.surfaceBulkyActive,

    hairline: 'rgba(255, 255, 255, 0.1)',
    hairlineActive: 'rgba(255, 255, 255, 0.1)',

    title: '#FFFFFF',
    subtitle: '#C4C1D4',   // High-contrast silver-lavender — emergency readable
    timestamp: '#A09CB2',   // Brighter muted — passes squint test

    neonViolet: T.violet,
    vividRed: '#FF453A',

    // SOS avatar — tinted, not solid
    sosAvatarBg: T.violetDim,
    sosAvatarBorder: T.violet,

    cardRadius: 28,
    cardPadding: 20,
    avatarSize: 44,
} as const;

// ─── Mock Data ──────────────────────────────────────────────────────────────
const MOCK_INCIDENTS: Incident[] = [
    {
        id: 'inc-001',
        type: 'SOS Alert',
        status: 'LIVE',
        location: { latitude: 23.7956, longitude: 90.3657, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'I need help, someone is following me near Ibrahimpur Bazar',
            sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            timestamp: new Date(Date.now() - 60000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 3,
        createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    {
        id: 'inc-002',
        type: 'Medical Emergency',
        status: 'RESOLVED',
        location: { latitude: 23.7461, longitude: 90.3742, updatedAt: new Date(Date.now() - 120000).toISOString() },
        latestMessage: {
            content: 'Patient stabilized. Ambulance arrived.',
            sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            timestamp: new Date(Date.now() - 30000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 2,
        createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    {
        id: 'inc-003',
        type: 'Harassment Report',
        status: 'RESOLVED',
        location: { latitude: 23.7806, longitude: 90.4194, updatedAt: new Date(Date.now() - 3600000).toISOString() },
        latestMessage: {
            content: 'Case filed. Reference: BD-2026-03-04-0891',
            sender: { id: 'p1', name: 'Officer Alam', role: 'POLICE' },
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            type: 'TEXT',
        },
        participantCount: 4,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
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

function isSOS(type: string): boolean {
    return type.toLowerCase().includes('sos');
}

// ─── GroupAvatar — Chromatic monochromatism ─────────────────────────────────
// SOS: Red-tinted circle + 1px red border + white icon
// Non-SOS LIVE: Violet gradient + white icon
// Resolved: Dark muted fill + muted icon
const GroupAvatar = memo(function GroupAvatar({ isLive, isEmergency }: { isLive: boolean; isEmergency: boolean }) {
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

// ─── IncidentModule — Substantial extruded card ─────────────────────────────
function IncidentModule({ incident, onPress }: { incident: Incident; onPress: () => void }) {
    const isLive = incident.status === 'LIVE';
    const isEmergency = isSOS(incident.type);
    const lastMessage = incident.latestMessage?.content ?? 'No messages yet';
    const lastSender = incident.latestMessage?.sender.name ?? 'Unknown';

    return (
        <TouchableOpacity
            style={[
                st.card,
                isLive ? st.cardLive : st.cardResolved,
                isLive && isEmergency && st.cardSOS,
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* LEFT — 48×48 avatar */}
            <View style={{ alignSelf: 'center' }}>
                <GroupAvatar isLive={isLive} isEmergency={isEmergency} />
            </View>

            {/* CENTER — Title + muted case ID */}
            <View style={[st.cardCenter, { alignSelf: 'center' }]}>
                <Text style={st.cardTitle} numberOfLines={1}>
                    Incident {caseId(incident.id)}
                </Text>
                <Text style={st.cardMeta} numberOfLines={1}>
                    <Text style={st.cardMetaName}>{lastSender}</Text>
                    {': '}
                    {lastMessage}
                </Text>
            </View>

            {/* RIGHT — Timestamp + badge */}
            <View style={st.cardRight}>
                <Text style={st.cardTime}>
                    {timeAgo(incident.createdAt)}
                </Text>
                <View style={[
                    st.statusPill,
                    isLive ? st.statusPillActive : st.statusPillResolved,
                ]}>
                    <Text style={isLive ? st.statusTextActive : st.statusTextResolved}>
                        {isLive ? 'ACTIVE' : 'RESOLVED'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function ChatHome() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [incidents] = useState<Incident[]>(MOCK_INCIDENTS);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await new Promise(r => setTimeout(r, 800));
        setRefreshing(false);
    }, []);

    const filtered = searchQuery.trim()
        ? incidents.filter(i =>
            i.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.latestMessage?.sender.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : incidents;

    const openChat = (incidentId: string) => {
        router.push(`/(tabs)/users/standard-user/chat_room?incidentId=${incidentId}` as any);
    };

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Header ── */}
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
                        onPress={() => Haptics.selectionAsync()}
                    >
                        <Feather name="bell" size={18} color={D.subtitle} />
                    </TouchableOpacity>
                </View>

                {/* ── 12px Breathing Space Spacer ──────────────────────────────── */}
                <View style={{ marginTop: 12 }} />

                {/* ── Search ── */}
                <View style={st.searchArea}>
                    <View style={st.searchBlock}>
                        <Feather name="search" size={16} color={D.subtitle} />
                        <TextInput
                            style={st.searchInput}
                            placeholder="Search incidents..."
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

                {/* ── Incident List — full height, no navbar ── */}
                <FlatList
                    style={{ marginHorizontal: 20 }}
                    data={filtered}
                    renderItem={({ item }) => (
                        <IncidentModule incident={item} onPress={() => openChat(item.id)} />
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
                    ListEmptyComponent={
                        <View style={st.empty}>
                            <View style={st.emptyCircle}>
                                <Feather name="shield" size={28} color={D.timestamp} />
                            </View>
                            <Text style={st.emptyTitle}>No Incidents</Text>
                            <Text style={st.emptySub}>Active incidents will appear here</Text>
                        </View>
                    }
                    ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                />
            </View>
        </AtmosphericShell>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
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

    // ── Search ──────────────────────────────────────────────────────────
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

    // ── List — full height, no bottom inset for navbar ──────────────────
    list: {
        paddingTop: S.s1,
        paddingBottom: S.s5,
    },

    // ── Card ─────────────────────────────────────────────────────────────
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
    cardLive: {
        borderLeftWidth: 4,
        borderLeftColor: T.violet,
    },
    cardSOS: {},
    cardResolved: {},

    // ── Avatars ──────────────────────────────────────────────────────────
    // Rounded-rectangle group icon container
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

    // ── Center column ───────────────────────────────────────────────────
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

    // ── Right column ────────────────────────────────────────────────────
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
    statusTextActive: {
        fontSize: 11,
        fontWeight: '700',
        color: T.violet,
        letterSpacing: 0.6,
    },
    statusTextResolved: {
        fontSize: 11,
        fontWeight: '700',
        color: T.success,
        letterSpacing: 0.6,
    },

    // ── Empty ────────────────────────────────────────────────────────────
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
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: D.subtitle,
    },
    emptySub: {
        fontSize: 14,
        fontWeight: '400',
        color: D.timestamp,
    },
});
