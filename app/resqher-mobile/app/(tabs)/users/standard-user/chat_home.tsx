import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { incidentService } from '../../../../src/services/incidentService';

const D = {
    cardFill: T.surfaceBulky,
    hairline: 'rgba(255, 255, 255, 0.1)',
    title: '#FFFFFF',
    subtitle: '#C4C1D4',
    timestamp: '#A09CB2',
    neonViolet: T.violet,
    avatarSize: 44,
} as const;

type ChatIncidentStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

type UserChatIncident = {
    id: number | string;
    incidentCode?: string;
    status: ChatIncidentStatus;
    priority?: 'HIGH' | 'NORMAL';
    createdAt: string;
    updatedAt?: string;
    lastMessage?: {
        id: string;
        senderId: string;
        senderName: string;
        senderRole: 'standard_user' | 'volunteer' | 'system' | string;
        text: string;
        createdAt: string;
    } | null;
    sosUser?: {
        id: string;
        name: string;
        photoUri?: string | null;
    };
    responders?: {
        id: string;
        name: string;
        photoUri?: string | null;
        role?: string;
        acceptedAt?: string | null;
    }[];
    responderCount?: number;
    maxResponders?: number;
};

function normalizeStatus(status: string): ChatIncidentStatus {
    const upper = String(status || 'ACTIVE').toUpperCase();
    if (upper === 'IN_PROGRESS' || upper === 'LIVE') return 'ACTIVE';
    if (upper === 'RESOLVED') return 'RESOLVED';
    if (upper === 'CANCELLED' || upper === 'CANCELED') return 'CANCELLED';
    return 'ACTIVE';
}

function incidentActivityTime(incident: UserChatIncident): number {
    const timestamp = incident.lastMessage?.createdAt ?? incident.updatedAt ?? incident.createdAt;
    const time = new Date(timestamp).getTime();
    return Number.isFinite(time) ? time : 0;
}

function compareIncidents(a: UserChatIncident, b: UserChatIncident): number {
    const aLive = normalizeStatus(a.status) === 'ACTIVE';
    const bLive = normalizeStatus(b.status) === 'ACTIVE';
    if (aLive !== bLive) return aLive ? -1 : 1;
    return incidentActivityTime(b) - incidentActivityTime(a);
}

function incidentNumber(id: number | string): string {
    return String(id).replace(/\D/g, '').padStart(3, '0');
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

function StatusPill({ status }: { status: ChatIncidentStatus }) {
    const normalized = normalizeStatus(status);
    const isLive = normalized === 'ACTIVE';
    const isCancelled = normalized === 'CANCELLED';
    return (
        <View style={[
            st.statusPill,
            isLive ? st.statusPillActive : isCancelled ? st.statusPillCancelled : st.statusPillResolved,
        ]}>
            <Text style={[
                st.statusPillText,
                isLive ? st.statusTextActive : isCancelled ? st.statusTextCancelled : st.statusTextResolved,
            ]}>
                {normalized}
            </Text>
        </View>
    );
}

const ChatAvatar = memo(function ChatAvatar({
    isLive,
    uri,
}: {
    isLive: boolean;
    uri?: string | null;
}) {
    return (
        <View style={[st.avatar, isLive ? st.avatarLive : st.avatarResolved]}>
            {uri ? (
                <Image source={{ uri }} style={st.avatarImage} />
            ) : (
                <Feather
                    name="alert-circle"
                    size={18}
                    color={isLive ? T.violet : D.subtitle}
                />
            )}
            {isLive && <View style={st.activeDot} />}
        </View>
    );
});

const IncidentCard = memo(function IncidentCard({
    incident,
    onPress,
}: {
    incident: UserChatIncident;
    onPress: () => void;
}) {
    const status = normalizeStatus(incident.status);
    const isLive = status === 'ACTIVE';
    const activityAt = incident.lastMessage?.createdAt ?? incident.updatedAt ?? incident.createdAt;
    const lastSender = incident.lastMessage?.senderName ?? 'System';
    const lastText = incident.lastMessage?.text ?? 'No messages yet';
    const responderCount = incident.responderCount ?? incident.responders?.length ?? 0;
    const maxResponders = incident.maxResponders ?? 3;

    return (
        <TouchableOpacity
            style={[st.card, isLive && st.cardActive]}
            onPress={onPress}
            activeOpacity={0.75}
        >
            <ChatAvatar isLive={isLive} uri={incident.sosUser?.photoUri} />

            <View style={st.cardCenter}>
                <Text style={st.cardTitle} numberOfLines={1}>
                    {incident.incidentCode ?? `Incident #${incidentNumber(incident.id)}`}
                </Text>
                <Text style={st.cardMeta} numberOfLines={1}>
                    {incident.lastMessage ? (
                        <>
                            <Text style={st.cardMetaName}>{lastSender}</Text>
                            {': '}
                            {lastText}
                        </>
                    ) : (
                        'No messages yet'
                    )}
                </Text>
                <View style={st.responderMiniRow}>
                    <Feather name="users" size={12} color={isLive ? T.violet : D.timestamp} />
                    <Text style={st.responderMiniText}>{responderCount}/{maxResponders} responders</Text>
                </View>
            </View>

            <View style={st.cardRight}>
                <Text style={st.cardTime}>{timeAgo(activityAt)}</Text>
                <StatusPill status={status} />
            </View>
        </TouchableOpacity>
    );
});

function EmptyState({ isSearching }: { isSearching: boolean }) {
    return (
        <View style={st.empty}>
            <View style={st.emptyCircle}>
                <Feather name={isSearching ? 'search' : 'message-circle'} size={28} color={D.timestamp} />
            </View>
            <Text style={st.emptyTitle}>{isSearching ? 'No matches' : 'No SOS chats yet'}</Text>
            <Text style={st.emptySub}>
                {isSearching
                    ? 'Try an incident number like 128, #128, or Incident #128.'
                    : 'Your SOS chat history will appear here after you trigger an alert.'}
            </Text>
        </View>
    );
}

export default function ChatHome() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [incidents, setIncidents] = useState<UserChatIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const searchPulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(searchQuery), 320);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    useEffect(() => {
        Animated.timing(searchPulse, {
            toValue: searchQuery ? 1 : 0,
            duration: 180,
            useNativeDriver: false,
        }).start();
    }, [searchPulse, searchQuery]);

    const loadChats = useCallback(async () => {
        setError(null);
        const rows = await incidentService.getUserIncidentChats(debouncedSearch);
        setIncidents((rows ?? []).map((row: any) => ({
            ...row,
            id: row.id,
            status: normalizeStatus(row.status),
            responderCount: Number(row.responderCount ?? row.responders?.length ?? 0),
            maxResponders: Number(row.maxResponders ?? 3),
        })).sort(compareIncidents));
    }, [debouncedSearch]);

    useFocusEffect(useCallback(() => {
        let active = true;
        setLoading(true);
        loadChats()
            .catch((err) => {
                if (!active) return;
                setError(err?.message || 'Unable to load chats.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [loadChats]));

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadChats();
        } catch (err: any) {
            setError(err?.message || 'Unable to refresh chats.');
        } finally {
            setRefreshing(false);
        }
    }, [loadChats]);

    const sorted = useMemo(() => [...incidents].sort(compareIncidents), [incidents]);

    const openChat = useCallback((incident: UserChatIncident) => {
        Haptics.selectionAsync();
        router.push({
            pathname: '/(tabs)/users/standard-user/chat_room',
            params: { incidentId: String(incident.id) },
        } as any);
    }, [router]);

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
                        {incidents.length > 0 && (
                            <Text style={st.headerCount}>{incidents.length} SOS chat{incidents.length === 1 ? '' : 's'}</Text>
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

                <View style={st.searchArea}>
                    <Animated.View style={[
                        st.searchBlock,
                        {
                            borderColor: searchPulse.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['rgba(255,255,255,0.1)', `${T.violet}66`],
                            }),
                        },
                    ]}>
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
                    </Animated.View>
                </View>

                {error && (
                    <TouchableOpacity style={st.errorCard} onPress={onRefresh} activeOpacity={0.8}>
                        <Feather name="refresh-cw" size={16} color={T.danger} />
                        <Text style={st.errorText}>{error} Tap to retry.</Text>
                    </TouchableOpacity>
                )}

                <FlatList
                    style={{ marginHorizontal: 20 }}
                    data={sorted}
                    renderItem={({ item }) => (
                        <IncidentCard incident={item} onPress={() => openChat(item)} />
                    )}
                    keyExtractor={(item) => String(item.id)}
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
                                <Text style={st.loadingText}>Loading chats...</Text>
                            </View>
                        ) : (
                            <EmptyState isSearching={!!searchQuery.trim()} />
                        )
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
        letterSpacing: 0,
    },
    headerCount: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '600',
        color: D.timestamp,
    },
    searchArea: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        paddingVertical: S.s4,
    },
    searchBlock: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: D.cardFill,
        borderWidth: 1,
        borderRadius: 24,
        paddingHorizontal: 18,
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
    cardActive: {
        borderLeftWidth: 4,
        borderLeftColor: T.violet,
    },
    avatar: {
        width: D.avatarSize,
        height: D.avatarSize,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderWidth: 1,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarLive: {
        backgroundColor: T.violetDim,
        borderColor: T.violet,
    },
    avatarResolved: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    activeDot: {
        position: 'absolute',
        top: 5,
        right: 5,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: T.danger,
        borderWidth: 1,
        borderColor: '#120B22',
    },
    cardCenter: {
        flex: 1,
        minWidth: 0,
        gap: S.s1,
        alignSelf: 'center',
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: D.title,
        letterSpacing: 0,
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
        minWidth: 78,
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
        lineHeight: 20,
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
