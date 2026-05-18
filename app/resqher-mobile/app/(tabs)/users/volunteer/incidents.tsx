/**
 * incidents.tsx — Volunteer Incident History
 * Dual-category tabs: "Assisting" (helped others) vs "My Emergencies" (own SOS).
 * Uses the same animated sliding-indicator segment pattern as activity.tsx.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Animated,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { type IncidentCategory } from '../../../../src/types/chat';

const MED = {
    muted: '#A09CB2',
    stroke: 'rgba(255,255,255,0.1)',
} as const;

const SEGMENTS = ['Assisted', 'My Emergencies'] as const;
type Segment = (typeof SEGMENTS)[number];

// ── Types ──────────────────────────────────────────────────────────────────────
type IncidentStatus = 'Resolved' | 'Cancelled' | 'Active';

type VolunteerIncident = {
    id: string;
    category: IncidentCategory;
    incidentNumber: number;
    /** For Assisting: name of the person helped. For My Emergencies: name of responder. */
    personName: string;
    location: string;
    occurredAtLabel: string;
    status: IncidentStatus;
};

// ── Mock data ──────────────────────────────────────────────────────────────────
const ALL_INCIDENTS: VolunteerIncident[] = [
    // ── ASSISTING (helped others)
    {
        id: 'inc-312',
        category: 'ASSISTED',
        incidentNumber: 312,
        personName: 'Sumaiya Hossain',
        location: 'Gulshan, Dhaka',
        occurredAtLabel: '12 May 2026 · 10:15 PM',
        status: 'Active',
    },
    {
        id: 'inc-204',
        category: 'ASSISTED',
        incidentNumber: 204,
        personName: 'Fatima Rahman',
        location: 'Mirpur, Dhaka',
        occurredAtLabel: '12 May 2026 · 8:40 PM',
        status: 'Resolved',
    },
    {
        id: 'inc-198',
        category: 'ASSISTED',
        incidentNumber: 198,
        personName: 'Nadia Akter',
        location: 'Dhanmondi, Dhaka',
        occurredAtLabel: '01 May 2026 · 7:10 PM',
        status: 'Cancelled',
    },
    {
        id: 'inc-175',
        category: 'ASSISTED',
        incidentNumber: 175,
        personName: 'Ayesha Sultana',
        location: 'Gulshan, Dhaka',
        occurredAtLabel: '14 Apr 2026 · 5:05 PM',
        status: 'Resolved',
    },

    // ── MY EMERGENCIES (own SOS)
    {
        id: 'inc-301',
        category: 'MY_EMERGENCY',
        incidentNumber: 301,
        personName: 'Kabir Hossain',
        location: 'Khilkhet, Dhaka',
        occurredAtLabel: '12 May 2026 · 9:55 PM',
        status: 'Active',
    },
    {
        id: 'inc-289',
        category: 'MY_EMERGENCY',
        incidentNumber: 289,
        personName: 'Raihan Ahmed',
        location: 'Mohakhali, Dhaka',
        occurredAtLabel: '11 May 2026 · 6:30 PM',
        status: 'Resolved',
    },
    {
        id: 'inc-270',
        category: 'MY_EMERGENCY',
        incidentNumber: 270,
        personName: '—',
        location: 'Banani, Dhaka',
        occurredAtLabel: '09 May 2026 · 3:20 PM',
        status: 'Cancelled',
    },
];

// ── Status badge config ────────────────────────────────────────────────────────
type StatusStyle = { color: string; bg: string; border: string; dot: string };

function statusStyle(status: IncidentStatus): StatusStyle {
    switch (status) {
        case 'Active':
            return {
                color: T.violet,
                bg: T.violetDim,
                border: `${T.violet}55`,
                dot: T.violet,
            };
        case 'Resolved':
            return {
                color: T.success,
                bg: 'rgba(16,185,129,0.12)',
                border: 'rgba(16,185,129,0.35)',
                dot: T.success,
            };
        case 'Cancelled':
            return {
                color: T.danger,
                bg: T.dangerLight,
                border: T.dangerBorder,
                dot: T.danger,
            };
    }
}

// ── IncidentCard ───────────────────────────────────────────────────────────────
function IncidentCard({
    incident, isMyEmergency, onPress,
}: {
    incident: VolunteerIncident;
    isMyEmergency: boolean;
    onPress: () => void;
}) {
    const ss = statusStyle(incident.status);
    const personLabel = isMyEmergency ? 'Assisted By' : 'Victim';
    const isActive = incident.status === 'Active';
    const activeBorderColor = T.violet;

    return (
        <TouchableOpacity
            style={[
                s.card,
                isActive && { borderLeftWidth: 3, borderLeftColor: activeBorderColor },
            ]}
            activeOpacity={0.8}
            onPress={onPress}
        >
            {/* ── Top row: ID + Status badge ── */}
            <View style={s.cardTopRow}>
                <View style={s.incidentIdRow}>
                    <Feather name="users" size={14} color={T.ink4} />
                    <Text style={s.incidentId}>Incident #{incident.incidentNumber}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: ss.bg, borderColor: ss.border }]}>
                    <View style={[s.statusDot, { backgroundColor: ss.dot }]} />
                    <Text style={[s.statusText, { color: ss.color }]}>{incident.status}</Text>
                </View>
            </View>

            <View style={s.divider} />

            {/* ── Person row (Victim or Assisted By) ── */}
            <View style={s.detailRow}>
                <Feather name="user" size={14} color={T.violet} style={s.detailIcon} />
                <Text style={s.detailLabel}>{personLabel}</Text>
                <Text style={s.detailValue}>{incident.personName}</Text>
            </View>

            {/* ── Location ── */}
            <View style={s.detailRow}>
                <Feather name="map-pin" size={14} color={T.violet} style={s.detailIcon} />
                <Text style={s.detailLabel}>Location</Text>
                <Text style={s.detailValue}>{incident.location}</Text>
            </View>

            {/* ── Date & Time ── */}
            <View style={s.detailRow}>
                <Feather name="calendar" size={14} color={T.violet} style={s.detailIcon} />
                <Text style={s.detailLabel}>Date & Time</Text>
                <Text style={s.detailValue}>{incident.occurredAtLabel}</Text>
            </View>

            {/* ── Status text row ── */}
            <View style={[s.detailRow, { marginBottom: 0 }]}>
                <Feather name="info" size={14} color={T.violet} style={s.detailIcon} />
                <Text style={s.detailLabel}>Status</Text>
                <Text style={[s.detailValue, { color: ss.color, fontWeight: '700' }]}>
                    {incident.status}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ isMyEmergency }: { isMyEmergency: boolean }) {
    return (
        <View style={s.emptyWrap}>
            <View style={s.emptyIconRing}>
                <Feather name={isMyEmergency ? 'alert-circle' : 'clock'} size={32} color={T.ink4} />
            </View>
            <Text style={s.emptyTitle}>No incidents yet</Text>
            <Text style={s.emptySubtitle}>
                {isMyEmergency
                    ? 'Your personal SOS emergencies will appear here.'
                    : 'Your volunteer incident history will appear here once you assist someone.'}
            </Text>
        </View>
    );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function VolunteerIncidents() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [segment, setSegment] = useState<Segment>('Assisted');
    const [segmentWidth, setSegmentWidth] = useState(0);
    const indicator = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    // Animate sliding indicator
    useEffect(() => {
        Animated.timing(indicator, {
            toValue: segment === 'Assisted' ? 0 : 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [indicator, segment]);

    const indicatorStyle = useMemo(() => {
        const translateX = indicator.interpolate({
            inputRange: [0, 1],
            outputRange: [0, segmentWidth],
        });
        return { transform: [{ translateX }] };
    }, [indicator, segmentWidth]);

    const onSegmentPress = (next: Segment) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSegment(next);
    };

    const isMyEmergency = segment === 'My Emergencies';
    const categoryKey: IncidentCategory = isMyEmergency ? 'MY_EMERGENCY' : 'ASSISTED';
    const incidents = useMemo(
        () => ALL_INCIDENTS.filter(i => i.category === categoryKey),
        [categoryKey],
    );

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
                    <Text style={s.headerTitle}>Incident History</Text>
                    <View style={s.headerSpacer} />
                </View>

                {/* ── Segment tabs — identical to activity.tsx ── */}
                <View
                    style={s.segmentWrap}
                    onLayout={e => setSegmentWidth(e.nativeEvent.layout.width / 2)}
                >
                    <Animated.View style={[s.segmentIndicator, indicatorStyle]} />
                    {SEGMENTS.map(label => (
                        <TouchableOpacity
                            key={label}
                            style={s.segmentBtn}
                            activeOpacity={0.7}
                            onPress={() => onSegmentPress(label)}
                        >
                            <Text style={[s.segmentText, segment === label && s.segmentTextActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Content ── */}
                <ScrollView
                    contentContainerStyle={[
                        s.scroll,
                        { paddingBottom: insets.bottom + 24 },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={s.sectionLabel}>
                        {incidents.length} {incidents.length === 1 ? 'Incident' : 'Incidents'}
                        {isMyEmergency ? ' · My Emergencies' : ' · Assisted'}
                    </Text>

                    {incidents.length === 0 ? (
                        <EmptyState isMyEmergency={isMyEmergency} />
                    ) : (
                        incidents.map(incident => (
                            <IncidentCard
                                key={incident.id}
                                incident={incident}
                                isMyEmergency={isMyEmergency}
                                onPress={() => router.push(
                                    `/(tabs)/users/volunteer/chat_room?incidentId=${incident.id}&category=${categoryKey}` as any
                                )}
                            />
                        ))
                    )}
                </ScrollView>

            </View>
        </AtmosphericShell>
    );
}

// ── StyleSheet ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: MED.stroke,
        backgroundColor: 'transparent',
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: MED.stroke,
        backgroundColor: T.surfaceBulky,
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

    // ── Segment control — same as activity.tsx ──
    segmentWrap: {
        marginHorizontal: 14,
        marginTop: 16,
        marginBottom: 14,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.pill,
        borderWidth: 1,
        borderColor: T.lineMid,
        flexDirection: 'row',
        position: 'relative',
        overflow: 'hidden',
    },
    segmentIndicator: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        width: '50%',
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulkyActive,
        borderWidth: 1,
        borderColor: `${T.violet}55`,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink4,
    },
    segmentTextActive: { color: T.ink },

    scroll: { paddingHorizontal: 14, paddingTop: 4 },

    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: MED.muted,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 14,
        marginLeft: 4,
    },

    card: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: S.s4,
        paddingVertical: 14,
        marginBottom: 12,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    incidentIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    incidentId: {
        fontSize: 15,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: -0.2,
    },

    // ── Status badge — exact same colors as messages.tsx ──
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: R.pill,
        borderWidth: 1,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
        marginBottom: 12,
    },

    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    detailIcon: { width: 16 },
    detailLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: T.ink4,
        width: 80,
    },
    detailValue: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: T.ink2,
    },

    emptyWrap: {
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 24,
    },
    emptyIconRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: T.lineMid,
        alignItems: 'center',
        justifyContent: 'center',
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
        fontWeight: '400',
        color: T.ink4,
        textAlign: 'center',
        lineHeight: 20,
    },
});
