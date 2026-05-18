import React, { useState, useCallback, memo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    StatusBar, RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { incidentHistory, type IncidentRecord } from '../../../../src/services/incidentHistory';
import { incidentService } from '../../../../src/services/incidentService';
import { Modal, Pressable, Alert } from 'react-native';

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
    title: '#FFFFFF',
    subtitle: '#C4C1D4',
    timestamp: '#A09CB2',
    neonViolet: T.violet,
    cardRadius: 20,
    avatarSize: 44,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function formatNum(n: number): string {
    return `#${String(n).padStart(3, '0')}`;
}

// ── Status config ─────────────────────────────────────────────────────────────
type StatusCfg = { label: string; pillBg: string; pillBorder: string; textColor: string; borderLeft: string };

function statusCfg(status: IncidentRecord['status']): StatusCfg {
    // Normalize to uppercase to handle both 'Active' and 'ACTIVE' from different API shapes
    const s = String(status).toUpperCase() as IncidentRecord['status'];
    switch (s) {
        case 'ACTIVE':
            return {
                label: 'ACTIVE',
                pillBg: T.violetDim,
                pillBorder: `${T.violet}55`,
                textColor: T.violet,
                borderLeft: T.violet,
            };
        case 'RESOLVED':
            return {
                label: 'RESOLVED',
                pillBg: 'rgba(52,199,89,0.12)',
                pillBorder: 'rgba(52,199,89,0.35)',
                textColor: '#34C759',
                borderLeft: '#34C759',
            };
        case 'CANCELLED':
        default:
            return {
                label: 'CANCELLED',
                pillBg: 'rgba(255, 69, 58, 0.12)',
                pillBorder: 'rgba(255, 69, 58, 0.35)',
                textColor: T.danger,
                borderLeft: T.danger,
            };
    }
}

// ── IncidentCard ──────────────────────────────────────────────────────────────
const IncidentCard = memo(function IncidentCard({
    record,
    onPress,
}: {
    record: IncidentRecord;
    onPress: () => void;
}) {
    const cfg = statusCfg(record.status);
    const isActive = String(record.status).toUpperCase() === 'ACTIVE';
    const isCancelled = String(record.status).toUpperCase() === 'CANCELLED';
    const resolvedTime = record.resolvedAt ? timeAgo(record.resolvedAt) : null;

    return (
        <TouchableOpacity
            style={[st.card, { borderLeftColor: cfg.borderLeft }]}
            onPress={onPress}
            activeOpacity={0.75}
        >
            {/* Avatar */}
            <View style={[st.avatar, isActive ? st.avatarActive : isCancelled ? st.avatarCancelled : st.avatarInactive]}>
                <Feather name="alert-circle" size={18} color={isActive ? T.violet : isCancelled ? T.danger : D.subtitle} />
                {isActive && <View style={st.activeDot} />}
            </View>

            {/* Center */}
            <View style={st.cardCenter}>
                <Text style={st.cardTitle}>Incident {formatNum(record.displayNumber)}</Text>
                <Text style={st.cardMeta} numberOfLines={1}>
                    {record.address || 'SOS Alert triggered'}
                </Text>
                {resolvedTime && (
                    <Text style={st.cardResolvedTime}>
                        {record.status === 'RESOLVED' ? 'Resolved' : 'Closed'} · {resolvedTime}
                    </Text>
                )}
            </View>

            {/* Right */}
            <View style={st.cardRight}>
                <Text style={st.cardTime}>{timeAgo(record.createdAt)}</Text>
                <View style={[st.statusPill, { backgroundColor: cfg.pillBg, borderColor: cfg.pillBorder }]}>
                    <Text style={[st.statusText, { color: cfg.textColor }]}>{cfg.label}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ChatHome() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [records, setRecords] = useState<IncidentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadHistory = useCallback(async () => {
        // Local history (SOS sessions created on this device)
        const local = await incidentHistory.getAll();
        const deletedIds = new Set(await incidentHistory.getDeletedIds());

        // Backend incidents for this user
        let remote: IncidentRecord[] = [];
        try {
            const apiRecords = await incidentService.getMyIncidents();
            remote = apiRecords
                .filter(r => !deletedIds.has(String(r.id)))
                .map((r) => ({
                    incidentId: String(r.id),
                    displayNumber: Number(r.id),
                    lat: r.latitude ?? null,
                    lng: r.longitude ?? null,
                    address: r.address ?? '',
                    createdAt: r.created_at ?? new Date().toISOString(),
                    // Normalize status to uppercase ('Active' → 'ACTIVE') for UI consistency
                    status: (String(r.status).toUpperCase() as IncidentRecord['status']),
                }));
        } catch {
            // offline or unauthenticated — show local only
        }

        // Merge: local records override remote ones with the same incidentId
        const map = new Map<string, IncidentRecord>();
        for (const r of remote) map.set(r.incidentId, r);
        for (const r of local) map.set(r.incidentId, r); // local wins (has real-time status)

        const all = Array.from(map.values());
        all.sort((a, b) => {
            if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
            if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setRecords(all);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    }, [loadHistory]);

    const filtered = searchQuery.trim()
        ? records.filter(r =>
            r.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
            formatNum(r.displayNumber).includes(searchQuery)
        )
        : records;

    const openChat = useCallback((record: IncidentRecord) => {
        Haptics.selectionAsync();
        const params: Record<string, string> = { incidentId: record.incidentId };
        if (record.status === 'ACTIVE') {
            params.autoMessage = 'true';
            if (record.lat != null) {
                params.userLat = String(record.lat);
                params.userLng = String(record.lng ?? 0);
            }
            params.userAddress = record.address;
        }
        router.push({ pathname: '/(tabs)/users/standard-user/chat_room', params } as any);
    }, [router]);

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* Header */}
                <View style={st.header}>
                    <TouchableOpacity
                        onPress={() => { Haptics.selectionAsync(); router.back(); }}
                        style={st.headerBtn}
                        activeOpacity={0.7}
                    >
                        <Feather name="chevron-left" size={22} color={D.title} />
                    </TouchableOpacity>
                    <View style={st.headerTitleArea}>
                        <Text style={st.headerTitle}>Chat Room</Text>
                        {records.length > 0 && (
                            <Text style={st.headerCount}>{records.length} incident{records.length !== 1 ? 's' : ''}</Text>
                        )}
                    </View>
                    <TouchableOpacity
                        style={st.headerBtn}
                        activeOpacity={0.7}
                        onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/users/standard-user/notifications'); }}
                    >
                        <Feather name="bell" size={18} color={D.subtitle} />
                    </TouchableOpacity>
                </View>

                {/* Search */}
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
                            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                                <Feather name="x" size={16} color={D.subtitle} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* List */}
                {loading ? (
                    <View style={st.loadingWrap}>
                        <ActivityIndicator color={T.violet} />
                    </View>
                ) : (
                    <FlatList
                        style={{ marginHorizontal: 16 }}
                        data={filtered}
                        renderItem={({ item }) => (
                            <IncidentCard record={item} onPress={() => openChat(item)} />
                        )}
                        keyExtractor={item => item.incidentId}
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
                                <Text style={st.emptyTitle}>No incidents yet</Text>
                                <Text style={st.emptySub}>
                                    Your SOS chats will appear here after you trigger an alert.
                                </Text>
                            </View>
                        }
                        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                    />
                )}
            </View>
        </AtmosphericShell>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
        width: 36, height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleArea: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: D.title, letterSpacing: -0.3 },
    headerCount: { fontSize: 11, color: D.timestamp, marginTop: 1 },

    searchArea: { marginHorizontal: 16, paddingBottom: S.s4 },
    searchBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: D.cardRadius,
        paddingHorizontal: 16,
        height: 48,
        gap: S.s3,
    },
    searchInput: { flex: 1, fontSize: 15, color: D.title, paddingVertical: 0 },

    list: { paddingTop: 4, paddingBottom: S.s5 },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Card
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: R.lg,
        paddingHorizontal: S.s4,
        paddingVertical: 14,
        gap: 12,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderLeftWidth: 4,
    },
    avatar: {
        width: D.avatarSize, height: D.avatarSize,
        borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        borderWidth: 1,
    },
    avatarActive: { backgroundColor: T.violetDim, borderColor: T.violet },
    avatarInactive: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
    avatarCancelled: {
        backgroundColor: 'rgba(255,69,58,0.08)',
        borderColor: 'rgba(255,69,58,0.25)',
    },
    activeDot: {
        position: 'absolute', top: 4, right: 4,
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: '#FF453A',
        borderWidth: 1.5, borderColor: T.surface,
    },

    cardCenter: { flex: 1, minWidth: 0, gap: 3 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: D.title, letterSpacing: 0.1 },
    cardMeta: { fontSize: 12, color: D.subtitle, lineHeight: 16 },
    cardResolvedTime: { fontSize: 11, color: D.timestamp, marginTop: 1 },

    cardRight: { flexShrink: 0, alignItems: 'flex-end', gap: S.s2 },
    cardTime: { fontSize: 11, fontWeight: '500', color: D.timestamp },
    statusPill: {
        paddingHorizontal: 9, paddingVertical: 3,
        borderRadius: 999, borderWidth: 1,
    },
    statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },

    // Empty
    empty: { alignItems: 'center', paddingTop: 80, gap: S.s3 },
    emptyCircle: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: S.s2,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: D.subtitle },
    emptySub: { fontSize: 13, color: D.timestamp, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
});
