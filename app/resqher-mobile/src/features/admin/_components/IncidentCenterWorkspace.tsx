import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../constants/theme';
import { type MockIncident } from '../_data/adminMockData';
import { IncidentCard } from './AdminDashboardCards';
import UserAvatar from '../../../components/shared/UserAvatar';
import { Animated } from 'react-native';
import { AnimatedListItem } from './AnimatedListItem';
import adminService from '../../../services/adminService';

type FilterTab = 'Live' | 'Resolved' | 'Cancelled' | 'All';

export function IncidentCenterWorkspace({ insetsBottom }: { insetsBottom: number }) {
  const [activeTab, setActiveTab] = useState<FilterTab>('Live');
  const [selectedIncident, setSelectedIncident] = useState<MockIncident | null>(null);
  const [incidents, setIncidents] = useState<MockIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidthStyle = isMobile ? { width: '100%' as const } : { width: 340 };

  let displayStatus = selectedIncident?.status || '';
  let statusColor: string = T.success;

  if (selectedIncident) {
    if (selectedIncident.status === 'CANCELLED') {
      displayStatus = 'CANCELLED';
      statusColor = T.ink4;
    } else if (selectedIncident.status === 'RESOLVED') {
      displayStatus = 'RESOLVED';
      statusColor = T.success;
    } else {
      statusColor = T.violet;
    }
  }

  const loadIncidents = useCallback(async (tab: FilterTab = activeTab) => {
    setLoading(true);
    setError('');
    try {
      const status = tab === 'Live' ? 'LIVE' : tab === 'Resolved' ? 'RESOLVED' : tab === 'Cancelled' ? 'CANCELLED' : 'ALL';
      setIncidents(await adminService.getIncidents(status));
    } catch (err: any) {
      setError(err?.message || 'Could not load incidents.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadIncidents(activeTab);
  }, [activeTab, loadIncidents]);

  // Filter logic
  const filteredIncidents = incidents.filter((inc) => {
    if (activeTab === 'Live') return inc.status === 'ACTIVE';
    if (activeTab === 'Resolved') return inc.status === 'RESOLVED';
    if (activeTab === 'Cancelled') return inc.status === 'CANCELLED';
    return true; // 'All'
  });

  const handleTabChange = (tab: FilterTab) => {
    if (tab === activeTab) return;
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();
    setTimeout(() => setActiveTab(tab), 100);
  };

  return (
    <View style={st.container}>
      {/* Workspace Header */}
      <View style={st.header}>
        <View style={st.headerIcon}>
          <Feather name="radio" size={20} color={T.violet} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Incident Center</Text>
          <Text style={st.subtitle}>Monitor and manage live emergency incidents</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={st.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsScroll}>
          {(['Live', 'Resolved', 'Cancelled', 'All'] as FilterTab[]).map((tab) => {
            const isActive = activeTab === tab;
            let activeColor: string = T.violet;
            let activeBg: string = T.violetDim;
            
            if (tab === 'Resolved') {
              activeColor = T.success;
              activeBg = T.safeLight;
            } else if (tab === 'Cancelled') {
              activeColor = T.ink3;
              activeBg = 'rgba(255,255,255,0.08)';
            } else if (tab === 'All') {
              activeColor = '#FFF';
              activeBg = 'rgba(255,255,255,0.08)';
            }

            return (
              <TouchableOpacity
                key={tab}
                style={[
                  st.tabBtn, 
                  isActive && { borderColor: activeColor, backgroundColor: activeBg }
                ]}
                onPress={() => handleTabChange(tab)}
                activeOpacity={0.7}
              >
                {tab === 'Live' && <View style={[st.liveDot, !isActive && { backgroundColor: T.ink4 }]} />}
                <Text style={[st.tabTxt, isActive && { color: activeColor }]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Incident List */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.grid, { paddingBottom: insetsBottom + 30 }]}
        style={{ opacity: fadeAnim }}
      >
        {loading ? (
          <View style={st.emptyState}>
            <Text style={st.emptyTxt}>Loading incidents...</Text>
          </View>
        ) : error ? (
          <TouchableOpacity style={st.emptyState} onPress={() => loadIncidents(activeTab)} activeOpacity={0.8}>
            <Feather name="alert-circle" size={32} color={T.danger} />
            <Text style={st.emptyTxt}>{error}</Text>
          </TouchableOpacity>
        ) : filteredIncidents.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="shield" size={32} color={T.ink4} />
            <Text style={st.emptyTxt}>No incidents found in this category.</Text>
          </View>
        ) : (
          filteredIncidents.map((inc, index) => {
            return (
              <AnimatedListItem key={`${inc.id}-${activeTab}`} index={index} style={cardWidthStyle}>
                <IncidentCard 
                  item={inc} 
                  onPress={() => setSelectedIncident(inc)} 
                />
              </AnimatedListItem>
            );
          })
        )}
      </Animated.ScrollView>

      {/* Incident Detail Modal */}
      <Modal visible={!!selectedIncident} transparent animationType="slide" onRequestClose={() => setSelectedIncident(null)}>
        <View style={md.overlay}>
          <View style={md.container}>
            {selectedIncident && (
              <>
                <View style={md.header}>
                  <Text style={md.headerTitle}>Incident Details {selectedIncident.id}</Text>
                  <TouchableOpacity onPress={() => setSelectedIncident(null)} style={md.closeBtn}>
                    <Feather name="x" size={20} color={T.ink3} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView contentContainerStyle={md.scrollContent}>
                  {/* Victim Info */}
                  <View style={md.section}>
                    <Text style={md.sectionTitle}>Victim/User Information</Text>
                    <View style={md.victimRow}>
                      <UserAvatar size={48} />
                      <View style={{ marginLeft: 12, justifyContent: 'center' }}>
                        <Text style={md.victimName}>{selectedIncident.victim}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Incident Info */}
                  <View style={md.section}>
                    <Text style={md.sectionTitle}>Emergency Details</Text>
                    <View style={md.detailRow}>
                      <Feather name="map-pin" size={16} color={T.ink4} />
                      <Text style={md.detailTxt}>{selectedIncident.location}</Text>
                    </View>
                    <View style={md.detailRow}>
                      <Feather name="clock" size={16} color={T.ink4} />
                      <Text style={md.detailTxt}>{selectedIncident.time} • Today</Text>
                    </View>
                    <View style={md.detailRow}>
                      <Feather name="users" size={16} color={T.ink4} />
                      <Text style={md.detailTxt}>{selectedIncident.volunteers} Volunteers Assigned</Text>
                    </View>
                  </View>

                  {/* Assigned Volunteers */}
                  {selectedIncident.assignedVolunteers && selectedIncident.assignedVolunteers.length > 0 && (
                    <View style={md.section}>
                      <Text style={md.sectionTitle}>Assigned Volunteers</Text>
                      {selectedIncident.assignedVolunteers.map((vol) => (
                        <View key={vol.id} style={md.volunteerRow}>
                          <UserAvatar size={36} />
                          <View style={{ marginLeft: 12, flex: 1, justifyContent: 'center' }}>
                            <Text style={md.volunteerName}>{vol.name}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Status Box */}
                  <View style={md.statusBox}>
                    <View>
                      <Text style={md.statusLabel}>Current Status</Text>
                      <Text style={[md.statusValue, { color: statusColor, textTransform: 'uppercase' }]}>
                        {displayStatus}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: T.violetDim,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(138,56,246,0.2)',
  },
  title: { fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: T.ink4, marginTop: 2 },
  
  tabsWrap: { marginBottom: 20 },
  tabsScroll: { gap: 8 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabBtnActive: { backgroundColor: T.violetDim, borderColor: T.violet },
  tabTxt: { fontSize: 13, fontWeight: '600', color: T.ink4 },
  tabTxtActive: { color: T.violet },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.danger },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, width: '100%' },
  emptyTxt: { fontSize: 13, color: T.ink4, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});

const md = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  container: {
    width: '100%', maxWidth: 500, maxHeight: '85%',
    backgroundColor: '#0F1020', borderRadius: 24,
    borderWidth: 1, borderColor: T.lineMid, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: T.ink },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: T.violet, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  
  victimRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surfaceCard, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: T.lineMid },
  victimName: { fontSize: 16, fontWeight: '800', color: T.ink },
  victimSub: { fontSize: 12, color: T.ink4, marginTop: 2 },
  
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  detailTxt: { fontSize: 14, color: T.ink3, fontWeight: '500' },
  
  volunteerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surfaceCard, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: T.lineMid, marginBottom: 8 },
  volunteerName: { fontSize: 14, fontWeight: '700', color: T.ink },
  volunteerSub: { fontSize: 11, color: T.ink4, marginTop: 2 },
  contactBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.violetDim, alignItems: 'center', justifyContent: 'center' },
  
  statusBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: T.surfaceCard, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: T.lineMid, marginBottom: 24 },
  statusLabel: { fontSize: 11, color: T.ink4, marginBottom: 4 },
  statusValue: { fontSize: 15, fontWeight: '800' },
  
  actionArea: { gap: 12 },
  actionBtnWrapper: { borderRadius: 12, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  actionTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
