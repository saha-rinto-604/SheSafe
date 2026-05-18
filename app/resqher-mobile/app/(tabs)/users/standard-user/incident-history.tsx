/**
 * incident-history.tsx — Incident History Screen (Standard User)
 * ──────────────────────────────────────────────────────────────
 * Shows a list of past SOS incidents fetched from the backend.
 * Each incident shows exact location, date/time, and status.
 * Status: Active (SOS on) | Resolved (completed) | Cancelled
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../../../../src/services/api';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';

// ── Types ──────────────────────────────────────────────────────────────────────
type IncidentStatus = 'Active' | 'Resolved' | 'Cancelled';

type Incident = {
    id: string;
    incidentNumber: number;
    latitude: number;
    longitude: number;
    location: string;
    occurredAt: string;          // ISO timestamp from backend
    occurredAtLabel: string;     // Pre-formatted date/time string from backend
    status: IncidentStatus;
};

// ── Status badge config ────────────────────────────────────────────────────────
type StatusStyle = { color: string; bg: string; border: string; dot: string };

function statusStyle(status: IncidentStatus): StatusStyle {
    switch (status) {
        case 'Active':
            return {
                color: T.accent,
                bg: `${T.accent}15`,
                border: `${T.accent}35`,
                dot: T.accent,
            };
        case 'Resolved':
            return {
                color: T.success,
                bg: T.safeLight,
                border: `${T.success}35`,
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

// ── IncidentCard component ─────────────────────────────────────────────────────
function IncidentCard({ incident }: { incident: Incident }) {
    const ss = statusStyle(incident.status);
    const isCancelled = incident.status === 'Cancelled';
    return (
        <View style={[s.card, isCancelled && s.cardCancelled]}>
            {/* ── Top row: ID + Status badge ── */}
            <View style={s.cardTopRow}>
                <View style={s.incidentIdRow}>
                    <Feather name="alert-circle" size={14} color={isCancelled ? T.danger : T.ink4} />
                    <Text style={[s.incidentId, isCancelled && s.incidentIdCancelled]}>Incident #{incident.incidentNumber}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: ss.bg, borderColor: ss.border }]}>
                    <View style={[s.statusDot, { backgroundColor: ss.dot }]} />
                    <Text style={[s.statusText, { color: ss.color }]}>{incident.status}</Text>
                </View>
            </View>

            <View style={s.divider} />

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

            {/* ── Status (text row) ── */}
            <View style={[s.detailRow, { marginBottom: 0 }]}>
                <Feather name="info" size={14} color={T.violet} style={s.detailIcon} />
                <Text style={s.detailLabel}>Status</Text>
                <Text style={[s.detailValue, { color: ss.color, fontWeight: '700' }]}>
                    {incident.status}
                </Text>
            </View>
        </View>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <View style={s.emptyWrap}>
            <View style={s.emptyIconRing}>
                <Feather name="clock" size={32} color={T.ink4} />
            </View>
            <Text style={s.emptyTitle}>No incidents yet</Text>
            <Text style={s.emptySubtitle}>
                Your past SOS incidents will appear here once you have triggered an alert.
            </Text>
        </View>
    );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function IncidentHistoryScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Fetch incident history from API on mount ────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/api/incidents/my');
                const list: Incident[] = (data?.incidents || []).map((inc: any) => ({
                    id: String(inc.id),
                    incidentNumber: Number(inc.incidentNumber || inc.id),
                    latitude: Number(inc.latitude || 0),
                    longitude: Number(inc.longitude || 0),
                    location: inc.location || `${Number(inc.latitude || 0).toFixed(4)}, ${Number(inc.longitude || 0).toFixed(4)}`,
                    occurredAt: inc.occurredAt || inc.created_at || '',
                    occurredAtLabel: inc.occurredAtLabel || new Date(inc.occurredAt || inc.created_at).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true,
                    }),
                    status: inc.status as IncidentStatus,
                }));
                setIncidents(list);
            } catch (err) {
                console.log('[INC_HISTORY] API load failed:', (err as Error).message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Glass header ── */}
                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Incident History</Text>
                    <View style={s.headerSpacer} />
                </View>

                {/* ── Content ── */}
                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Incident list */}
                    <Text style={s.sectionLabel}>
                        {incidents.length} {incidents.length === 1 ? 'Incident' : 'Incidents'}
                    </Text>

                    {incidents.length === 0 ? (
                        <EmptyState />
                    ) : (
                        incidents.map(incident => (
                            <IncidentCard key={incident.id} incident={incident} />
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

    // Header
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

    // Scroll
    scroll: { paddingHorizontal: 14, paddingTop: 20 },

    // Section label
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 14,
        marginLeft: 4,
    },

    // Incident card
    card: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: S.s4,
        paddingVertical: 14,
        marginBottom: 12,
    },
    cardCancelled: {
        backgroundColor: T.dangerLight,
        borderColor: T.dangerBorder,
        borderLeftColor: T.danger,
        borderLeftWidth: 4,
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
    incidentIdCancelled: {
        color: T.danger,
    },

    // Status badge
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: R.pill,
        borderWidth: 1,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    // Divider
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
        marginBottom: 12,
    },

    // Detail rows
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
        width: 72,
    },
    detailValue: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: T.ink2,
    },

    // Empty state
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

