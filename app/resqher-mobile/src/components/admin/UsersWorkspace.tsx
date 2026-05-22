import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../constants/theme';
import UserAvatar from '../shared/UserAvatar';
import { 
  MOCK_STANDARD_USERS, 
  MOCK_VOLUNTEERS, 
  type MockStandardUser, 
  type MockVolunteer,
  type MockIncident
} from '../../data/adminMockData';
import { Animated } from 'react-native';
import { AnimatedListItem } from '../shared/AnimatedListItem';

type UserTab = 'Standard Users' | 'Volunteers';

export function UsersWorkspace({ insetsBottom }: { insetsBottom: number }) {
  const [activeTab, setActiveTab] = useState<UserTab>('Standard Users');
  const [selectedUser, setSelectedUser] = useState<MockStandardUser | MockVolunteer | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<MockIncident | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const isStandard = (user: any): user is MockStandardUser => 'sosRequests' in user && !('rank' in user);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidthStyle = isMobile ? { width: '100%' as const } : { width: 280 };

  const handleTabChange = (tab: UserTab) => {
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
          <Feather name="users" size={20} color={T.violet} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>User Management</Text>
          <Text style={st.subtitle}>Manage Standard Users and Verified Volunteers</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={st.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsScroll}>
          {(['Standard Users', 'Volunteers'] as UserTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  st.tabBtn, 
                  isActive && { borderColor: T.violet, backgroundColor: T.violetDim }
                ]}
                onPress={() => handleTabChange(tab)}
                activeOpacity={0.7}
              >
                <Text style={[st.tabTxt, isActive && { color: T.violet }]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* User List Grid */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.grid, { paddingBottom: insetsBottom + 30 }]}
        style={{ opacity: fadeAnim }}
      >
        {activeTab === 'Standard Users' && MOCK_STANDARD_USERS.map((user, index) => (
          <AnimatedListItem key={`${user.id}-std`} index={index}>
            <TouchableOpacity 
              style={[uc.card, cardWidthStyle]} 
              activeOpacity={0.7} 
              onPress={() => setSelectedUser(user)}
            >
              <View style={uc.topRow}>
                <UserAvatar size={42} />
                <View style={uc.infoWrap}>
                  <Text style={uc.name}>{user.name}</Text>
                  <View style={uc.badgeStd}>
                    <Text style={uc.badgeTxtStd}>Standard User</Text>
                  </View>
                  <View style={uc.statsRow}>
                    <Text style={uc.statsTxt}><Text style={uc.statsVal}>{user.sosRequests}</Text> SOS Requests</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </AnimatedListItem>
        ))}

        {activeTab === 'Volunteers' && MOCK_VOLUNTEERS.map((vol, index) => (
          <AnimatedListItem key={`${vol.id}-vol`} index={index}>
            <TouchableOpacity 
              style={[uc.card, cardWidthStyle]} 
              activeOpacity={0.7} 
              onPress={() => setSelectedUser(vol)}
            >
              <View style={uc.topRow}>
                <UserAvatar size={42} />
                <View style={uc.infoWrap}>
                  <Text style={uc.name}>{vol.name}</Text>
                  <View style={uc.badgeVol}>
                    <Feather name="shield" size={10} color={T.success} />
                    <Text style={uc.badgeTxtVol}>Verified Volunteer</Text>
                  </View>
                  <View style={uc.statsRow}>
                    <Text style={uc.statsTxt}>#{vol.rank} Leaderboard · {vol.points} Points</Text>
                    <Text style={uc.statsTxt}><Text style={uc.statsVal}>{vol.assistedCount}</Text> Incidents Assisted</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </AnimatedListItem>
        ))}
      </Animated.ScrollView>

      {/* User Detail Modal */}
      <Modal visible={!!selectedUser && !selectedIncident} transparent animationType="slide" onRequestClose={() => setSelectedUser(null)}>
        <View style={md.overlay}>
          <View style={md.container}>
            {selectedUser && (
              <>
                <View style={md.header}>
                  <Text style={md.headerTitle}>User Profile</Text>
                  <TouchableOpacity onPress={() => setSelectedUser(null)} style={md.closeBtn}>
                    <Feather name="x" size={20} color={T.ink3} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView contentContainerStyle={md.scrollContent}>
                  <View style={md.profileHeader}>
                    <UserAvatar size={64} />
                    <View style={md.profileInfo}>
                      <Text style={md.profileName}>{selectedUser.name}</Text>
                      {isStandard(selectedUser) ? (
                        <>
                          <View style={uc.badgeStd}><Text style={uc.badgeTxtStd}>Standard User</Text></View>
                          <Text style={md.phoneTxt}>{selectedUser.phone}</Text>
                        </>
                      ) : (
                        <>
                          <View style={uc.badgeVol}>
                            <Feather name="shield" size={10} color={T.success} />
                            <Text style={uc.badgeTxtVol}>Verified Volunteer</Text>
                          </View>
                          <Text style={md.statsTxt}>#{selectedUser.rank} Leaderboard · {selectedUser.points} Points</Text>
                        </>
                      )}
                      <TouchableOpacity style={md.blockBtn} activeOpacity={0.7}>
                        <Feather name="slash" size={14} color={T.danger} />
                        <Text style={md.blockTxt}>Block User</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Incidents List */}
                  {isStandard(selectedUser) ? (
                    <View style={md.section}>
                      <Text style={md.sectionTitle}>SOS Incident History</Text>
                      {selectedUser.incidents.map(inc => (
                        <IncidentSummaryCard key={inc.id} inc={inc} onPress={() => setSelectedIncident(inc)} />
                      ))}
                    </View>
                  ) : (
                    <>
                      <View style={md.section}>
                        <Text style={md.sectionTitle}>Assisted Incidents</Text>
                        {selectedUser.assistedIncidents.length === 0 ? <Text style={md.emptyTxt}>No assisted incidents.</Text> : null}
                        {selectedUser.assistedIncidents.map(inc => (
                          <IncidentSummaryCard key={inc.id} inc={inc} onPress={() => setSelectedIncident(inc)} />
                        ))}
                      </View>
                      <View style={md.section}>
                        <Text style={md.sectionTitle}>SOS Requests Made</Text>
                        {selectedUser.sosIncidents.length === 0 ? <Text style={md.emptyTxt}>No SOS requests made.</Text> : null}
                        {selectedUser.sosIncidents.map(inc => (
                          <IncidentSummaryCard key={inc.id} inc={inc} onPress={() => setSelectedIncident(inc)} />
                        ))}
                      </View>
                    </>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Incident Detail View Modal */}
      <Modal visible={!!selectedIncident} transparent animationType="fade" onRequestClose={() => setSelectedIncident(null)}>
        <View style={md.overlay}>
          <View style={md.container}>
            {selectedIncident && (
              <>
                <View style={md.header}>
                  <TouchableOpacity onPress={() => setSelectedIncident(null)} style={md.closeBtn}>
                    <Feather name="arrow-left" size={20} color={T.ink3} />
                  </TouchableOpacity>
                  <Text style={md.headerTitle}>Incident {selectedIncident.id}</Text>
                  <View style={{ width: 36 }} />
                </View>
                
                <ScrollView contentContainerStyle={md.scrollContent}>
                  <View style={md.section}>
                    <Text style={md.sectionTitle}>Emergency Details</Text>
                    <View style={md.detailRow}>
                      <Text style={md.detailLbl}>Victim / User</Text>
                      <Text style={md.detailVal}>{selectedIncident.victim}</Text>
                    </View>
                    <View style={md.detailRow}>
                      <Text style={md.detailLbl}>Date & Time</Text>
                      <Text style={md.detailVal}>{selectedIncident.time}</Text>
                    </View>
                    <View style={md.detailRow}>
                      <Text style={md.detailLbl}>SOS Location</Text>
                      <Text style={md.detailVal}>{selectedIncident.location}</Text>
                    </View>
                    <View style={md.detailRow}>
                      <Text style={md.detailLbl}>Status</Text>
                      <Text style={[md.detailVal, { color: getStatusColor(selectedIncident.status, selectedIncident.policeEscalated) }]}>
                        {selectedIncident.status === 'ACTIVE' && selectedIncident.policeEscalated ? 'POLICE ASSISTANCE REQUEST' : selectedIncident.status}
                      </Text>
                    </View>
                    <View style={md.detailRow}>
                      <Text style={md.detailLbl}>Police Escalated</Text>
                      <Text style={[md.detailVal, { color: selectedIncident.policeEscalated ? '#E25B3A' : T.ink3 }]}>
                        {selectedIncident.policeEscalated ? 'YES' : 'NO'}
                      </Text>
                    </View>
                  </View>

                  {selectedIncident.assignedVolunteers && selectedIncident.assignedVolunteers.length > 0 && (
                    <View style={md.section}>
                      <Text style={md.sectionTitle}>Assigned Volunteers</Text>
                      {selectedIncident.assignedVolunteers.map(vol => (
                        <View key={vol.id} style={md.volunteerRow}>
                          <UserAvatar size={32} />
                          <Text style={md.volunteerName}>{vol.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStatusColor(status: string, policeEscalated: boolean) {
  if (status === 'RESOLVED') return T.success;
  if (status === 'CANCELLED') return T.ink4;
  if (status === 'ESCALATED' || policeEscalated) return '#E25B3A';
  return T.violet;
}

function IncidentSummaryCard({ inc, onPress }: { inc: MockIncident, onPress: () => void }) {
  const color = getStatusColor(inc.status, inc.policeEscalated);
  const displayStatus = inc.status === 'ACTIVE' && inc.policeEscalated ? 'POLICE ASSISTANCE REQUEST' : inc.status;

  return (
    <TouchableOpacity style={isc.card} activeOpacity={0.7} onPress={onPress}>
      <View style={isc.topRow}>
        <Text style={isc.idTxt}>{inc.id}</Text>
        <Text style={[isc.statusTxt, { color }]}>{displayStatus}</Text>
      </View>
      <View style={isc.botRow}>
        <View style={isc.infoRow}>
          <Feather name="map-pin" size={12} color={T.ink4} />
          <Text style={isc.infoTxt}>{inc.location}</Text>
        </View>
        <Text style={isc.infoTxt}>· {inc.time}</Text>
      </View>
    </TouchableOpacity>
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
    backgroundColor: T.violetDim, borderWidth: 1, borderColor: 'rgba(138,56,246,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: T.ink4, marginTop: 2 },
  tabsWrap: { marginBottom: 16 },
  tabsScroll: { gap: 10, paddingRight: 20 },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: T.lineMid, backgroundColor: T.surfaceCard,
  },
  tabTxt: { fontSize: 13, fontWeight: '600', color: T.ink4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});

const uc = StyleSheet.create({
  card: {
    backgroundColor: T.surfaceCard, borderRadius: 14,
    borderWidth: 1, borderColor: T.lineMid, padding: 16,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoWrap: { marginLeft: 12, flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: T.ink, marginBottom: 4 },
  badgeStd: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeTxtStd: { fontSize: 10, fontWeight: '600', color: T.ink3 },
  badgeVol: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.safeLight, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeTxtVol: { fontSize: 10, fontWeight: '700', color: T.success },
  statsRow: { marginTop: 12, gap: 4 },
  statsTxt: { fontSize: 12, color: T.ink3 },
  statsVal: { fontWeight: '700', color: T.ink },
});

const isc = StyleSheet.create({
  card: {
    backgroundColor: '#0F1020', borderRadius: 12, borderWidth: 1, borderColor: T.lineMid,
    padding: 14, marginBottom: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  idTxt: { fontSize: 13, fontWeight: '800', color: T.violet },
  statusTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoTxt: { fontSize: 12, color: T.ink4 },
});

const md = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '100%', maxWidth: 500, maxHeight: '85%', backgroundColor: '#060610', borderRadius: 20, borderWidth: 1, borderColor: T.lineMid, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: '#0F1020' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: T.ink },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.surfaceCard, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20 },
  
  profileHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  profileInfo: { marginLeft: 16, flex: 1, gap: 6 },
  profileName: { fontSize: 18, fontWeight: '800', color: T.ink },
  phoneTxt: { fontSize: 13, color: T.ink3, marginTop: 4 },
  statsTxt: { fontSize: 12, color: T.ink3, marginTop: 4 },
  blockBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.dangerLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 8 },
  blockTxt: { fontSize: 12, fontWeight: '700', color: T.danger },

  section: { backgroundColor: T.surfaceCard, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: T.lineMid },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: T.ink4, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  emptyTxt: { fontSize: 13, color: T.ink4, fontStyle: 'italic' },
  
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  detailLbl: { fontSize: 13, color: T.ink4 },
  detailVal: { fontSize: 13, fontWeight: '600', color: T.ink },
  
  volunteerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  volunteerName: { fontSize: 14, fontWeight: '600', color: T.ink, marginLeft: 12 },
});
