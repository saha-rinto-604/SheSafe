import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AtmosphericShell from './AtmosphericShell';
import { R, S, T } from '../constants/theme';
import {
    blockUser,
    BlockedUser,
    ConnectedUser,
    listBlockedUsers,
    listConnectedUsers,
    unblockUser,
} from '../services/privacySecurity';

type ActiveTab = 'connected' | 'blocked';
type PendingAction =
    | { type: 'block'; user: ConnectedUser }
    | { type: 'unblock'; user: BlockedUser }
    | null;

function displayRole(role: string) {
    if (role === 'standard_user') return 'Standard User';
    if (role === 'volunteer') return 'Volunteer';
    return role.replace(/_/g, ' ');
}

function formatDate(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(part => part.charAt(0).toUpperCase()).join('') || 'S';
}

function Avatar({ name, uri }: { name: string; uri?: string | null }) {
    if (uri) {
        return <Image source={{ uri }} style={s.avatarImage} />;
    }
    return (
        <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{initials(name)}</Text>
        </View>
    );
}

export default function BlockedUsersManager() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ActiveTab>('connected');
    const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [pending, setPending] = useState<PendingAction>(null);
    const [submitting, setSubmitting] = useState(false);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [connected, blocked] = await Promise.all([
                listConnectedUsers(),
                listBlockedUsers(),
            ]);
            setConnectedUsers(connected);
            setBlockedUsers(blocked);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        loadUsers();
    }, [loadUsers]));

    const blockedIds = useMemo(
        () => new Set(blockedUsers.map(user => Number(user.userId))),
        [blockedUsers],
    );

    const connectedRows = useMemo(
        () => connectedUsers.map(user => ({
            ...user,
            isBlocked: user.isBlocked || blockedIds.has(Number(user.userId)),
        })),
        [blockedIds, connectedUsers],
    );

    const confirmAction = async () => {
        if (!pending) return;
        setSubmitting(true);
        try {
            if (pending.type === 'block') {
                await blockUser(pending.user.userId);
                setActiveTab('blocked');
            } else {
                await unblockUser(pending.user.userId);
            }
            setPending(null);
            await loadUsers();
        } catch {
            setError(true);
        } finally {
            setSubmitting(false);
        }
    };

    const modalTitle = pending?.type === 'block' ? 'Block this user?' : 'Unblock this user?';
    const modalMessage = pending?.type === 'block'
        ? "They won't be able to contact you through normal SheSafe chat interactions. Safety-related system updates may still appear when needed."
        : 'They may be able to contact you again through SheSafe incident interactions.';
    const modalAction = pending?.type === 'block' ? 'Block' : 'Unblock';

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Blocked Users</Text>
                    <View style={s.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={s.noteCard}>
                        <Feather name="shield" size={15} color={T.ink4} style={s.noteIcon} />
                        <Text style={s.noteText}>
                            Manage people you{'\''}ve connected with through SheSafe incidents.
                        </Text>
                    </View>

                    <View style={s.tabs}>
                        <TouchableOpacity
                            style={[s.tabBtn, activeTab === 'connected' && s.tabBtnActive]}
                            onPress={() => setActiveTab('connected')}
                            activeOpacity={0.78}
                        >
                            <Text style={[s.tabText, activeTab === 'connected' && s.tabTextActive]}>
                                Connected
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[s.tabBtn, activeTab === 'blocked' && s.tabBtnActive]}
                            onPress={() => setActiveTab('blocked')}
                            activeOpacity={0.78}
                        >
                            <Text style={[s.tabText, activeTab === 'blocked' && s.tabTextActive]}>
                                Blocked
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={s.centerState}>
                            <ActivityIndicator color={T.violet} />
                        </View>
                    ) : error ? (
                        <View style={s.emptyWrap}>
                            <View style={s.emptyIconRing}>
                                <Feather name="alert-circle" size={27} color={T.ink4} />
                            </View>
                            <Text style={s.emptyTitle}>Couldn{'\''}t load users right now.</Text>
                            <TouchableOpacity style={s.retryBtn} onPress={loadUsers} activeOpacity={0.8}>
                                <Text style={s.retryText}>Please try again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : activeTab === 'connected' ? (
                        <View style={s.section}>
                            <Text style={s.sectionLabel}>Connected Users</Text>
                            {connectedRows.length === 0 ? (
                                <View style={s.emptyWrap}>
                                    <View style={s.emptyIconRing}>
                                        <Feather name="users" size={27} color={T.ink4} />
                                    </View>
                                    <Text style={s.emptyTitle}>No connected users yet.</Text>
                                    <Text style={s.emptySub}>
                                        People you help or who help you during incidents will appear here.
                                    </Text>
                                </View>
                            ) : (
                                <View style={s.sectionCard}>
                                    {connectedRows.map((user, index) => (
                                        <React.Fragment key={user.userId}>
                                            <View style={s.userRow}>
                                                <Avatar name={user.displayName} uri={user.avatarUrl} />
                                                <View style={s.userContent}>
                                                    <Text style={s.userName} numberOfLines={1}>{user.displayName}</Text>
                                                    <Text style={s.userMeta} numberOfLines={1}>
                                                        {displayRole(user.role)} - {user.connectionLabel}
                                                    </Text>
                                                    <Text style={s.userSub} numberOfLines={1}>
                                                        {[user.lastIncidentCode, formatDate(user.lastConnectedAt)].filter(Boolean).join(' - ')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={[s.actionBtn, user.isBlocked && s.disabledBtn]}
                                                    onPress={() => setPending({ type: 'block', user })}
                                                    disabled={user.isBlocked}
                                                    activeOpacity={0.75}
                                                >
                                                    <Text style={[s.actionText, user.isBlocked && s.disabledText]}>
                                                        {user.isBlocked ? 'Blocked' : 'Block'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                            {index < connectedRows.length - 1 && <View style={s.divider} />}
                                        </React.Fragment>
                                    ))}
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={s.section}>
                            <Text style={s.sectionLabel}>Currently Blocked</Text>
                            {blockedUsers.length === 0 ? (
                                <View style={s.emptyWrap}>
                                    <View style={s.emptyIconRing}>
                                        <Feather name="user-check" size={27} color={T.ink4} />
                                    </View>
                                    <Text style={s.emptyTitle}>You haven{'\''}t blocked anyone.</Text>
                                </View>
                            ) : (
                                <View style={s.sectionCard}>
                                    {blockedUsers.map((user, index) => (
                                        <React.Fragment key={user.userId}>
                                            <View style={s.userRow}>
                                                <Avatar name={user.displayName} uri={user.avatarUrl} />
                                                <View style={s.userContent}>
                                                    <Text style={s.userName} numberOfLines={1}>{user.displayName}</Text>
                                                    <Text style={s.userMeta} numberOfLines={1}>
                                                        {displayRole(user.role)}
                                                    </Text>
                                                    <Text style={s.userSub} numberOfLines={1}>
                                                        {formatDate(user.blockedAt) ? `Blocked ${formatDate(user.blockedAt)}` : 'Blocked'}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={s.unblockBtn}
                                                    onPress={() => setPending({ type: 'unblock', user })}
                                                    activeOpacity={0.75}
                                                >
                                                    <Text style={s.unblockText}>Unblock</Text>
                                                </TouchableOpacity>
                                            </View>
                                            {index < blockedUsers.length - 1 && <View style={s.divider} />}
                                        </React.Fragment>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>

                <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => setPending(null)}>
                    <View style={s.modalBackdrop}>
                        <View style={s.modalCard}>
                            <View style={s.modalIcon}>
                                <Feather name={pending?.type === 'block' ? 'user-x' : 'user-check'} size={21} color={T.violet} />
                            </View>
                            <Text style={s.modalTitle}>{modalTitle}</Text>
                            <Text style={s.modalText}>{modalMessage}</Text>
                            <View style={s.modalActions}>
                                <TouchableOpacity
                                    style={[s.modalBtn, s.cancelBtn]}
                                    onPress={() => setPending(null)}
                                    disabled={submitting}
                                    activeOpacity={0.8}
                                >
                                    <Text style={s.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[s.modalBtn, s.confirmBtn]}
                                    onPress={confirmAction}
                                    disabled={submitting}
                                    activeOpacity={0.8}
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color={T.danger} />
                                    ) : (
                                        <Text style={s.confirmText}>{modalAction}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </AtmosphericShell>
    );
}

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
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        alignItems: 'center',
        justifyContent: 'center',
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
    headerSpacer: { width: 36, height: 36 },
    scroll: { paddingHorizontal: 14, paddingTop: 20 },
    noteCard: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
    },
    noteIcon: { marginTop: 1 },
    noteText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
        lineHeight: 18,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: T.surfaceBulky,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: T.lineMid,
        padding: 4,
        marginBottom: 22,
    },
    tabBtn: {
        flex: 1,
        minHeight: 36,
        borderRadius: R.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBtnActive: {
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}35`,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink4,
    },
    tabTextActive: { color: T.ink },
    centerState: {
        minHeight: 180,
        alignItems: 'center',
        justifyContent: 'center',
    },
    section: { marginBottom: 24 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginLeft: 4,
    },
    sectionCard: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        overflow: 'hidden',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
        marginHorizontal: S.s4,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: S.s4,
        gap: 12,
    },
    avatarCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: T.surfaceCard,
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '800',
        color: T.violet,
    },
    userContent: { flex: 1, minWidth: 0 },
    userName: {
        fontSize: 14,
        fontWeight: '700',
        color: T.ink,
    },
    userMeta: {
        fontSize: 12,
        fontWeight: '500',
        color: T.ink4,
        marginTop: 3,
    },
    userSub: {
        fontSize: 11,
        fontWeight: '500',
        color: T.ink3,
        marginTop: 3,
    },
    actionBtn: {
        minWidth: 70,
        minHeight: 32,
        paddingHorizontal: 12,
        borderRadius: R.xs,
        backgroundColor: T.dangerLight,
        borderWidth: 1,
        borderColor: T.dangerBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        fontSize: 12,
        fontWeight: '800',
        color: T.danger,
    },
    disabledBtn: {
        backgroundColor: T.surfaceCard,
        borderColor: T.lineMid,
    },
    disabledText: { color: T.ink4 },
    unblockBtn: {
        minWidth: 78,
        minHeight: 32,
        paddingHorizontal: 12,
        borderRadius: R.xs,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}35`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unblockText: {
        fontSize: 12,
        fontWeight: '800',
        color: T.ink,
    },
    emptyWrap: {
        alignItems: 'center',
        paddingTop: 42,
        paddingHorizontal: 18,
    },
    emptyIconRing: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: T.surfaceCard,
        borderWidth: 1,
        borderColor: T.lineMid,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: T.ink2,
        textAlign: 'center',
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
        textAlign: 'center',
        lineHeight: 18,
    },
    retryBtn: {
        minHeight: 34,
        paddingHorizontal: 14,
        borderRadius: R.xs,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}35`,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    retryText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(6, 4, 16, 0.74)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 22,
    },
    modalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        padding: 18,
    },
    modalIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: T.violetDim,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: T.ink,
        marginBottom: 8,
    },
    modalText: {
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
        lineHeight: 19,
        marginBottom: 18,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
    },
    modalBtn: {
        flex: 1,
        minHeight: 42,
        borderRadius: R.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    cancelBtn: {
        backgroundColor: T.surfaceCard,
        borderColor: T.lineMid,
    },
    confirmBtn: {
        backgroundColor: T.dangerLight,
        borderColor: T.dangerBorder,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '800',
        color: T.ink,
    },
    confirmText: {
        fontSize: 14,
        fontWeight: '800',
        color: T.danger,
    },
});
