import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Dimensions, useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Ty, R } from '../../../constants/theme';
import { type MockVerification } from '../_data/adminMockData';
import UserAvatar from '../../../components/shared/UserAvatar';
import { useToast } from '../../../components/Toast';
import { AnimatedListItem } from './AnimatedListItem';
import adminService from '../../../services/adminService';
import VerificationDocumentViewer from './VerificationDocumentViewer';

type Props = {
  insetsBottom?: number;
};

export function VerificationsWorkspace({ insetsBottom = 0 }: Props) {
  const { showToast } = useToast();
  const [verifications, setVerifications] = useState<MockVerification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selection state
  const [selectedVerification, setSelectedVerification] = useState<MockVerification | null>(null);

  // Track removing items
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Rejection modal state
  const [rejectingVerification, setRejectingVerification] = useState<MockVerification | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidthStyle = isMobile ? { width: '100%' as const } : { width: 340 };

  const loadVerifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await adminService.getVerifications('pending');
      setVerifications(items);
    } catch (err: any) {
      setError(err?.message || 'Could not load verifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVerifications();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadVerifications]);

  const removeVerification = (id: string) => {
    setRemovingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setVerifications(prev => prev.filter(v => v.id !== id));
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 250);
  };

  const handleApprove = async (item: MockVerification) => {
    setLoading(true);
    setSelectedVerification(null);
    try {
      if (item.kind === 'police') {
        await adminService.approvePoliceVerification(item.userId || item.id.replace(/^police-/, ''));
      } else {
        await adminService.approveVerification(item.id);
      }
      showToast({
        type: 'success',
        title: item.kind === 'police' ? 'Police Approved' : 'Volunteer Approved',
        message: `${item.name} has been verified successfully.`,
      });
      removeVerification(item.id);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Approval Failed', message: err?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectInit = (item: MockVerification) => {
    setRejectingVerification(item);
  };

  const handleRejectConfirm = async () => {
    if (!rejectingVerification) return;
    const cleanReason = rejectionReason.trim();
    if (!cleanReason) {
      showToast({ type: 'warning', title: 'Reason Required', message: 'Please enter a rejection reason.' });
      return;
    }

    const idToRemove = rejectingVerification.id;
    const name = rejectingVerification.name;

    setRejectingVerification(null);
    setRejectionReason('');
    setSelectedVerification(null);
    setLoading(true);
    try {
      if (rejectingVerification.kind === 'police') {
        await adminService.rejectPoliceVerification(
          rejectingVerification.userId || rejectingVerification.id.replace(/^police-/, ''),
          cleanReason
        );
      } else {
        await adminService.rejectVerification(idToRemove, cleanReason);
      }
      showToast({
        type: 'info',
        title: 'Application Rejected',
        message: `${name}'s verification was rejected.`,
      });
      removeVerification(idToRemove);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Rejection Failed', message: err?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[st.container, { paddingBottom: insetsBottom }]}>
      <View style={st.header}>
        <Text style={st.title}>Pending Verifications</Text>
        <Text style={st.subtitle}>Review volunteer and police/law enforcement applications.</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.listContent}>
        {loading ? (
          <View style={st.emptyState}>
            <Text style={st.emptyText}>Loading verifications...</Text>
          </View>
        ) : error ? (
          <TouchableOpacity style={st.emptyState} onPress={loadVerifications} activeOpacity={0.8}>
            <Feather name="alert-circle" size={48} color={T.danger} />
            <Text style={st.emptyText}>{error}</Text>
          </TouchableOpacity>
        ) : verifications.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="check-circle" size={48} color={T.ink4} />
            <Text style={st.emptyText}>No pending verifications</Text>
          </View>
        ) : (
          verifications.map((item, index) => (
            <AnimatedListItem key={item.id} index={index} isRemoving={removingIds.has(item.id)} style={cardWidthStyle}>
              <TouchableOpacity
                style={st.card}
                activeOpacity={0.8}
                onPress={() => setSelectedVerification(item)}
              >
                <View style={st.cardRow}>
                  <UserAvatar size={44} />
                  <View style={st.cardInfo}>
                    <Text style={st.cardName}>{item.name}</Text>
                    <Text style={st.typeBadgeText}>{item.typeLabel || 'Volunteer Verification'}</Text>
                    <Text style={st.cardSub}>Submitted {item.submitted}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={T.ink4} />
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>

      {/* Verification Details Modal */}
      <Modal
        visible={!!selectedVerification}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedVerification(null)}
      >
        <View style={st.modalOverlay}>
          <View style={st.detailsModalContent}>
            {selectedVerification && (
              <>
                <View style={st.modalHeader}>
                  <Text style={st.modalTitle}>Verification Details</Text>
                  <TouchableOpacity onPress={() => setSelectedVerification(null)} style={st.closeBtn}>
                    <Feather name="x" size={20} color={T.ink3} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={st.modalScroll} showsVerticalScrollIndicator={false}>
                  {/* User Info */}
                  <View style={st.detailsUserInfo}>
                    <UserAvatar size={60} />
                    <View style={st.detailsUserText}>
                      <Text style={st.detailsName}>{selectedVerification.name}</Text>
                      <Text style={st.detailsPhone}>{selectedVerification.phone}</Text>
                      <Text style={st.typeBadgeText}>{selectedVerification.typeLabel || 'Volunteer Verification'}</Text>
                    </View>
                  </View>

                  {selectedVerification.kind === 'police' && (
                    <View style={st.policeInfoBox}>
                      <Text style={st.infoLine}>Unit: {selectedVerification.policeStationOrUnit || 'Not provided'}</Text>
                      <Text style={st.infoLine}>Badge / Job ID: {selectedVerification.badgeNumber || 'Not provided'}</Text>
                    </View>
                  )}

                  <View style={st.divider} />

                  {/* Documents */}
                  <Text style={st.sectionTitle}>Provided Documents</Text>
                  <VerificationDocumentViewer
                    documents={[
                      { label: 'ID Card Image', uri: selectedVerification.idCardUrl, required: true },
                      { label: 'Selfie With ID', uri: selectedVerification.selfieUrl, required: true },
                      {
                        label: selectedVerification.kind === 'police'
                          ? 'Police Job Certificate / Job ID Card'
                          : 'Certificates',
                        uri: selectedVerification.jobIdCardUrl || selectedVerification.certificateUrl,
                        required: selectedVerification.kind === 'police',
                      },
                    ]}
                  />

                  <View style={{ height: 40 }} />
                </ScrollView>

                <View style={st.modalFooter}>
                  <TouchableOpacity
                    style={[st.actionBtn, st.btnReject]}
                    activeOpacity={0.8}
                    onPress={() => handleRejectInit(selectedVerification)}
                  >
                    <Feather name="x" size={18} color={T.danger} />
                    <Text style={[st.actionBtnTxt, { color: T.danger }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.actionBtn, st.btnApprove]}
                    activeOpacity={0.8}
                    onPress={() => handleApprove(selectedVerification)}
                  >
                    <Feather name="check" size={18} color="#FFF" />
                    <Text style={[st.actionBtnTxt, { color: '#FFF' }]}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        visible={!!rejectingVerification}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setRejectingVerification(null)}
      >
        <View style={st.modalOverlay}>
          <View style={st.rejectModalContent}>
            <Text style={st.rejectTitle}>Reject Verification</Text>
            <Text style={st.rejectSub}>
              Are you sure you want to reject {rejectingVerification?.name}{'\''}s application?
            </Text>

            <TextInput
              style={st.rejectInput}
              placeholder="Reason for rejection"
              placeholderTextColor={T.ink4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
            />

            <View style={st.rejectActions}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setRejectingVerification(null)}>
                <Text style={st.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.confirmRejectBtn} onPress={handleRejectConfirm}>
                <Text style={st.confirmRejectTxt}>Confirm Reject</Text>
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
  header: { marginBottom: 20 },
  title: { ...Ty.h2, color: T.ink },
  subtitle: { fontSize: 14, color: T.ink3, marginTop: 4 },

  listContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, width: '100%' },
  emptyText: { fontSize: 15, color: T.ink4, marginTop: 12, fontWeight: '500' },

  card: {
    backgroundColor: '#0F1020',
    borderRadius: R.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: T.lineMid,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardInfo: { marginLeft: 14, flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: T.ink },
  cardSub: { fontSize: 13, color: T.ink4, marginTop: 2 },
  typeBadgeText: { fontSize: 11, color: T.violet, fontWeight: '900', marginTop: 3 },

  // Detail Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  detailsModalContent: {
    backgroundColor: '#0F1020',
    borderRadius: 24,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: T.lineMid,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: T.lineMid,
    backgroundColor: 'rgba(138,56,246,0.03)',
  },
  modalTitle: { ...Ty.h3, color: T.ink },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalScroll: { padding: 20 },

  detailsUserInfo: { flexDirection: 'row', alignItems: 'center' },
  detailsUserText: { marginLeft: 16, flex: 1 },
  detailsName: { fontSize: 18, fontWeight: '800', color: T.ink },
  detailsPhone: { fontSize: 14, color: T.ink3, marginTop: 4 },
  policeInfoBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: T.surfaceCard,
    borderWidth: 1,
    borderColor: T.lineMid,
    gap: 4,
  },
  infoLine: { fontSize: 13, color: T.ink3, fontWeight: '700' },

  divider: { height: 1, backgroundColor: T.lineMid, marginVertical: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: T.violet, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },

  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: T.lineMid,
    backgroundColor: '#0F1020',
    gap: 12,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  btnReject: { backgroundColor: T.dangerLight },
  btnApprove: { backgroundColor: T.success },
  actionBtnTxt: { fontSize: 15, fontWeight: '700' },

  // Reject Modal
  rejectModalContent: {
    backgroundColor: T.surfaceBulkyGlass,
    margin: 24,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: T.lineMid,
    marginBottom: Dimensions.get('window').height * 0.2,
  },
  rejectTitle: { fontSize: 18, fontWeight: '800', color: T.ink, marginBottom: 8 },
  rejectSub: { fontSize: 14, color: T.ink3, marginBottom: 16, lineHeight: 20 },
  rejectInput: {
    backgroundColor: T.surfaceCard,
    borderWidth: 1,
    borderColor: T.lineMid,
    borderRadius: 12,
    padding: 12,
    color: T.ink,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  rejectActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelTxt: { color: T.ink3, fontSize: 14, fontWeight: '600' },
  confirmRejectBtn: {
    backgroundColor: T.danger,
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmRejectTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
