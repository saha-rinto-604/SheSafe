import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Image, Platform, Dimensions, useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Ty, R } from '../../constants/theme';
import { MOCK_VERIFICATIONS, type MockVerification } from '../../data/adminMockData';
import UserAvatar from '../shared/UserAvatar';
import { useToast } from '../Toast';
import { AnimatedListItem } from '../shared/AnimatedListItem';

type Props = {
  insetsBottom?: number;
};

export function VerificationsWorkspace({ insetsBottom = 0 }: Props) {
  const { showToast } = useToast();
  const [verifications, setVerifications] = useState<MockVerification[]>(MOCK_VERIFICATIONS);
  
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

  const handleApprove = (item: MockVerification) => {
    setSelectedVerification(null);
    setRemovingIds(prev => new Set(prev).add(item.id));
    showToast({
      type: 'success',
      title: 'Volunteer Approved',
      message: `${item.name} has been verified successfully.`,
    });
    
    // Remove after animation completes
    setTimeout(() => {
      setVerifications(prev => prev.filter(v => v.id !== item.id));
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 250);
  };

  const handleRejectInit = (item: MockVerification) => {
    setRejectingVerification(item);
  };

  const handleRejectConfirm = () => {
    if (!rejectingVerification) return;
    
    const idToRemove = rejectingVerification.id;
    const name = rejectingVerification.name;
    
    setRejectingVerification(null);
    setRejectionReason('');
    setSelectedVerification(null);
    
    setRemovingIds(prev => new Set(prev).add(idToRemove));
    
    showToast({
      type: 'info',
      title: 'Application Rejected',
      message: `${name}'s verification was rejected.`,
    });
    
    setTimeout(() => {
      setVerifications(prev => prev.filter(v => v.id !== idToRemove));
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(idToRemove);
        return next;
      });
    }, 250);
  };

  return (
    <View style={[st.container, { paddingBottom: insetsBottom }]}>
      <View style={st.header}>
        <Text style={st.title}>Volunteer Verifications</Text>
        <Text style={st.subtitle}>Review and approve pending volunteer applications.</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.listContent}>
        {verifications.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="check-circle" size={48} color={T.ink4} />
            <Text style={st.emptyText}>No pending verifications</Text>
          </View>
        ) : (
          verifications.map((item, index) => (
            <AnimatedListItem key={item.id} index={index} isRemoving={removingIds.has(item.id)}>
              <TouchableOpacity 
                style={[st.card, cardWidthStyle]} 
                activeOpacity={0.8}
                onPress={() => setSelectedVerification(item)}
              >
                <View style={st.cardRow}>
                  <UserAvatar size={44} />
                  <View style={st.cardInfo}>
                    <Text style={st.cardName}>{item.name}</Text>
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
                    </View>
                  </View>

                  <View style={st.divider} />

                  {/* Documents */}
                  <Text style={st.sectionTitle}>Provided Documents</Text>

                  {/* NOTE FOR USER: Add your images to 'assets/images/' and replace these URIs with:
                      source={require('../../../assets/images/id_card.png')}
                      source={require('../../../assets/images/selfie.png')}
                      source={require('../../../assets/images/certificate.png')}
                  */}
                  <View style={st.docItem}>
                    <Text style={st.docLabel}>ID Card Image</Text>
                    <Image source={require('../../../assets/images/id_card.jpg')} style={st.docImage} resizeMode="contain" />
                  </View>

                  <View style={st.docItem}>
                    <Text style={st.docLabel}>Selfie With ID</Text>
                    <Image source={require('../../../assets/images/selfie.webp')} style={st.docImage} resizeMode="contain" />
                  </View>

                  {selectedVerification.certificateUrl && (
                    <View style={st.docItem}>
                      <Text style={st.docLabel}>Certificates (Optional)</Text>
                      <Image source={require('../../../assets/images/certificate.jpg')} style={st.docImage} resizeMode="contain" />
                    </View>
                  )}
                  
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
              Are you sure you want to reject {rejectingVerification?.name}'s application?
            </Text>
            
            <TextInput
              style={st.rejectInput}
              placeholder="Reason for rejection (Optional)"
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
    borderBottomColor: T.lineMicro,
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
  
  divider: { height: 1, backgroundColor: T.lineMicro, marginVertical: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: T.violet, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  docItem: { marginBottom: 24 },
  docLabel: { fontSize: 14, fontWeight: '600', color: T.ink, marginBottom: 10 },
  docImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: T.lineMicro,
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
