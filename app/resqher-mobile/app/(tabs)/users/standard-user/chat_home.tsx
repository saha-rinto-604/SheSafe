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

import React, { useState, useCallback, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    Platform, StatusBar, RefreshControl, TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withRepeat, withSequence, withTiming,
    Easing as REasing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import type { Incident } from '../../../../src/types/chat';

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

    neonViolet: '#A855F7',
    vividRed: '#FF453A',

    // SOS avatar — tinted, not solid
    sosAvatarBg: 'rgba(255,69,58,0.15)',
    sosAvatarBorder: '#FF453A',

    cardRadius: 28,
    cardPadding: 20,
    avatarSize: 48,
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

// ─── PulseDot — Reanimated heartbeat, color-matched to incident type ───────
const PulseDot = memo(function PulseDot({ color }: { color: string }) {
    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.5, { duration: 220, easing: REasing.out(REasing.quad) }),
                withTiming(1.0, { duration: 140, easing: REasing.in(REasing.quad) }),
                withTiming(1.4, { duration: 200, easing: REasing.out(REasing.quad) }),
                withTiming(1.0, { duration: 750, easing: REasing.inOut(REasing.ease) }),
            ),
            -1,
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: 0.6 + (scale.value - 1.0) * 0.8,
    }));

    return (
        <Animated.View
            style={[st.pulseDot, { backgroundColor: color }, animStyle]}
        />
    );
});

// ─── GroupAvatar — Chromatic monochromatism ─────────────────────────────────
// SOS: Red-tinted circle + 1px red border + white icon
// Non-SOS LIVE: Violet gradient + white icon
// Resolved: Dark muted fill + muted icon
const GroupAvatar = memo(function GroupAvatar({ isLive, isEmergency }: { isLive: boolean; isEmergency: boolean }) {
    if (isEmergency && isLive) {
        // SOS — Tinted red glass, NOT solid red
        return (
            <View style={st.avatarSOS}>
                <Feather name="users" size={20} color={T.onPrimary} />
            </View>
        );
    }

    return (
        <View style={[st.avatar, isLive ? st.avatarLive : st.avatarResolved]}>
            <Feather
                name="users"
                size={20}
                color={isLive ? T.onPrimary : D.subtitle}
            />
        </View>
    );
});

// ─── IncidentModule — Substantial extruded card ─────────────────────────────
function IncidentModule({ incident, onPress }: { incident: Incident; onPress: () => void }) {
    const isLive = incident.status === 'LIVE';
    const isEmergency = isSOS(incident.type);

    // Chromatic monochromatism: SOS pulses Red, others pulse Violet
    const pulseColor = isEmergency ? D.vividRed : D.neonViolet;

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
                <Text
                    style={st.cardTitle}
                    numberOfLines={1}
                >
                    {incident.type}
                </Text>
                <View style={st.cardMetaRow}>
                    {isLive ? (
                        <PulseDot color={pulseColor} />
                    ) : (
                        <View style={st.resolvedDot} />
                    )}
                    <Text style={st.cardMeta} numberOfLines={1}>
                        <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' }}>{caseId(incident.id)}</Text>  ·  {incident.latestMessage?.sender.name ?? 'Unknown'}
                    </Text>
                </View>
            </View>

            {/* RIGHT — Timestamp + badge */}
            <View style={st.cardRight}>
                <Text style={st.cardTime}>
                    {timeAgo(incident.createdAt)}
                </Text>
                {isLive && incident.participantCount > 0 && (
                    <View style={[
                        st.badge,
                        isEmergency && { backgroundColor: D.vividRed },
                    ]}>
                        <Text style={st.badgeText}>{incident.participantCount}</Text>
                    </View>
                )}
                {!isLive && (
                    <Feather name="chevron-right" size={16} color={D.timestamp} />
                )}
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
                    <TouchableOpacity
                        style={st.filterBlock}
                        activeOpacity={0.7}
                        onPress={() => Haptics.selectionAsync()}
                    >
                        <Feather name="sliders" size={16} color={D.subtitle} />
                    </TouchableOpacity>
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
        gap: S.s3,
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
    filterBlock: {
        width: 50,
        height: 50,
        borderRadius: D.cardRadius,  // 28 — matches cards
        backgroundColor: D.cardFill,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
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
        borderRadius: D.cardRadius,
        padding: D.cardPadding,
        gap: S.s4,
        backgroundColor: T.surfaceBulky,
        borderColor: T.lineMid,
    },
    cardLive: {
        backgroundColor: D.cardFillActive,
        borderColor: T.lineMid,
        ...Platform.select({
            ios: {
                shadowColor: D.neonViolet,
                shadowOpacity: 0.10,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: 4 },
        }),
    },
    cardSOS: {
        borderColor: D.hairline,  // Same crisp glass edge as all cards
        ...Platform.select({
            ios: {
                shadowColor: D.vividRed,
                shadowOpacity: 0.12,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 4 },
        }),
    },
    cardResolved: {
        backgroundColor: T.surfaceBulky, // Updated
        borderColor: T.lineMid, // Updated
        opacity: 0.70,  // Interactive, not disabled — lower priority but clearly tappable
    },

    // ── Avatars ──────────────────────────────────────────────────────────
    // SOS — Red-tinted glass with 1px red border (Chromatic Monochromatism)
    avatarSOS: {
        width: D.avatarSize,
        height: D.avatarSize,
        borderRadius: D.avatarSize / 2,
        backgroundColor: D.sosAvatarBg,
        borderWidth: 1,
        borderColor: D.sosAvatarBorder,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    // Non-SOS LIVE — solid violet fill
    avatar: {
        width: D.avatarSize,
        height: D.avatarSize,
        borderRadius: D.avatarSize / 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    avatarLive: {
        backgroundColor: D.neonViolet,
    },
    avatarResolved: {
        backgroundColor: '#2A2145',
    },

    // ── Center column ───────────────────────────────────────────────────
    cardCenter: { flex: 1, minWidth: 0, gap: S.s1 },
    cardTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: D.title,
        letterSpacing: 0.1,
    },
    cardMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s2,
    },
    cardMeta: {
        flex: 1,
        fontSize: 12,
        fontWeight: '400',
        color: D.subtitle,
        lineHeight: 16,
    },

    // ── Dots ─────────────────────────────────────────────────────────────
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
    },
    resolvedDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: D.timestamp,
        flexShrink: 0,
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
    badge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: D.neonViolet,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: S.s2,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: T.onPrimary,
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
