/**
 * two-factor-auth.tsx — Two-Factor Authentication screen (Standard User)
 * ────────────────────────────────────────────────────────────────────────
 * Lets the user enable/disable 2FA. Currently persisted locally via
 * privacySecurity service. When backend 2FA enrollment is implemented,
 * flip the service stub to a multi-step OTP flow without touching this screen
 * beyond updating the service functions.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { getTwoFactorState, setTwoFactorEnabled } from '../../../../src/services/privacySecurity';

export default function TwoFactorAuthScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load saved state on mount
    useEffect(() => {
        getTwoFactorState().then(val => {
            setEnabled(val);
            setLoading(false);
        });
    }, []);

    const handleToggle = async (value: boolean) => {
        setEnabled(value);
        await setTwoFactorEnabled(value);
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
                    <Text style={s.headerTitle}>Two-Factor Authentication</Text>
                    <View style={s.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Status banner */}
                    <View style={[s.statusBanner, enabled ? s.statusBannerOn : s.statusBannerOff]}>
                        <View style={[s.statusIconRing, enabled ? s.iconRingOn : s.iconRingOff]}>
                            <Feather
                                name={enabled ? 'shield' : 'shield-off'}
                                size={28}
                                color={enabled ? T.success : T.ink4}
                            />
                        </View>
                        <Text style={[s.statusTitle, { color: enabled ? T.success : T.ink3 }]}>
                            {loading ? 'Loading…' : enabled ? '2FA Enabled' : '2FA Disabled'}
                        </Text>
                        <Text style={s.statusSub}>
                            {enabled
                                ? 'Your account has extra login protection.'
                                : 'Enable to add extra login security.'}
                        </Text>
                    </View>

                    {/* Toggle card */}
                    <View style={s.section}>
                        <Text style={s.sectionLabel}>Settings</Text>
                        <View style={s.sectionCard}>
                            <View style={s.toggleRow}>
                                <View style={s.toggleLeft}>
                                    <View style={s.iconBox}>
                                        <Feather name="smartphone" size={17} color={T.violet} />
                                    </View>
                                    <View style={s.toggleContent}>
                                        <Text style={s.toggleLabel}>Enable Two-Factor Authentication</Text>
                                        <Text style={s.toggleDesc}>
                                            Adds extra login security (OTP)
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={enabled}
                                    onValueChange={handleToggle}
                                    disabled={loading}
                                    trackColor={{ false: T.surfaceMid, true: `${T.violet}80` }}
                                    thumbColor={enabled ? T.violet : T.ink4}
                                    ios_backgroundColor={T.surfaceMid}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Info card */}
                    <View style={s.infoCard}>
                        <Feather name="info" size={14} color={T.accent} style={{ marginTop: 1 }} />
                        <Text style={s.infoText}>
                            When enabled, you will be asked for a one-time code (OTP)
                            each time you log in. This protects your account even if
                            your password is compromised.
                        </Text>
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

    // Status banner
    statusBanner: {
        alignItems: 'center',
        borderRadius: R.lg,
        borderWidth: 1,
        paddingVertical: 28,
        paddingHorizontal: 20,
        marginBottom: 28,
    },
    statusBannerOn: {
        backgroundColor: T.safeLight,
        borderColor: `${T.success}30`,
    },
    statusBannerOff: {
        backgroundColor: T.surfaceCard,
        borderColor: T.lineMid,
    },
    statusIconRing: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    iconRingOn: {
        backgroundColor: `${T.success}15`,
        borderColor: `${T.success}35`,
    },
    iconRingOff: {
        backgroundColor: T.surfaceCard,
        borderColor: T.lineMid,
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.2,
        marginBottom: 6,
    },
    statusSub: {
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
        textAlign: 'center',
    },

    // Section
    section: { marginBottom: 20 },
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

    // Toggle row
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: S.s4,
        gap: 12,
    },
    toggleLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
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
    toggleContent: { flex: 1 },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: T.ink,
    },
    toggleDesc: {
        fontSize: 12,
        fontWeight: '400',
        color: T.ink4,
        marginTop: 2,
    },

    // Info card
    infoCard: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: `${T.accent}10`,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: `${T.accent}30`,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '400',
        color: T.ink3,
        lineHeight: 18,
    },
});

