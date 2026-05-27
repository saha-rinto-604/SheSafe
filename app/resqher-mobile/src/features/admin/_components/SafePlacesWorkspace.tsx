import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../constants/theme';
import UserAvatar from '../../../components/shared/UserAvatar';
import { type MockSafePlaceRequest } from '../_data/adminMockData';
import { useToast } from '../../../components/Toast';
import { AnimatedListItem } from './AnimatedListItem';
import adminService from '../../../services/adminService';

type SafePlaceTab = 'PENDING' | 'CONFIRMED';

export function SafePlacesWorkspace({ insetsBottom }: { insetsBottom: number }) {
  const [requests, setRequests] = useState<MockSafePlaceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<SafePlaceTab>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<MockSafePlaceRequest | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [rejectingRequest, setRejectingRequest] = useState<MockSafePlaceRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidthStyle = isMobile ? { width: '100%' as const } : { width: 300 };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await adminService.getSafePlaces(activeTab);
      setRequests(items.filter((item) => activeTab === 'PENDING' ? item.status === 'PENDING' : item.status === 'APPROVED'));
    } catch (err: any) {
      setError(err?.message || 'Could not load safe places.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const removeRequest = (id: string) => {
    setRemovingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setRequests(prev => prev.filter(req => req.id !== id));
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 250);
  };

  const handleApprove = async () => {
    if (selectedRequest) {
      const id = selectedRequest.id;
      setLoading(true);
    try {
        await adminService.approveSafePlace(id);
        showToast({
          type: 'success',
          title: 'Safe Place Approved',
          message: `${selectedRequest.placeName} has been approved.`,
        });
        setSelectedRequest(null);
        removeRequest(id);
      } catch (err: any) {
        showToast({ type: 'error', title: 'Approval Failed', message: err?.message || 'Please try again.' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleReject = () => {
    if (selectedRequest) {
      setRejectingRequest(selectedRequest);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingRequest) return;
    const cleanReason = rejectionReason.trim();
    if (!cleanReason) {
      showToast({ type: 'warning', title: 'Reason Required', message: 'Please enter a rejection reason.' });
      return;
    }

    const id = rejectingRequest.id;
    const placeName = rejectingRequest.placeName;
    setRejectingRequest(null);
    setSelectedRequest(null);
    setRejectionReason('');
    setLoading(true);
    try {
      await adminService.rejectSafePlace(id, cleanReason);
      showToast({
        type: 'info',
        title: 'Safe Place Rejected',
        message: `${placeName} request was rejected.`,
      });
      removeRequest(id);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Rejection Failed', message: err?.message || 'Please try again.' });
    } finally {
      setLoading(false);
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

      <View style={st.tabs}>
        {([
          { key: 'PENDING', label: 'Pending Requests' },
          { key: 'CONFIRMED', label: 'Approved Safe Places' },
        ] as const).map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[st.tabBtn, active && st.tabBtnActive]}
              onPress={() => {
                setSelectedRequest(null);
                setActiveTab(tab.key);
              }}
              activeOpacity={0.8}
            >
              <Text style={[st.tabTxt, active && st.tabTxtActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.grid, { paddingBottom: insetsBottom + 30 }]}
      >
        {loading ? (
          <View style={st.emptyState}>
            <Text style={st.emptyText}>Loading safe places...</Text>
          </View>
        ) : error ? (
          <TouchableOpacity style={st.emptyState} onPress={loadRequests} activeOpacity={0.8}>
            <Feather name="alert-circle" size={42} color={T.danger} />
            <Text style={st.emptyText}>{error}</Text>
          </TouchableOpacity>
        ) : requests.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="check-circle" size={42} color={T.ink4} />
            <Text style={st.emptyText}>
              {activeTab === 'PENDING' ? 'No pending safe place requests' : 'No approved safe places yet'}
            </Text>
          </View>
        ) : requests.map((req, index) => {
          const action = req.status;
          const isRemoving = removingIds.has(req.id);
          
          return (
            <AnimatedListItem key={req.id} index={index} isRemoving={isRemoving} style={cardWidthStyle}>
              <TouchableOpacity 
                style={uc.card} 
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
                {activeTab === 'CONFIRMED' && (
                  <Text style={uc.approvedMeta}>
                    Approved {req.reviewedAt || 'recently'}{req.reviewedBy ? ` by ${req.reviewedBy}` : ''}
                  </Text>
                )}
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
              const actionStatus = selectedRequest.status;
              return (
                <>
                  <View style={md.header}>
                    <Text style={md.headerTitle}>
                      {actionStatus === 'APPROVED' ? 'Approved Safe Place' : 'Safe Place Request'}
                    </Text>
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
                        {selectedRequest.reviewedAt && (
                          <Text style={md.dateTxt}>
                            Approved {selectedRequest.reviewedAt}{selectedRequest.reviewedBy ? ` by ${selectedRequest.reviewedBy}` : ''}
                          </Text>
                        )}
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

      <Modal visible={!!rejectingRequest} transparent animationType="fade" onRequestClose={() => setRejectingRequest(null)}>
        <View style={md.overlay}>
          <View style={md.rejectDialog}>
            <Text style={md.rejectTitle}>Reject Safe Place</Text>
            <Text style={md.rejectSub}>Add a reason for rejecting {rejectingRequest?.placeName}.</Text>
            <TextInput
              style={md.rejectInput}
              placeholder="Reason for rejection"
              placeholderTextColor={T.ink4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
            />
            <View style={md.rejectActions}>
              <TouchableOpacity style={md.cancelBtn} onPress={() => setRejectingRequest(null)}>
                <Text style={md.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={md.confirmRejectBtn} onPress={handleRejectConfirm}>
                <Text style={md.confirmRejectTxt}>Reject</Text>
              </TouchableOpacity>
            </View>
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
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  tabBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: T.lineMid,
    backgroundColor: T.surfaceCard,
  },
  tabBtnActive: { backgroundColor: T.violetDim, borderColor: 'rgba(138,56,246,0.55)' },
  tabTxt: { color: T.ink4, fontSize: 12, fontWeight: '800' },
  tabTxtActive: { color: T.violet },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  emptyState: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 56 },
  emptyText: { marginTop: 10, color: T.ink4, fontSize: 14, fontWeight: '600', textAlign: 'center' },
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
  approvedMeta: { marginTop: 10, fontSize: 11, color: T.success, fontWeight: '700' },
  
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
  rejectDialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F1020',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: T.lineMid,
  },
  rejectTitle: { fontSize: 18, fontWeight: '800', color: T.ink, marginBottom: 8 },
  rejectSub: { fontSize: 14, color: T.ink3, marginBottom: 14, lineHeight: 20 },
  rejectInput: {
    minHeight: 90,
    backgroundColor: T.surfaceCard,
    borderWidth: 1,
    borderColor: T.lineMid,
    borderRadius: 12,
    padding: 12,
    color: T.ink,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  rejectActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelTxt: { color: T.ink3, fontSize: 14, fontWeight: '700' },
  confirmRejectBtn: { backgroundColor: T.danger, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  confirmRejectTxt: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
