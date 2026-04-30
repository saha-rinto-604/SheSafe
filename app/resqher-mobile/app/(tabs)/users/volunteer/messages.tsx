/**
 * volunteer/messages.tsx — Incident Hub (Volunteer)
 * Mirrors standard-user chat list UI for consistency.
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
import { T, R, S } from '../../../../src/constants/theme';
import { type Incident } from '../../../../src/types/chat';

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════
const D = {
    cardFill: T.surfaceBulky,
    cardFillActive: T.surfaceBulkyActive,

    hairline: 'rgba(255, 255, 255, 0.1)',
    hairlineActive: 'rgba(255, 255, 255, 0.1)',

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

// ─── Mock Data (Volunteer-facing, no police participants) ─────────────────
const MOCK_INCIDENTS: Incident[] = [
    {
        id: 'inc-204',
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
    {
        id: 'inc-198',
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
    {
        id: 'inc-175',
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

function isSOS(type: string): boolean {
    return type.toLowerCase().includes('sos');
}

const GroupAvatar = memo(function GroupAvatar({ isLive }: { isLive: boolean }) {
    return (
        <View style={[st.avatar, isLive ? st.avatarLive : st.avatarResolved]}>
            <Feather name="users" size={18} color={isLive ? T.violet : D.subtitle} />
        </View>
    );
});

function IncidentModule({ incident, onPress }: { incident: Incident; onPress: () => void }) {
    const isLive = incident.status === 'LIVE';
    const isCancelled = incident.status === 'CANCELLED';
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
            <View style={{ alignSelf: 'center' }}>
                <GroupAvatar isLive={isLive} />
            </View>

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

            <View style={st.cardRight}>
                <Text style={st.cardTime}>
                    {timeAgo(incident.createdAt)}
                </Text>
                <View style={[
                    st.statusPill,
                    isLive ? st.statusPillActive : isCancelled ? st.statusPillCancelled : st.statusPillResolved,
                ]}>
                    <Text style={isLive ? st.statusTextActive : isCancelled ? st.statusTextCancelled : st.statusTextResolved}>
                        {isLive ? 'ACTIVE' : isCancelled ? 'CANCELLED' : 'RESOLVED'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

export default function VolunteerMessages() {
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
        router.push(`/(tabs)/users/volunteer/chat_room?incidentId=${incidentId}` as any);
    };

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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

                <View style={{ marginTop: 12 }} />

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

const st = StyleSheet.create({
    root: { flex: 1 },

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

    list: {
        paddingTop: S.s1,
        paddingBottom: S.s5,
    },

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
        borderColor: 'rgba(255,255,255,0.1)',
    },

    cardCenter: { flex: 1 },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: D.title,
        letterSpacing: -0.3,
    },
    cardMeta: {
        marginTop: 4,
        fontSize: 12,
        color: D.subtitle,
        lineHeight: 16,
    },
    cardMetaName: {
        fontWeight: '700',
        color: D.title,
    },
    cardRight: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        minHeight: 44,
    },
    cardTime: {
        fontSize: 11,
        color: D.timestamp,
        fontWeight: '600',
    },
    statusPill: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusPillActive: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}55`,
    },
    statusPillResolved: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.12)',
    },
    statusPillCancelled: {
        backgroundColor: T.dangerLight,
        borderColor: T.dangerBorder,
    },
    statusTextActive: {
        fontSize: 10,
        fontWeight: '700',
        color: T.violet,
        letterSpacing: 0.8,
    },
    statusTextResolved: {
        fontSize: 10,
        fontWeight: '700',
        color: D.timestamp,
        letterSpacing: 0.8,
    },
    statusTextCancelled: {
        fontSize: 10,
        fontWeight: '700',
        color: T.danger,
        letterSpacing: 0.8,
    },

    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: S.s8,
        gap: S.s2,
    },
    emptyCircle: {
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
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: D.title,
    },
    emptySub: {
        fontSize: 12,
        color: D.subtitle,
    },
});
