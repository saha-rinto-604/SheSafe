/**
 * profile-information.tsx — Profile Information Screen (Standard User)
 * ─────────────────────────────────────────────────────────────────────
 * Read-only display of the user's saved profile data.
 * Data comes from the local profile service (SecureStore) — will swap to
 * GET /api/v1/users/me/ when the backend is ready.
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Image,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { getUserProfile, displayName, formatDob, UserProfile } from '../../../../src/services/profile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={s.section}>
            <Text style={s.sectionTitle}>{title}</Text>
            <View style={s.sectionCard}>{children}</View>
        </View>
    );
}

function Divider() {
    return <View style={s.divider} />;
}

function InfoRow({
    label,
    value,
    icon,
    isEmpty,
}: {
    label: string;
    value: string;
    icon?: React.ComponentProps<typeof Feather>['name'];
    isEmpty?: boolean;
}) {
    return (
        <View style={s.infoRow}>
            <View style={s.infoLeft}>
                {icon && (
                    <Feather name={icon} size={14} color={T.ink4} style={s.infoIcon} />
                )}
                <Text style={s.infoLabel}>{label}</Text>
            </View>
            <Text style={[s.infoValue, isEmpty && s.infoValueEmpty]}>
                {value || '—'}
            </Text>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileInformationScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);

    // Reload on every focus so edits from Edit Profile are reflected immediately
    useFocusEffect(
        useCallback(() => {
            getUserProfile().then(setProfile);
        }, []),
    );

    const fullName = profile ? displayName(profile) : '';
    const dob = profile ? formatDob(profile.dobISO) : '';

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Header ──────────────────────────────────────────────── */}
                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="arrow-back" size={20} color={T.ink2} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Profile Information</Text>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.push('/(tabs)/users/standard-user/edit-profile')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Edit profile"
                    >
                        <Feather name="edit-2" size={16} color={T.violet} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Photo ───────────────────────────────────────────── */}
                    <View style={s.photoSection}>
                        <View style={s.avatarWrap}>
                            {profile?.photoUri ? (
                                <Image source={{ uri: profile.photoUri }} style={s.avatar} />
                            ) : (
                                <Image
                                    source={require('../../../../assets/images/icon.png')}
                                    style={s.avatar}
                                />
                            )}
                        </View>
                        <Text style={s.avatarName}>{fullName}</Text>
                    </View>

                    {/* ── Basic Info ───────────────────────────────────────── */}
                    <Section title="Basic Info">
                        <InfoRow
                            label="First Name"
                            icon="user"
                            value={profile?.firstName ?? ''}
                            isEmpty={!profile?.firstName}
                        />
                        <Divider />
                        <InfoRow
                            label="Last Name"
                            icon="user"
                            value={profile?.lastName ?? ''}
                            isEmpty={!profile?.lastName}
                        />
                        <Divider />
                        <InfoRow
                            label="Phone Number"
                            icon="phone"
                            value={profile?.phone ?? ''}
                            isEmpty={!profile?.phone}
                        />
                    </Section>

                    {/* ── Personal Info ────────────────────────────────────── */}
                    <Section title="Personal Info">
                        <InfoRow
                            label="Date of Birth"
                            icon="calendar"
                            value={dob}
                            isEmpty={!dob}
                        />
                        <Divider />
                        <InfoRow
                            label="Gender"
                            icon="users"
                            value={profile?.gender ?? ''}
                            isEmpty={!profile?.gender}
                        />
                        <Divider />
                        <InfoRow
                            label="Blood Group"
                            icon="activity"
                            value={profile?.bloodGroup ?? ''}
                            isEmpty={!profile?.bloodGroup}
                        />
                    </Section>

                    {/* ── Medical Info ──────────────────────────────────────── */}
                    <Section title="Medical Info">
                        {(!profile?.medicalInfo || profile.medicalInfo.length === 0) ? (
                            <Text style={s.emptyHint}>No medical information added yet.</Text>
                        ) : (
                            profile.medicalInfo.map((info, i) => (
                                <View key={i}>
                                    {i > 0 && <Divider />}
                                    <InfoRow label={`#${i + 1}`} value={info} />
                                </View>
                            ))
                        )}
                    </Section>

                    {/* ── Address ───────────────────────────────────────────── */}
                    <Section title="Address">
                        <InfoRow
                            label="Home Address"
                            icon="map-pin"
                            value={profile?.homeAddress ?? ''}
                            isEmpty={!profile?.homeAddress}
                        />
                    </Section>
                </ScrollView>
            </View>
        </AtmosphericShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
    },

    // ── Header ───────────────────────────────────────────────────────────────
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

    // ── Scroll ───────────────────────────────────────────────────────────────
    scroll: {
        paddingHorizontal: 14,
        paddingTop: 20,
    },

    // ── Photo ─────────────────────────────────────────────────────────────────
    photoSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 2.5,
        borderColor: `${T.violet}50`,
        overflow: 'hidden',
        backgroundColor: T.violetDim,
        marginBottom: 10,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarName: {
        fontSize: 18,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: -0.4,
    },

    // ── Section ───────────────────────────────────────────────────────────────
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
    },
    sectionCard: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: S.s4,
        paddingVertical: 4,
    },

    // ── Info Row ──────────────────────────────────────────────────────────────
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 13,
        gap: 12,
    },
    infoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoIcon: {
        width: 16,
    },
    infoLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: T.ink3,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: T.ink,
        textAlign: 'right',
        flexShrink: 1,
    },
    infoValueEmpty: {
        color: T.ink4,
        fontWeight: '400',
    },

    // ── Divider ───────────────────────────────────────────────────────────────
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
    },

    // ── Empty hint ────────────────────────────────────────────────────────────
    emptyHint: {
        fontSize: 13,
        color: T.ink4,
        textAlign: 'center',
        paddingVertical: 16,
    },
});
