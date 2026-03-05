/**
 * ChatHome — Incident Feed
 * Premium Tactical dark OLED list of active/past incidents.
 * Each card shows type, LIVE/RESOLVED status, and latest message.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    Platform, StatusBar, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import { chatService } from '../../../../src/services/chatService';
import type { Incident } from '../../../../src/types/chat';

// ─── Helpers ────────────────────────────────────────────────────────────────
const INCIDENT_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
    'SOS Alert': 'alert-triangle',
    'Medical Emergency': 'activity',
    'Harassment Report': 'shield',
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Incident Card ──────────────────────────────────────────────────────────
function IncidentCard({ incident, onPress }: { incident: Incident; onPress: () => void }) {
    const isLive = incident.status === 'LIVE';
    const icon = INCIDENT_ICONS[incident.type] ?? 'alert-circle';

    return (
        <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.75}>
            {/* Icon */}
            <View style={[st.iconBox, isLive && st.iconBoxLive]}>
                <Feather name={icon} size={18} color={isLive ? T.danger : T.ink3} />
            </View>

            {/* Content */}
            <View style={st.cardContent}>
                <View style={st.cardTopRow}>
                    <Text style={st.cardTitle} numberOfLines={1}>{incident.type}</Text>
                    <Text style={st.cardTime}>{timeAgo(incident.createdAt)}</Text>
                </View>

                {/* Status badge */}
                <View style={st.statusRow}>
                    <View style={[st.statusBadge, isLive ? st.statusLive : st.statusResolved]}>
                        {isLive && <View style={st.liveDot} />}
                        <Text style={[st.statusText, isLive ? st.statusTextLive : st.statusTextResolved]}>
                            {incident.status}
                        </Text>
                    </View>
                    <Text style={st.participantCount}>
                        <Feather name="users" size={10} color={T.ink4} /> {incident.participantCount}
                    </Text>
                </View>

                {/* Latest message preview */}
                {incident.latestMessage && (
                    <Text style={st.preview} numberOfLines={1}>
                        <Text style={st.previewSender}>{incident.latestMessage.sender.name}: </Text>
                        {incident.latestMessage.content}
                    </Text>
                )}
            </View>

            {/* Chevron */}
            <Feather name="chevron-right" size={16} color={T.ink4} />
        </TouchableOpacity>
    );
}

// ─── Chat Home Screen ───────────────────────────────────────────────────────
export default function ChatHome() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchIncidents = useCallback(async () => {
        const data = await chatService.getIncidents();
        setIncidents(data);
        setLoading(false);
    }, []);

    useEffect(() => { fetchIncidents(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchIncidents();
        setRefreshing(false);
    };

    const openChat = (incidentId: string) => {
        router.push(`/(tabs)/users/standard-user/chat_room?incidentId=${incidentId}` as any);
    };

    const renderItem = ({ item }: { item: Incident }) => (
        <IncidentCard incident={item} onPress={() => openChat(item.id)} />
    );

    return (
        <View style={[st.root, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Header */}
            <View style={st.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={st.backBtn}
                >
                    <Feather name="chevron-left" size={22} color={T.ink} />
                </TouchableOpacity>
                <Text style={st.headerTitle}>Incidents</Text>
                <View style={st.headerRight}>
                    <TouchableOpacity style={st.headerIcon}>
                        <Feather name="bell" size={18} color={T.ink2} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Incident list */}
            <FlatList
                data={incidents}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={st.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={T.violet}
                        colors={[T.violet]}
                    />
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={st.empty}>
                            <Feather name="message-circle" size={48} color={T.ink4} />
                            <Text style={st.emptyTitle}>No Incidents</Text>
                            <Text style={st.emptySubtitle}>Active incidents will appear here</Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: T.bg,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: S.s4,
        paddingVertical: S.s3,
        borderBottomWidth: 1,
        borderBottomColor: T.lineMid,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: T.surfaceCard,
        borderWidth: 1, borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
        marginRight: S.s3,
    },
    headerTitle: {
        ...Ty.h3,
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row', gap: S.s2,
    },
    headerIcon: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: T.surfaceCard,
        borderWidth: 1, borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
    },

    // List
    list: {
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s7,
    },

    // Card
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surfaceCard,
        borderRadius: R.md,
        padding: S.s4,
        marginBottom: S.s3,
        borderWidth: 1,
        borderColor: T.lineMid,
    },
    iconBox: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: T.surfaceMid,
        alignItems: 'center', justifyContent: 'center',
        marginRight: S.s3,
        flexShrink: 0,
    },
    iconBoxLive: {
        backgroundColor: T.dangerLight,
        borderWidth: 1,
        borderColor: T.dangerBorder,
    },
    cardContent: {
        flex: 1,
        minWidth: 0,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 14, fontWeight: '700', color: T.ink,
        flex: 1, marginRight: S.s2,
    },
    cardTime: {
        fontSize: 11, color: T.ink4, fontWeight: '500',
    },

    // Status
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s2,
        marginBottom: 6,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: R.full,
    },
    statusLive: {
        backgroundColor: T.dangerBg,
        borderWidth: 1,
        borderColor: T.dangerBorder,
    },
    statusResolved: {
        backgroundColor: T.safeLight,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.20)',
    },
    liveDot: {
        width: 5, height: 5, borderRadius: 2.5,
        backgroundColor: T.danger,
    },
    statusText: {
        fontSize: 9, fontWeight: '800', letterSpacing: 1,
        textTransform: 'uppercase',
    },
    statusTextLive: { color: T.dangerText },
    statusTextResolved: { color: T.success },
    participantCount: {
        fontSize: 11, color: T.ink4, fontWeight: '500',
    },

    // Preview
    preview: {
        fontSize: 12, color: T.ink4, lineHeight: 16,
    },
    previewSender: {
        fontWeight: '700', color: T.ink3,
    },

    // Empty state
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: S.s2,
    },
    emptyTitle: {
        ...Ty.h3,
        color: T.ink3,
        marginTop: S.s3,
    },
    emptySubtitle: {
        ...Ty.bodySm,
        color: T.ink4,
    },
});
