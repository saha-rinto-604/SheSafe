/**
 * blocked-users.tsx — Blocked Users screen (Standard User)
 * ──────────────────────────────────────────────────────────
 * Shows a list of blocked responders with unblock action.
 * Data persisted via privacySecurity service (SecureStore for now).
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { listBlockedUsers, unblockUser, BlockedUser } from '../../../../src/services/privacySecurity';

export default function BlockedUsersScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [users, setUsers] = useState<BlockedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [unblocking, setUnblocking] = useState<string | null>(null);

    // Load blocked users on mount
    useEffect(() => {
        listBlockedUsers().then(list => {
            setUsers(list);
            setLoading(false);
        });
    }, []);

    const handleUnblock = (user: BlockedUser) => {
        Alert.alert(
            'Unblock User',
            `Allow ${user.name} to contact you and respond to your SOS again?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unblock',
                    style: 'destructive',
                    onPress: async () => {
                        setUnblocking(user.id);
                        await unblockUser(user.id);
                        setUsers(prev => prev.filter(u => u.id !== user.id));
                        setUnblocking(null);
                    },
                },
            ]
        );
    };

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
                        <Ionicons name="arrow-back" size={20} color={T.ink2} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Blocked Users</Text>
                    <View style={s.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Note */}
                    <View style={s.noteCard}>
                        <Feather name="info" size={14} color={T.ink4} style={{ marginTop: 1 }} />
                        <Text style={s.noteText}>
                            Blocked users cannot send you messages or respond to SOS alerts involving you.
                        </Text>
                    </View>

                    <View style={s.section}>
                        <Text style={s.sectionLabel}>
                            {users.length} {users.length === 1 ? 'User' : 'Users'} Blocked
                        </Text>
                        {loading ? (
                            <ActivityIndicator color={T.violet} style={{ marginTop: 32 }} />
                        ) : users.length === 0 ? (
                            <View style={s.emptyWrap}>
                                <View style={s.emptyIconRing}>
                                    <Feather name="user-check" size={28} color={T.ink4} />
                                </View>
                                <Text style={s.emptyTitle}>No blocked users</Text>
                                <Text style={s.emptySub}>Anyone you block will appear here.</Text>
                            </View>
                        ) : (
                            <View style={s.sectionCard}>
                                {users.map((user, i) => (
                                    <React.Fragment key={user.id}>
                                        <View style={s.userRow}>
                                            <View style={s.avatarCircle}>
                                                <Text style={s.avatarText}>
                                                    {user.name.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={s.userName}>{user.name}</Text>
                                            <TouchableOpacity
                                                style={s.unblockBtn}
                                                onPress={() => handleUnblock(user)}
                                                disabled={unblocking === user.id}
                                                activeOpacity={0.75}
                                            >
                                                {unblocking === user.id ? (
                                                    <ActivityIndicator size="small" color={T.danger} />
                                                ) : (
                                                    <Text style={s.unblockBtnText}>Unblock</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                        {i < users.length - 1 && <View style={s.divider} />}
                                    </React.Fragment>
                                ))}
                            </View>
                        )}
                    </View>
                </ScrollView>
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
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.lineMid,
        backgroundColor: T.surfaceCard,
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

    // Note card
    noteCard: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 24,
    },
    noteText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
        lineHeight: 18,
    },

    // Section
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

    // User row
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: S.s4,
        gap: 12,
    },
    avatarCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 15,
        fontWeight: '700',
        color: T.violet,
    },
    userName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: T.ink,
    },
    unblockBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: R.xs,
        backgroundColor: T.dangerLight,
        borderWidth: 1,
        borderColor: T.dangerBorder,
        minWidth: 72,
        alignItems: 'center',
    },
    unblockBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.danger,
    },

    // Empty state
    emptyWrap: {
        alignItems: 'center',
        paddingTop: 48,
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
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
    },
});
