/**
 * safety-settings.tsx — Safety Settings Screen (Standard User)
 * ─────────────────────────────────────────────────────────────────────────
 * Sections: SOS Behavior · Alert Settings · Volunteer Assistance
 * Persistence: expo-secure-store (key: resqher_safety_settings_v1)
 * Auto-saves on every control interaction — no "Save" button needed.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
    Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';

// ── Constants ──────────────────────────────────────────────────────────────────
export const SAFETY_SETTINGS_KEY = 'resqher_safety_settings_v1';

export type SafetySettings = {
    sosCancelTimerSec: 10 | 15 | 20;
    notifyEmergencyContacts: boolean;
    pushNotifications: boolean;
    smsBackupAlert: boolean;
    maxResponders: 3 | 5;
    maxResponseDistance: 3 | 4 | 5;
    receiveSosAlerts: boolean;
};

export const DEFAULT_SAFETY_SETTINGS: SafetySettings = {
    sosCancelTimerSec: 10,
    notifyEmergencyContacts: true,
    pushNotifications: true,
    smsBackupAlert: false,
    maxResponders: 5,
    maxResponseDistance: 3,
    receiveSosAlerts: true,
};

const CANCEL_TIMER_OPTIONS: (10 | 15 | 20)[] = [10, 15, 20];
const RESPONDER_OPTIONS: (3 | 5)[] = [3, 5];
const MAX_DISTANCE_OPTIONS: (3 | 4 | 5)[] = [3, 4, 5];

// ── Helper — load settings from SecureStore with fallback ─────────────────────
export async function loadSafetySettings(): Promise<SafetySettings> {
    try {
        const raw = await SecureStore.getItemAsync(SAFETY_SETTINGS_KEY);
        if (raw) {
            return { ...DEFAULT_SAFETY_SETTINGS, ...JSON.parse(raw) };
        }
    } catch {
        // Corrupted — fall through to default
    }
    return { ...DEFAULT_SAFETY_SETTINGS };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View style={s.section}>
            <View style={s.sectionHeaderRow}>
                <Text style={s.sectionTitle}>{title}</Text>
            </View>
            <View style={s.sectionCard}>{children}</View>
        </View>
    );
}

function RowDivider() {
    return <View style={s.rowDivider} />;
}

// ── Chip selector (horizontal pill group) ─────────────────────────────────────
function ChipSelector<T extends number>({
    options,
    selected,
    onSelect,
    formatLabel,
}: {
    options: T[];
    selected: T;
    onSelect: (v: T) => void;
    formatLabel?: (v: T) => string;
}) {
    return (
        <View style={s.chipRow}>
            {options.map(opt => {
                const active = selected === opt;
                return (
                    <TouchableOpacity
                        key={opt}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => onSelect(opt)}
                        activeOpacity={0.75}
                    >
                        <Text style={[s.chipText, active && s.chipTextActive]}>
                            {formatLabel ? formatLabel(opt) : String(opt)}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({
    label,
    description,
    value,
    onValueChange,
}: {
    label: string;
    description?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
}) {
    return (
        <View style={s.toggleRowWrap}>
            <View style={s.toggleRowLeft}>
                <Text style={s.rowLabel}>{label}</Text>
                {description ? (
                    <Text style={s.rowDescription}>{description}</Text>
                ) : null}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: T.surfaceMid, true: `${T.violet}80` }}
                thumbColor={value ? T.violet : T.ink4}
                ios_backgroundColor={T.surfaceMid}
            />
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function SafetySettingsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [settings, setSettings] = useState<SafetySettings>(DEFAULT_SAFETY_SETTINGS);
    const [, setLoaded] = useState(false);

    // ── Load from SecureStore on mount ────────────────────────────────────
    useEffect(() => {
        loadSafetySettings().then(saved => {
            setSettings(saved);
            setLoaded(true);
        });
    }, []);

    // ── Persist whenever settings change (after initial load) ──────────────
    const persist = useCallback(async (next: SafetySettings) => {
        try {
            await SecureStore.setItemAsync(SAFETY_SETTINGS_KEY, JSON.stringify(next));
        } catch {
            // Best-effort
        }
    }, []);

    const update = useCallback(
        <K extends keyof SafetySettings>(key: K, value: SafetySettings[K]) => {
            setSettings(prev => {
                const next = { ...prev, [key]: value };
                void persist(next);
                return next;
            });
        },
        [persist],
    );

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Header ────────────────────────────────────────────────── */}
                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Safety Settings</Text>
                    <View style={s.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── SOS Behavior ──────────────────────────────────────── */}
                    <SectionCard title="SOS Behavior">
                        <View style={s.settingRow}>
                            <View style={s.settingRowLeft}>
                                <Text style={s.rowLabel}>SOS Cancel Timer</Text>
                                <Text style={s.rowDescription}>
                                    Time window to cancel a triggered SOS before it goes live.
                                </Text>
                            </View>
                        </View>
                        <ChipSelector
                            options={CANCEL_TIMER_OPTIONS}
                            selected={settings.sosCancelTimerSec}
                            onSelect={v => update('sosCancelTimerSec', v)}
                            formatLabel={v => `${v} sec`}
                        />
                    </SectionCard>

                    {/* ── Alert Settings ────────────────────────────────────── */}
                    <SectionCard title="Alert Settings">
                        <ToggleRow
                            label="Notify Emergency Contacts"
                            description="Send alerts to your saved emergency contacts when SOS is triggered."
                            value={settings.notifyEmergencyContacts}
                            onValueChange={v => update('notifyEmergencyContacts', v)}
                        />
                        <RowDivider />
                        <ToggleRow
                            label="Push Notifications"
                            description="Receive push notifications for alerts and updates."
                            value={settings.pushNotifications}
                            onValueChange={v => update('pushNotifications', v)}
                        />
                        <RowDivider />
                        <ToggleRow
                            label="SMS Backup Alert"
                            description="Send an SMS to emergency contacts if push notification fails."
                            value={settings.smsBackupAlert}
                            onValueChange={v => update('smsBackupAlert', v)}
                        />
                        <RowDivider />
                        <View style={s.settingRow}>
                            <View style={s.settingRowLeft}>
                                <Text style={s.rowLabel}>Maximum Response Distance</Text>
                                <Text style={s.rowDescription}>
                                    Maximum distance (in km) to receive SOS requests.
                                </Text>
                            </View>
                        </View>
                        <ChipSelector
                            options={MAX_DISTANCE_OPTIONS}
                            selected={settings.maxResponseDistance}
                            onSelect={v => update('maxResponseDistance', v)}
                            formatLabel={v => `${v} km`}
                        />
                    </SectionCard>

                    {/* ── Volunteer Assistance ──────────────────────────────── */}
                    <SectionCard title="Volunteer Assistance">
                        <View style={s.settingRow}>
                            <View style={s.settingRowLeft}>
                                <Text style={s.rowLabel}>Maximum Responders</Text>
                                <Text style={s.rowDescription}>
                                    Limits how many volunteers can accept the incident.
                                </Text>
                            </View>
                            <View style={s.responderBadge}>
                                <Text style={s.responderBadgeText}>
                                    {settings.maxResponders}
                                </Text>
                            </View>
                        </View>

                        <ChipSelector
                            options={RESPONDER_OPTIONS}
                            selected={settings.maxResponders}
                            onSelect={v => update('maxResponders', v)}
                            formatLabel={v => `${v} responders`}
                        />

                        <View style={s.recommendedWrap}>
                            {RESPONDER_OPTIONS.map(opt => (
                                <View key={opt} style={s.recommendedRow}>
                                    <Feather
                                        name={opt === settings.maxResponders ? 'check-circle' : 'circle'}
                                        size={13}
                                        color={opt === settings.maxResponders ? T.violet : T.ink5}
                                    />
                                    <Text
                                        style={[
                                            s.recommendedText,
                                            opt === settings.maxResponders && s.recommendedTextActive,
                                        ]}
                                    >
                                        {opt} responders
                                        {opt === DEFAULT_SAFETY_SETTINGS.maxResponders
                                            ? '  · Default'
                                            : ''}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </SectionCard>

                    {/* ── Footer note ───────────────────────────────────────── */}
                    <Text style={s.footerNote}>
                        Settings are saved automatically and take effect immediately.
                    </Text>
                </ScrollView>
            </View>
        </AtmosphericShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1 },

    // ── Header ────────────────────────────────────────────────────────────────
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

    // ── Scroll ────────────────────────────────────────────────────────────────
    scroll: {
        paddingHorizontal: 14,
        paddingTop: 20,
    },

    // ── Section ───────────────────────────────────────────────────────────────
    section: { marginBottom: 20 },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        marginLeft: 4,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: S.s4,
        paddingVertical: S.s3,
        overflow: 'visible',
    },

    // ── Setting row (label + optional badge) ──────────────────────────────────
    settingRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: S.s3,
    },
    settingRowLeft: { flex: 1, marginRight: 12 },
    rowLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: T.ink,
        marginBottom: 3,
    },
    rowDescription: {
        fontSize: 12,
        fontWeight: '400',
        color: T.ink4,
        lineHeight: 17,
    },

    // ── Toggle row ────────────────────────────────────────────────────────────
    toggleRowWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    toggleRowLeft: { flex: 1, marginRight: 12 },

    // ── Row divider ───────────────────────────────────────────────────────────
    rowDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
        marginHorizontal: -S.s4,
    },

    // ── Chips ─────────────────────────────────────────────────────────────────
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
        marginBottom: 4,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: R.sm,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
    },
    chipActive: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}50`,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: T.ink4,
    },
    chipTextActive: {
        color: T.violet,
    },

    // ── Responder badge ───────────────────────────────────────────────────────
    responderBadge: {
        minWidth: 36,
        height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}40`,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    responderBadgeText: {
        fontSize: 16,
        fontWeight: '800',
        color: T.violet,
    },

    // ── Recommended list ──────────────────────────────────────────────────────
    recommendedWrap: {
        marginTop: S.s3,
        paddingTop: S.s3,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: T.lineMid,
        gap: 8,
    },
    recommendedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recommendedText: {
        fontSize: 13,
        fontWeight: '500',
        color: T.ink4,
    },
    recommendedTextActive: {
        color: T.ink,
        fontWeight: '600',
    },

    // ── Footer ────────────────────────────────────────────────────────────────
    footerNote: {
        fontSize: 11,
        fontWeight: '400',
        color: T.ink5,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 8,
        letterSpacing: 0.1,
        lineHeight: 16,
    },
});

