import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../constants/theme';
import UserAvatar from '../shared/UserAvatar';
import { MOCK_INCIDENTS, type MockIncident } from '../../data/adminMockData';
import { AnimatedListItem } from '../shared/AnimatedListItem';
import { useToast } from '../Toast';

export function EscalationsWorkspace({ insetsBottom }: { insetsBottom: number }) {
  const [redirectedIds, setRedirectedIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidthStyle = isMobile ? { width: '100%' as const } : { width: 340 };

  // Escalations are active incidents where police assistance was requested
  const escalationRequests = MOCK_INCIDENTS.filter(
    (inc) => inc.status === 'ACTIVE' && inc.policeEscalated && (!redirectedIds.has(inc.id) || removingIds.has(inc.id))
  );

  const handleRedirect = (id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id));
    showToast({
      type: 'success',
      title: 'Incident Redirected',
      message: `Incident ${id} has been escalated to the police.`,
    });
    
    setTimeout(() => {
      setRedirectedIds((prev) => new Set(prev).add(id));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  };

  return (
    <View style={st.container}>
      {/* Workspace Header */}
      <View style={st.header}>
        <View style={st.headerIcon}>
          <Feather name="alert-triangle" size={20} color="#E25B3A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Emergency Escalations</Text>
          <Text style={st.subtitle}>Monitor and redirect SOS requests needing police intervention</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.grid, { paddingBottom: insetsBottom + 30 }]}
      >
        {escalationRequests.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="check-circle" size={40} color={T.success} />
            <Text style={st.emptyText}>No pending police escalations.</Text>
          </View>
        ) : (
          escalationRequests.map((inc, index) => (
            <AnimatedListItem key={inc.id} index={index} isRemoving={removingIds.has(inc.id)}>
              <View style={[ec.card, cardWidthStyle]}>
                <View style={ec.topRow}>
                  <Text style={ec.idTxt}>{inc.id}</Text>
                  <View style={ec.statusBadge}>
                    <Text style={ec.statusTxt}>POLICE ASSISTANCE REQUEST</Text>
                  </View>
                </View>

                <View style={ec.profileRow}>
                  <UserAvatar size={42} />
                  <View style={ec.profileInfo}>
                    <Text style={ec.victimName}>{inc.victim}</Text>
                    <View style={ec.metaRow}>
                      <Feather name="map-pin" size={12} color={T.ink4} />
                      <Text style={ec.metaTxt}>{inc.location}</Text>
                      <Text style={ec.metaDot}>•</Text>
                      <Feather name="clock" size={12} color={T.ink4} />
                      <Text style={ec.metaTxt}>{inc.time}</Text>
                    </View>
                  </View>
                </View>

                <View style={ec.divider} />

                <TouchableOpacity 
                  style={ec.redirectBtn} 
                  activeOpacity={0.7}
                  onPress={() => handleRedirect(inc.id)}
                >
                  <Feather name="external-link" size={16} color="#FFF" />
                  <Text style={ec.redirectTxt}>Redirect to Police Dashboard</Text>
                </TouchableOpacity>
              </View>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 20, gap: 14,
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(226,91,58,0.1)', borderWidth: 1, borderColor: 'rgba(226,91,58,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: T.ink4, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, width: '100%' },
  emptyText: { fontSize: 15, color: T.ink3, marginTop: 12, fontWeight: '600' },
});

const ec = StyleSheet.create({
  card: {
    backgroundColor: '#0F1020', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226,91,58,0.3)',
    padding: 16,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  idTxt: { fontSize: 14, fontWeight: '800', color: T.ink3 },
  statusBadge: { backgroundColor: 'rgba(226,91,58,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusTxt: { fontSize: 10, fontWeight: '800', color: '#E25B3A', letterSpacing: 0.5 },
  
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileInfo: { marginLeft: 12, flex: 1 },
  victimName: { fontSize: 16, fontWeight: '700', color: T.ink, marginBottom: 4 },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 12, color: T.ink4 },
  metaDot: { fontSize: 12, color: T.ink4, marginHorizontal: 2 },
  
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 16 },
  
  redirectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#E25B3A', paddingVertical: 12, borderRadius: 10,
  },
  redirectTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
