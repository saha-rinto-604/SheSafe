/**
 * privacy-security.tsx — Privacy & Security hub screen (Standard User)
 * ─────────────────────────────────────────────────────────────────────
 * Entry point for Account Security and Privacy sub-screens.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import api from '../../../../src/services/api';

// ── Nav item definition ───────────────────────────────────────────────────────
type NavRoute =
    | 'change-password'
    | 'two-factor-auth'
    | 'blocked-users';

type NavItem = {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    route: NavRoute;
    description: string;
};

const ACCOUNT_ITEMS: NavItem[] = [
    {
        icon: 'lock',
        label: 'Change Password',
        route: 'change-password',
        description: 'Update your account password',
    },
    {
        icon: 'shield',
        label: 'Two-Factor Authentication',
        route: 'two-factor-auth',
        description: 'Add extra login security (OTP)',
    },
];

const PRIVACY_ITEMS: NavItem[] = [
    {
        icon: 'user-x',
        label: 'Blocked Users',
        route: 'blocked-users',
        description: 'Manage blocked responders',
    },
];

// ── Reusable section ──────────────────────────────────────────────────────────
function Section({
    title,
    items,
}: {
    title: string;
    items: NavItem[];
}) {
    const router = useRouter();
    return (
        <View style={s.section}>
            <Text style={s.sectionLabel}>{title}</Text>
            <View style={s.sectionCard}>
                {items.map((item, i) => (
                    <React.Fragment key={item.route}>
                        <TouchableOpacity
                            style={s.row}
                            onPress={() =>
                                router.push(
                                    `/(tabs)/users/standard-user/${item.route}` as Parameters<typeof router.push>[0],
                                )
                            }
                            activeOpacity={0.75}
                        >
                            <View style={s.iconBox}>
                                <Feather name={item.icon} size={17} color={T.violet} />
                            </View>
                            <View style={s.rowContent}>
                                <Text style={s.rowLabel}>{item.label}</Text>
                                <Text style={s.rowDesc}>{item.description}</Text>
                            </View>
                            <Feather name="chevron-right" size={15} color={T.ink4} />
                        </TouchableOpacity>
                        {i < items.length - 1 && <View style={s.divider} />}
                    </React.Fragment>
                ))}
            </View>
        </View>
    );
}

// ── Danger action button ──────────────────────────────────────────────────────
function DangerAction({
    icon, label, description, onPress, loading,
}: {
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
    description: string;
    onPress: () => void;
    loading?: boolean;
}) {
    return (
        <TouchableOpacity style={s.dangerRow} onPress={onPress} activeOpacity={0.75} disabled={loading}>
            <View style={s.dangerIconBox}>
                {loading
                    ? <ActivityIndicator size="small" color={T.danger} />
                    : <Feather name={icon} size={17} color={T.danger} />
                }
            </View>
            <View style={s.rowContent}>
                <Text style={s.dangerLabel}>{label}</Text>
                <Text style={s.rowDesc}>{description}</Text>
            </View>
            <Feather name="chevron-right" size={15} color={T.ink4} />
        </TouchableOpacity>
    );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PrivacySecurityScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [deletingSafePlaces, setDeletingSafePlaces] = useState(false);
    const [deletingHistory, setDeletingHistory] = useState(false);

    const handleDeleteSafePlaces = () => {
        Alert.alert(
            'Delete Safe Place Reports',
            'This will permanently remove all safe place reports you submitted. Green zone markers from your reports will be removed from the map.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        setDeletingSafePlaces(true);
                        try {
                            await api.delete('/api/safe-places/my');
                            Alert.alert('Done', 'Your safe place reports have been deleted.');
                        } catch {
                            Alert.alert('Error', 'Failed to delete. Please try again.');
                        } finally {
                            setDeletingSafePlaces(false);
                        }
                    },
                },
            ]
        );
    };

    const handleClearSosHistory = () => {
        Alert.alert(
            'Clear SOS History',
            'This will cancel all your active incidents and clear your SOS history from the map.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear', style: 'destructive', onPress: async () => {
                        setDeletingHistory(true);
                        try {
                            await api.delete('/api/incidents/my');
                            Alert.alert('Done', 'Your SOS history has been cleared.');
                        } catch {
                            Alert.alert('Error', 'Failed to clear. Please try again.');
                        } finally {
                            setDeletingHistory(false);
                        }
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
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Privacy &amp; Security</Text>
                    <View style={s.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <Section title="Account Security" items={ACCOUNT_ITEMS} />
                    <Section title="Privacy" items={PRIVACY_ITEMS} />

                    {/* ── My Data ── */}
                    <View style={s.section}>
                        <Text style={s.sectionLabel}>My Data</Text>
                        <View style={s.sectionCard}>
                            <DangerAction
                                icon="map-pin"
                                label="Delete Safe Place Reports"
                                description="Remove all green zone markers you submitted"
                                onPress={handleDeleteSafePlaces}
                                loading={deletingSafePlaces}
                            />
                            <View style={s.divider} />
                            <DangerAction
                                icon="alert-circle"
                                label="Clear SOS & Incident History"
                                description="Cancel active incidents and remove your SOS history from the map"
                                onPress={handleClearSosHistory}
                                loading={deletingHistory}
                            />
                        </View>
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

    scroll: { paddingHorizontal: 14, paddingTop: 24 },

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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: S.s4,
        gap: 12,
    },
    iconBox: {
        width: 34,
        height: 34,
        borderRadius: R.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.violetDim,
    },
    rowContent: { flex: 1 },
    rowLabel: { fontSize: 14, fontWeight: '600', color: T.ink },
    rowDesc: { fontSize: 12, fontWeight: '400', color: T.ink4, marginTop: 2 },

    dangerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: S.s4,
        gap: 12,
    },
    dangerIconBox: {
        width: 34,
        height: 34,
        borderRadius: R.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${T.danger}14`,
    },
    dangerLabel: { fontSize: 14, fontWeight: '600', color: T.danger },
});

