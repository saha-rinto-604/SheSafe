/**
 * privacy-security.tsx — Privacy & Security hub screen (Standard User)
 * ─────────────────────────────────────────────────────────────────────
 * Entry point for Account Security and Privacy sub-screens.
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';

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
                                    `/(tabs)/users/volunteer/${item.route}` as Parameters<typeof router.push>[0],
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

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PrivacySecurityScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

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
    rowLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: T.ink,
    },
    rowDesc: {
        fontSize: 12,
        fontWeight: '400',
        color: T.ink4,
        marginTop: 2,
    },
});

