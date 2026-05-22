/**
 * AdminDashboardCards — All card components for the Admin Dashboard.
 * Hero card, stat cards, incident cards, escalation cards, verification cards, report cards.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  Animated, Easing,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { T, S, R } from '../../constants/theme';
import { G } from '../../constants/gradients';
import {
  ADMIN_STATS,
  type MockIncident, type MockEscalation,
  type MockVerification, type MockReport, type IncidentStatus,
} from '../../data/adminMockData';
import UserAvatar from '../shared/UserAvatar';
import { AnimatedListItem } from '../shared/AnimatedListItem';

/* ── Status color helper ── */
const STATUS_COLORS: Record<IncidentStatus, string> = {
  ACTIVE: T.violet,
  RESOLVED: T.success,
  ESCALATED: '#E25B3A',
  CANCELLED: T.ink4,
};

/* ─────────────────────────────────────────────────────── */
/*  HERO EMERGENCY CARD                                    */
/* ─────────────────────────────────────────────────────── */
export function HeroCard({ onOpenIncidentCenter }: { onOpenIncidentCenter?: () => void }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  const stats = [
    { value: ADMIN_STATS.activeSos, label: 'Active SOS Incidents', color: T.danger, icon: 'alert-circle' },
    { value: ADMIN_STATS.policeEscalations, label: 'Police Escalation Requests', color: '#E25B3A', icon: 'alert-triangle' },
    { value: ADMIN_STATS.volunteersOnline, label: 'Verified Volunteers Online', color: T.success, icon: 'users' },
    { value: ADMIN_STATS.pendingVerifications, label: 'Pending Verifications', color: T.accent, icon: 'clock' },
  ];

  return (
    <Animated.View style={[hc.wrap, { shadowOpacity: glowOpacity }]}>
      <LinearGradient
        colors={['#1A0F3A', '#120B29', '#0D0820'] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={hc.gradient}
      >
        {/* Pulse border effect */}
        <Animated.View style={[hc.pulseBorder, { opacity: glowOpacity }]} pointerEvents="none" />

        <View style={hc.header}>
          <View style={hc.headerIcon}>
            <Ionicons name="pulse" size={20} color={T.violet} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={hc.title}>Emergency Activity Overview</Text>
            <Text style={hc.subtitle}>Live monitoring across the SheSafe emergency network.</Text>
          </View>
        </View>

        <View style={hc.statsRow}>
          {stats.map((s, i) => (
            <View key={i} style={hc.statItem}>
              <View style={[hc.statDot, { backgroundColor: s.color }]} />
              <Text style={[hc.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={hc.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={hc.ctaBtn} activeOpacity={0.8} onPress={onOpenIncidentCenter}>
          <LinearGradient colors={G.navActive.colors as any} start={G.navActive.start} end={G.navActive.end} style={hc.ctaGradient}>
            <Feather name="radio" size={16} color="#FFF" />
            <Text style={hc.ctaText}>Open Incident Center</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const hc = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,56,246,0.2)',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowRadius: 24, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 10 },
      default: { shadowColor: '#8A38F6', shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2 },
    }),
  },
  gradient: { padding: 20, position: 'relative' },
  pulseBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: T.violet,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.violetDim, borderWidth: 1, borderColor: 'rgba(138,56,246,0.25)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  title: { fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: T.ink3, marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  statItem: {
    flex: 1, minWidth: 130,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: T.ink4, marginTop: 2, fontWeight: '500' },
  ctaBtn: { borderRadius: 12, overflow: 'hidden' },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, gap: 8,
  },
  ctaText: { fontSize: 14, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
});

/* ─────────────────────────────────────────────────────── */
/*  OVERVIEW STAT CARD                                     */
/* ─────────────────────────────────────────────────────── */
type StatCardProps = { label: string; value: number; icon: string; color: string; bgColor: string; index?: number };

export function StatCard({ label, value, icon, color, bgColor, index = 0 }: StatCardProps) {
  return (
    <AnimatedListItem index={index}>
      <TouchableOpacity style={sc.card} activeOpacity={0.85}>
        <View style={[sc.iconBox, { backgroundColor: bgColor }]}>
          <Feather name={icon as any} size={18} color={color} />
        </View>
        <Text style={sc.value}>{value}</Text>
        <Text style={sc.label}>{label}</Text>
      </TouchableOpacity>
    </AnimatedListItem>
  );
}

export const STAT_CARDS_DATA: StatCardProps[] = [
  { label: 'Total Users', value: ADMIN_STATS.totalUsers, icon: 'users', color: T.violet, bgColor: T.violetDim },
  { label: 'Verified Volunteers', value: ADMIN_STATS.verifiedVolunteers, icon: 'check-circle', color: T.violet, bgColor: T.violetDim },
  { label: 'Total Incidents', value: ADMIN_STATS.totalIncidents, icon: 'layers', color: T.violet, bgColor: T.violetDim },
  { label: 'Resolved Incidents', value: ADMIN_STATS.resolvedIncidents, icon: 'shield', color: T.success, bgColor: T.safeLight },
  { label: 'Police Escalations', value: ADMIN_STATS.policeEscalations, icon: 'alert-triangle', color: '#E25B3A', bgColor: 'rgba(226,91,58,0.12)' },
  { label: 'User Reports', value: ADMIN_STATS.userReports, icon: 'file-text', color: T.accent, bgColor: T.accentLight },
];

const sc = StyleSheet.create({
  card: {
    flex: 1, minWidth: 150,
    backgroundColor: T.surfaceCard, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: T.lineMid,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  value: { fontSize: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  label: { fontSize: 11, fontWeight: '600', color: T.ink4, marginTop: 3 },
});

/* ─────────────────────────────────────────────────────── */
/*  INCIDENT CARD                                          */
/* ─────────────────────────────────────────────────────── */
export function IncidentCard({ item, isEscalatedByAdmin = false, onPress, index = 0, style }: { item: MockIncident; isEscalatedByAdmin?: boolean; onPress?: () => void; index?: number; style?: any }) {
  let displayStatus = item.status as string;
  let statusColor = STATUS_COLORS[item.status];

  if (isEscalatedByAdmin || item.status === 'ESCALATED') {
    displayStatus = 'ESCALATED';
    statusColor = '#E25B3A';
  }

  const isEscalated = isEscalatedByAdmin || item.status === 'ESCALATED';
  const isPoliceRequest = item.policeEscalated && !isEscalated;
  return (
    <TouchableOpacity style={[ic.card, style]} activeOpacity={0.8} onPress={onPress}>
      <View style={ic.topRow}>
        <View style={[ic.idBadge, { borderColor: statusColor }]}>
          <Text style={[ic.idText, { color: statusColor }]}>{item.id}</Text>
        </View>
        <View style={[ic.statusBadge, { backgroundColor: statusColor + '1A' }]}>
          <View style={[ic.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[ic.statusText, { color: statusColor }]}>{displayStatus}</Text>
        </View>
      </View>
      <View style={ic.victimRow}>
        <UserAvatar size={24} />
        <Text style={ic.victimName}>{item.victim}</Text>
      </View>
      <View style={ic.infoRow}>
        <Feather name="map-pin" size={13} color={T.ink4} />
        <Text style={ic.infoTxt}>{item.location}</Text>
      </View>
      <View style={ic.infoRow}>
        <Feather name="clock" size={13} color={T.ink4} />
        <Text style={ic.infoTxt}>{item.time}</Text>
      </View>
      <View style={ic.bottomRow}>
        <View style={ic.volBadge}>
          <Feather name="users" size={12} color={T.violet} />
          <Text style={ic.volText}>{item.volunteers} Volunteers</Text>
        </View>
        {isPoliceRequest && (
          <View style={ic.policeBadge}>
            <Feather name="alert-circle" size={12} color="#E25B3A" />
            <Text style={ic.policeText}>Police Assistance Request</Text>
          </View>
        )}
        {isEscalated && (
          <View style={ic.policeBadge}>
            <Feather name="alert-triangle" size={12} color="#E25B3A" />
            <Text style={ic.policeText}>Police Escalated</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: T.surfaceCard, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: T.lineMid, marginBottom: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  idBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  idText: { fontSize: 12, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  victimRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  victimName: { fontSize: 13, fontWeight: '700', color: T.ink },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoTxt: { fontSize: 12, color: T.ink3, fontWeight: '500' },
  bottomRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  volBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.violetDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  volText: { fontSize: 10, fontWeight: '600', color: T.violet },
  policeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(226,91,58,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  policeText: { fontSize: 10, fontWeight: '600', color: '#E25B3A' },
});

/* ─────────────────────────────────────────────────────── */
/*  ESCALATION CARD                                        */
/* ─────────────────────────────────────────────────────── */
export function EscalationCard({ item }: { item: MockEscalation }) {
  return (
    <View style={ec.card}>
      <View style={ec.row}>
        <Text style={ec.incidentId}>{item.incidentId}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Text style={ec.victim}>{item.victim}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Feather name="map-pin" size={11} color={T.ink4} />
          <Text style={ec.loc}>{item.location}</Text>
          <Text style={ec.date}>· {item.date}</Text>
        </View>
      </View>
      <TouchableOpacity style={ec.btn} activeOpacity={0.8}>
        <Feather name="external-link" size={13} color="#E25B3A" />
        <Text style={ec.btnText}>Redirect to Police</Text>
      </TouchableOpacity>
    </View>
  );
}

const ec = StyleSheet.create({
  card: {
    backgroundColor: T.surfaceCard, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: T.lineMid, marginBottom: 10,
    height: 116, justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  incidentId: { fontSize: 13, fontWeight: '800', color: '#E25B3A' },
  victim: { fontSize: 13, fontWeight: '600', color: T.ink, marginTop: 2 },
  loc: { fontSize: 11, color: T.ink4 },
  date: { fontSize: 11, color: T.ink4 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(226,91,58,0.12)', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  btnText: { fontSize: 11, fontWeight: '700', color: '#E25B3A' },
});

/* ─────────────────────────────────────────────────────── */
/*  VERIFICATION CARD                                      */
/* ─────────────────────────────────────────────────────── */
export function VerificationCard({ item }: { item: MockVerification }) {
  return (
    <View style={vc.card}>
      <View style={vc.row}>
        <UserAvatar size={36} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={vc.name}>{item.name}</Text>
          <Text style={vc.submitted}>Submitted {item.submitted}</Text>
        </View>
      </View>
      <View style={vc.btnRow}>
        <TouchableOpacity style={[vc.btn, vc.approveBtn]} activeOpacity={0.8}>
          <Feather name="check" size={14} color={T.success} />
          <Text style={[vc.btnTxt, { color: T.success }]}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[vc.btn, vc.rejectBtn]} activeOpacity={0.8}>
          <Feather name="x" size={14} color={T.danger} />
          <Text style={[vc.btnTxt, { color: T.danger }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const vc = StyleSheet.create({
  card: {
    backgroundColor: T.surfaceCard, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: T.lineMid, marginBottom: 10,
    height: 116, justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 13, fontWeight: '700', color: T.ink },
  submitted: { fontSize: 11, color: T.ink4, marginTop: 1 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8 },
  approveBtn: { backgroundColor: T.safeLight },
  rejectBtn: { backgroundColor: T.dangerLight },
  btnTxt: { fontSize: 12, fontWeight: '700' },
});

/* ─────────────────────────────────────────────────────── */
/*  REPORT CARD                                            */
/* ─────────────────────────────────────────────────────── */
export function ReportCard({ item }: { item: MockReport }) {
  return (
    <View style={rc.card}>
      <View style={rc.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={rc.reported}>Reported: <Text style={{ color: T.ink }}>{item.reported}</Text></Text>
          <Text style={rc.by}>By: {item.by} · {item.date}</Text>
        </View>
      </View>
      <TouchableOpacity style={rc.btn} activeOpacity={0.8}>
        <Feather name="eye" size={13} color={T.violet} />
        <Text style={rc.btnTxt}>Review Report</Text>
      </TouchableOpacity>
    </View>
  );
}

const rc = StyleSheet.create({
  card: {
    backgroundColor: T.surfaceCard, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: T.lineMid, marginBottom: 10,
    height: 116, justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reported: { fontSize: 13, fontWeight: '600', color: T.ink3 },
  by: { fontSize: 11, color: T.ink4, marginTop: 2 },
  reasonBadge: { backgroundColor: T.dangerLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reasonTxt: { fontSize: 10, fontWeight: '700', color: T.danger },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.violetDim, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  btnTxt: { fontSize: 11, fontWeight: '700', color: T.violet },
});

/* ─────────────────────────────────────────────────────── */
/*  SECTION HEADER                                         */
/* ─────────────────────────────────────────────────────── */
export function SectionHeader({ title, icon, onViewAll }: { title: string; icon: string; onViewAll?: () => void }) {
  return (
    <View style={sh.row}>
      <Feather name={icon as any} size={16} color={T.violet} />
      <Text style={sh.title}>{title}</Text>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7} style={sh.viewAllBtn}>
          <Text style={sh.viewAllTxt}>View All</Text>
          <Feather name="chevron-right" size={14} color={T.violet} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  title: { fontSize: 15, fontWeight: '800', color: T.ink, flex: 1 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllTxt: { fontSize: 12, fontWeight: '600', color: T.violet },
});
