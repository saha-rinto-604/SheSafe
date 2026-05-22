import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../constants/theme';
import UserAvatar from '../shared/UserAvatar';
import { MOCK_SAFE_PLACES, type MockSafePlaceRequest } from '../../data/adminMockData';
import { useToast } from '../Toast';
import { AnimatedListItem } from '../shared/AnimatedListItem';

export function SafePlacesWorkspace({ insetsBottom }: { insetsBottom: number }) {
  const [selectedRequest, setSelectedRequest] = useState<MockSafePlaceRequest | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  
  // Track actions locally for UI
  const [actionedRequests, setActionedRequests] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({});

  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidthStyle = isMobile ? { width: '100%' as const } : { width: 300 };

  const handleApprove = () => {
    if (selectedRequest) {
      const id = selectedRequest.id;
      setActionedRequests(prev => ({ ...prev, [id]: 'APPROVED' }));
      
      showToast({
        type: 'success',
        title: 'Safe Place Approved',
        message: `${selectedRequest.placeName} has been approved.`,
      });
      
      // Close modal first
      setSelectedRequest(null);
      
      // Start removing animation
      setTimeout(() => {
        setRemovingIds(prev => new Set(prev).add(id));
      }, 300);
    }
  };

  const handleReject = () => {
    if (selectedRequest) {
      const id = selectedRequest.id;
      setActionedRequests(prev => ({ ...prev, [id]: 'REJECTED' }));
      
      showToast({
        type: 'info',
        title: 'Safe Place Rejected',
        message: `${selectedRequest.placeName} request was rejected.`,
      });
      
      // Close modal first
      setSelectedRequest(null);
      
      // Start removing animation
      setTimeout(() => {
        setRemovingIds(prev => new Set(prev).add(id));
      }, 300);
    }
  };

  return (
    <View style={st.container}>
      {/* Workspace Header */}
      <View style={st.header}>
        <View style={st.headerIcon}>
          <Feather name="map-pin" size={20} color={T.violet} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Safe Places Moderation</Text>
          <Text style={st.subtitle}>Review and approve community-submitted safe locations</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.grid, { paddingBottom: insetsBottom + 30 }]}
      >
        {MOCK_SAFE_PLACES.filter(req => {
          const action = actionedRequests[req.id] || req.status;
          return action === 'PENDING' || removingIds.has(req.id);
        }).map((req, index) => {
          const action = actionedRequests[req.id] || req.status;
          const isRemoving = removingIds.has(req.id);
          
          return (
            <AnimatedListItem key={req.id} index={index} isRemoving={isRemoving}>
              <TouchableOpacity 
                style={[uc.card, cardWidthStyle]} 
                activeOpacity={0.7} 
                onPress={() => setSelectedRequest(req)}
              >
                <View style={uc.topRow}>
                  <View style={uc.infoWrap}>
                    <Text style={uc.placeName}>{req.placeName}</Text>
                    <View style={uc.locationRow}>
                      <Feather name="map-pin" size={12} color={T.ink4} />
                      <Text style={uc.locationTxt}>{req.location}</Text>
                    </View>
                  </View>
                  {action === 'APPROVED' ? (
                    <Feather name="check-circle" size={18} color={T.success} />
                  ) : action === 'REJECTED' ? (
                    <Feather name="x-circle" size={18} color={T.danger} />
                  ) : null}
                </View>
                
                <View style={uc.divider} />
                
                <View style={uc.botRow}>
                  <View style={uc.requesterInfo}>
                    <Text style={uc.requesterLabel}>Requested by</Text>
                    <Text style={uc.requesterName}>{req.requestedBy}</Text>
                  </View>
                  {req.userType === 'Standard User' ? (
                    <View style={uc.badgeStd}>
                      <Text style={uc.badgeTxtStd}>Standard User</Text>
                    </View>
                  ) : (
                    <View style={uc.badgeVol}>
                      <Feather name="shield" size={10} color={T.success} />
                      <Text style={uc.badgeTxtVol}>Volunteer</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          );
        })}
      </ScrollView>

      {/* Safe Place Details Modal */}
      <Modal visible={!!selectedRequest} transparent animationType="slide" onRequestClose={() => setSelectedRequest(null)}>
        <View style={md.overlay}>
          <View style={md.container}>
            {selectedRequest && (() => {
              const actionStatus = actionedRequests[selectedRequest.id] || selectedRequest.status;
              
              return (
                <>
                  <View style={md.header}>
                    <Text style={md.headerTitle}>Safe Place Request</Text>
                    <TouchableOpacity onPress={() => setSelectedRequest(null)} style={md.closeBtn}>
                      <Feather name="x" size={20} color={T.ink3} />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView contentContainerStyle={md.scrollContent}>
                    {/* Requester Profile Section */}
                    <View style={md.profileHeader}>
                      <UserAvatar size={56} />
                      <View style={md.profileInfo}>
                        <Text style={md.profileName}>{selectedRequest.requestedBy}</Text>
                        {selectedRequest.userType === 'Standard User' ? (
                          <View style={uc.badgeStd}><Text style={uc.badgeTxtStd}>Standard User</Text></View>
                        ) : (
                          <View style={uc.badgeVol}>
                            <Feather name="shield" size={10} color={T.success} />
                            <Text style={uc.badgeTxtVol}>Volunteer</Text>
                          </View>
                        )}
                        <Text style={md.dateTxt}>Submitted {selectedRequest.date}</Text>
                      </View>
                    </View>

                    {/* Safe Place Details Section */}
                    <View style={md.section}>
                      <Text style={md.sectionTitle}>Place Information</Text>
                      
                      <Text style={md.placeName}>{selectedRequest.placeName}</Text>
                      
                      <View style={md.detailRow}>
                        <Feather name="map-pin" size={16} color={T.ink4} style={{ marginTop: 2 }} />
                        <Text style={md.detailVal}>{selectedRequest.location}</Text>
                      </View>
                      
                      <View style={md.detailRow}>
                        <Feather name="info" size={16} color={T.ink4} style={{ marginTop: 2 }} />
                        <Text style={md.detailVal}>{selectedRequest.description}</Text>
                      </View>
                    </View>

                    {/* Action Area */}
                    <View style={md.actionArea}>
                      {actionStatus === 'PENDING' ? (
                        <View style={md.actionButtons}>
                          <TouchableOpacity style={md.rejectBtn} onPress={handleReject} activeOpacity={0.7}>
                            <Feather name="x" size={18} color={T.danger} />
                            <Text style={md.rejectTxt}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={md.approveBtn} onPress={handleApprove} activeOpacity={0.7}>
                            <Feather name="check" size={18} color="#FFF" />
                            <Text style={md.approveTxt}>Approve Place</Text>
                          </TouchableOpacity>
                        </View>
                      ) : actionStatus === 'APPROVED' ? (
                        <View style={md.successBox}>
                          <Feather name="check-circle" size={20} color={T.success} />
                          <Text style={md.successTxt}>This place has been added as a Safe Place.</Text>
                        </View>
                      ) : (
                        <View style={md.rejectBox}>
                          <Feather name="x-circle" size={20} color={T.danger} />
                          <Text style={md.rejectedTxt}>This safe place request was rejected.</Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
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
    backgroundColor: T.violetDim, borderWidth: 1, borderColor: 'rgba(138,56,246,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: T.ink4, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});

const uc = StyleSheet.create({
  card: {
    backgroundColor: T.surfaceCard, borderRadius: 14,
    borderWidth: 1, borderColor: T.lineMid, padding: 16,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  infoWrap: { flex: 1, paddingRight: 10 },
  placeName: { fontSize: 16, fontWeight: '700', color: T.ink, marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationTxt: { fontSize: 12, color: T.ink4 },
  
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 12 },
  
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requesterInfo: { flexDirection: 'column' },
  requesterLabel: { fontSize: 11, color: T.ink4, marginBottom: 2 },
  requesterName: { fontSize: 13, fontWeight: '600', color: T.ink },
  
  badgeStd: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeTxtStd: { fontSize: 10, fontWeight: '600', color: T.ink3 },
  badgeVol: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.safeLight, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeTxtVol: { fontSize: 10, fontWeight: '700', color: T.success },
});

const md = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '100%', maxWidth: 500, maxHeight: '85%', backgroundColor: '#060610', borderRadius: 20, borderWidth: 1, borderColor: T.lineMid, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: '#0F1020' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: T.ink },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.surfaceCard, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20 },
  
  profileHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  profileInfo: { marginLeft: 16, flex: 1, gap: 6, alignItems: 'flex-start' },
  profileName: { fontSize: 18, fontWeight: '800', color: T.ink },
  dateTxt: { fontSize: 12, color: T.ink4, marginTop: 4 },

  section: { backgroundColor: T.surfaceCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.lineMid },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: T.ink4, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  
  placeName: { fontSize: 18, fontWeight: '700', color: T.ink, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  detailVal: { flex: 1, fontSize: 14, color: T.ink3, lineHeight: 20 },
  
  actionArea: { marginTop: 10 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.danger, paddingVertical: 14, borderRadius: 12 },
  rejectTxt: { fontSize: 15, fontWeight: '700', color: T.danger },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.success, paddingVertical: 14, borderRadius: 12 },
  approveTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.safeLight, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(24,204,117,0.2)' },
  successTxt: { fontSize: 14, fontWeight: '600', color: T.success },
  
  rejectBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.dangerLight, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(226,91,58,0.2)' },
  rejectedTxt: { fontSize: 14, fontWeight: '600', color: T.danger },
});
