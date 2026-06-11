import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Alert,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { notificationStore, AppNotification, NotifType, seedDefaultNotifications } from '../../../../src/services/notificationStore';

// ── Icon config ───────────────────────────────────────────────────────────────
const ICON_MAP: Record<NotifType, { name: React.ComponentProps<typeof Feather>['name']; color: string }> = {
    sos_triggered: { name: 'alert-circle', color: T.danger },
    message_received: { name: 'message-circle', color: T.violet },
    volunteer_joined: { name: 'user-plus', color: T.success },
    live_video_request: { name: 'video', color: T.danger },
    live_video_declined: { name: 'video-off', color: T.ink4 },
    incident_resolved: { name: 'check-circle', color: T.success },
    incident_cancelled: { name: 'x-circle', color: T.ink4 },
    system: { name: 'bell', color: T.ink3 },
};

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const d = new Date(iso);
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
}

// ── Group by date ─────────────────────────────────────────────────────────────
type Group = { label: string; items: AppNotification[] };

function groupByDate(notifs: AppNotification[]): Group[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: Group[] = [
        { label: 'Today', items: [] },
        { label: 'Yesterday', items: [] },
        { label: 'Earlier', items: [] },
    ];

    for (const n of notifs) {
        const d = new Date(n.createdAt);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === today.getTime()) groups[0].items.push(n);
        else if (d.getTime() === yesterday.getTime()) groups[1].items.push(n);
        else groups[2].items.push(n);
    }

    return groups.filter(g => g.items.length > 0);
}

// ── Notification card ─────────────────────────────────────────────────────────
function NotifCard({
    notif,
    onDelete,
    onRead,
}: {
    notif: AppNotification;
    onDelete: (n: number) => void;
    onRead: (n: number) => void;
}) {
    const icon = ICON_MAP[notif.type] ?? { name: 'bell' as const, color: T.ink4 };
    return (
        <TouchableOpacity
            style={[s.card, !notif.read && s.cardUnread]}
            activeOpacity={0.8}
            onPress={() => { if (!notif.read) onRead(notif.n); }}
        >
            {!notif.read && <View style={s.unreadBar} />}
            <View style={[s.iconBox, { backgroundColor: `${icon.color}18` }]}>
                <Feather name={icon.name} size={17} color={icon.color} />
            </View>
            <View style={s.cardContent}>
                <Text style={s.cardTitle}>{notif.title}</Text>
                <Text style={s.cardBody} numberOfLines={2}>{notif.body}</Text>
                <Text style={s.cardTime}>{relativeTime(notif.createdAt)}</Text>
            </View>
            <TouchableOpacity
                style={s.deleteBtn}
                onPress={() => onDelete(notif.n)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Feather name="trash-2" size={14} color={T.ink4} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <View style={s.emptyWrap}>
            <View style={s.emptyRing}>
                <Feather name="bell-off" size={30} color={T.ink4} />
            </View>
            <Text style={s.emptyTitle}>No notifications yet</Text>
            <Text style={s.emptySubtitle}>Alerts and updates from your incidents will appear here.</Text>
        </View>
    );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [notifs, setNotifs] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        await seedDefaultNotifications();
        const all = await notificationStore.getAll();
        setNotifs(all);
        setLoading(false);
        setRefreshing(false);
        await notificationStore.markAllRead();
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const handleDelete = (n: number) => {
        Alert.alert('Delete Notification', 'Remove this notification?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await notificationStore.remove(n);
                    setNotifs(prev => prev.filter(x => x.n !== n));
                },
            },
        ]);
    };

    const handleRead = async (n: number) => {
        await notificationStore.markRead(n);
        setNotifs(prev => prev.map(x => x.n === n ? { ...x, read: true } : x));
    };

    const handleMarkAll = async () => {
        await notificationStore.markAllRead();
        setNotifs(prev => prev.map(x => ({ ...x, read: true })));
    };

    const hasUnread = notifs.some(n => !n.read);
    const groups = groupByDate(notifs);

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Header ── */}
                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Notifications</Text>
                    {hasUnread ? (
                        <TouchableOpacity onPress={handleMarkAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={s.markAllText}>Mark all read</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={s.headerSpacer} />
                    )}
                </View>

                {loading ? (
                    <View style={s.loadingWrap}>
                        <ActivityIndicator color={T.violet} />
                    </View>
                ) : (
                    <ScrollView
                        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => load(true)}
                                tintColor={T.violet}
                            />
                        }
                    >
                        {notifs.length === 0 ? (
                            <EmptyState />
                        ) : (
                            groups.map(group => (
                                <View key={group.label} style={s.group}>
                                    <Text style={s.groupLabel}>{group.label}</Text>
                                    {group.items.map(notif => (
                                        <NotifCard
                                            key={notif.n}
                                            notif={notif}
                                            onDelete={handleDelete}
                                            onRead={handleRead}
                                        />
                                    ))}
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>
        </AtmosphericShell>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.lineMid,
        backgroundColor: T.surfaceGlass,
    },
    headerBtn: {
        width: 36, height: 36,
        borderRadius: R.hBtn,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
        backgroundColor: T.surfaceBulky,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: T.ink,
        marginHorizontal: 10,
    },
    markAllText: {
        fontSize: 13,
        fontWeight: '600',
        color: T.violet,
    },
    headerSpacer: { width: 70 },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 14, paddingTop: 20 },

    group: { marginBottom: 24 },
    groupLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginLeft: 4,
    },

    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        padding: S.s4,
        marginBottom: 10,
        overflow: 'hidden',
    },
    cardUnread: {
        backgroundColor: 'rgba(108,92,231,0.07)',
        borderColor: 'rgba(108,92,231,0.25)',
    },
    unreadBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: T.violet,
        borderTopLeftRadius: R.lg,
        borderBottomLeftRadius: R.lg,
    },
    iconBox: {
        width: 36, height: 36,
        borderRadius: R.sm,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
        flexShrink: 0,
    },
    cardContent: { flex: 1 },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: T.ink,
        marginBottom: 3,
    },
    cardBody: {
        fontSize: 13,
        color: T.ink3,
        lineHeight: 18,
    },
    cardTime: {
        fontSize: 11,
        color: T.ink4,
        marginTop: 6,
    },
    deleteBtn: {
        marginLeft: 8,
        padding: 4,
        alignSelf: 'flex-start',
    },

    emptyWrap: {
        alignItems: 'center',
        paddingTop: 80,
        paddingHorizontal: 32,
    },
    emptyRing: {
        width: 72, height: 72,
        borderRadius: 36,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: T.lineMid,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: T.ink2,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 13,
        color: T.ink4,
        textAlign: 'center',
        lineHeight: 20,
    },
});
