import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../constants/theme';
import UserAvatar from '../shared/UserAvatar';
import { MOCK_REPORTS, type MockReport } from '../../data/adminMockData';
import { AnimatedListItem } from '../shared/AnimatedListItem';
import { useToast } from '../Toast';
import { Animated } from 'react-native';

type TabType = 'Recent Reports' | 'All Reports';
type ActionType = 'DISMISSED' | 'WARNED' | 'BLOCKED';

export function ReportsWorkspace({ insetsBottom }: { insetsBottom: number }) {
  const [activeTab, setActiveTab] = useState<TabType>('Recent Reports');
  const [selectedReport, setSelectedReport] = useState<MockReport | null>(null);
  
  // Track actions locally
  const [actionedReports, setActionedReports] = useState<Record<string, ActionType>>({});
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const { showToast } = useToast();

  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidthStyle = isMobile ? { width: '100%' as const } : { width: 340 };

  const handleAction = (action: ActionType) => {
    if (selectedReport) {
      const id = selectedReport.id;
      setActionedReports(prev => ({ ...prev, [id]: action }));
      
      showToast({
        type: 'success',
        title: 'Action Taken',
        message: `Report has been marked as ${action.toLowerCase()}.`,
      });

      // Wait to let user see success state before closing
      setTimeout(() => {
        setSelectedReport(null);
        if (activeTab === 'Recent Reports') {
          setRemovingIds(prev => new Set(prev).add(id));
          // Reset removing flag later to allow it to show in All Reports
          setTimeout(() => {
            setRemovingIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }, 300);
        }
      }, 800);
    }
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();
    setTimeout(() => setActiveTab(tab), 100);
  };

  const recentReports = MOCK_REPORTS.filter(r => !actionedReports[r.id] || removingIds.has(r.id));
  const allReports = MOCK_REPORTS.filter(r => actionedReports[r.id]);

  const displayedReports = activeTab === 'Recent Reports' ? recentReports : allReports;

  return (
    <View style={st.container}>
      {/* Workspace Header */}
      <View style={st.header}>
        <View style={st.headerIcon}>
          <Feather name="file-text" size={20} color={T.violet} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>User Reports</Text>
          <Text style={st.subtitle}>Moderation and abuse management</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={st.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsScroll}>
          {(['Recent Reports', 'All Reports'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[st.tabBtn, isActive && { borderColor: T.violet, backgroundColor: T.violetDim }]}
                onPress={() => handleTabChange(tab)}
                activeOpacity={0.7}
              >
                <Text style={[st.tabTxt, isActive && { color: T.violet }]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.grid, { paddingBottom: insetsBottom + 30 }]}
        style={{ opacity: fadeAnim }}
      >
        {displayedReports.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="check-circle" size={40} color={T.ink4} />
            <Text style={st.emptyText}>No reports found in this section.</Text>
          </View>
        ) : (
          displayedReports.map((report, index) => {
            const action = actionedReports[report.id];
            const isRemoving = activeTab === 'Recent Reports' && removingIds.has(report.id);
            return (
              <AnimatedListItem key={`${report.id}-${activeTab}`} index={index} isRemoving={isRemoving}>
                <TouchableOpacity 
                  style={[rc.card, cardWidthStyle]} 
                  activeOpacity={0.7} 
                  onPress={() => setSelectedReport(report)}
                >
                  <View style={rc.topRow}>
                    <View style={rc.infoWrap}>
                      <Text style={rc.label}>Reported User</Text>
                      <Text style={rc.name}>{report.reported}</Text>
                    </View>
                    {action && (
                      <View style={rc.statusBadge}>
                        <Text style={rc.statusTxt}>{action}</Text>
                      </View>
                    )}
                  </View>

                  <View style={rc.botRow}>
                    <View style={rc.infoWrap}>
                      <Text style={rc.label}>Reported By</Text>
                      <Text style={rc.subTxt}>{report.by}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={rc.label}>Date</Text>
                      <Text style={rc.subTxt}>{report.date}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            );
          })
        )}
      </Animated.ScrollView>

      {/* Report Details Modal */}
      <Modal visible={!!selectedReport} transparent animationType="slide" onRequestClose={() => setSelectedReport(null)}>
        <View style={md.overlay}>
          <View style={md.container}>
            {selectedReport && (() => {
              const actionStatus = actionedReports[selectedReport.id];
              return (
                <>
                  <View style={md.header}>
                    <Text style={md.headerTitle}>Report Details</Text>
                    <TouchableOpacity onPress={() => setSelectedReport(null)} style={md.closeBtn}>
                      <Feather name="x" size={20} color={T.ink3} />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView contentContainerStyle={md.scrollContent}>
                    {/* Reporter & Reported Info */}
                    <View style={md.usersSection}>
                      <View style={md.userBox}>
                        <Text style={md.userLabel}>Reported User</Text>
                        <View style={md.userRow}>
                          <UserAvatar size={40} />
                          <Text style={md.userName}>{selectedReport.reported}</Text>
                        </View>
                      </View>
                      
                      <View style={md.arrowBox}>
                        <Feather name="arrow-left" size={16} color={T.danger} />
                      </View>
                      
                      <View style={md.userBox}>
                        <Text style={md.userLabel}>Reported By</Text>
                        <View style={md.userRow}>
                          <UserAvatar size={40} />
                          <Text style={md.userName}>{selectedReport.by}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Report Reason & Details */}
                    <View style={md.section}>
                      <Text style={md.sectionTitle}>Incident Details</Text>
                      
                      <View style={md.detailRowCol}>
                        <Text style={md.detailLbl}>Reason</Text>
                        <Text style={md.detailValLeft}>{selectedReport.reason}</Text>
                      </View>
                      
                      <View style={md.detailRow}>
                        <Text style={md.detailLbl}>Related Incident ID</Text>
                        <Text style={md.detailValHi}>{selectedReport.incidentId}</Text>
                      </View>
                      
                      <View style={md.detailRow}>
                        <Text style={md.detailLbl}>Date</Text>
                        <Text style={md.detailVal}>{selectedReport.date}</Text>
                      </View>
                    </View>

                    {/* Action Area */}
                    <View style={md.actionArea}>
                      {actionStatus ? (
                        <View style={md.successBox}>
                          <Feather name="check-circle" size={20} color={T.success} />
                          <Text style={md.successTxt}>Report has been marked as {actionStatus}.</Text>
                        </View>
                      ) : (
                        <View style={md.actionButtonsColumn}>
                          <TouchableOpacity style={md.dismissBtn} onPress={() => handleAction('DISMISSED')} activeOpacity={0.7}>
                            <Feather name="trash-2" size={18} color={T.ink3} />
                            <Text style={md.dismissTxt}>Dismiss</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={md.warnBtn} onPress={() => handleAction('WARNED')} activeOpacity={0.7}>
                            <Feather name="alert-triangle" size={18} color="#E25B3A" />
                            <Text style={md.warnTxt}>Warn User</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={md.blockBtn} onPress={() => handleAction('BLOCKED')} activeOpacity={0.7}>
                            <Feather name="slash" size={18} color="#FFF" />
                            <Text style={md.blockTxt}>Block User</Text>
                          </TouchableOpacity>
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
  
  tabsWrap: { marginBottom: 16 },
  tabsScroll: { gap: 10, paddingRight: 20 },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: T.lineMid, backgroundColor: T.surfaceCard,
  },
  tabTxt: { fontSize: 13, fontWeight: '600', color: T.ink4 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, width: '100%' },
  emptyText: { fontSize: 15, color: T.ink3, marginTop: 12, fontWeight: '600' },
});

const rc = StyleSheet.create({
  card: {
    backgroundColor: '#0F1020', borderRadius: 16, borderWidth: 1, borderColor: T.lineMid,
    padding: 16,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  infoWrap: { flex: 1 },
  label: { fontSize: 11, color: T.ink4, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 16, fontWeight: '700', color: '#E25B3A' },
  
  statusBadge: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusTxt: { fontSize: 10, fontWeight: '700', color: T.ink3 },
  
  botRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subTxt: { fontSize: 13, fontWeight: '600', color: T.ink },
});

const md = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '100%', maxWidth: 500, maxHeight: '85%', backgroundColor: '#060610', borderRadius: 20, borderWidth: 1, borderColor: T.lineMid, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: '#0F1020' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: T.ink },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.surfaceCard, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20 },
  
  usersSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.surfaceCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.lineMid },
  userBox: { flex: 1 },
  userLabel: { fontSize: 11, color: T.ink4, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 13, fontWeight: '700', color: T.ink, flex: 1 },
  arrowBox: { width: 30, alignItems: 'center', justifyContent: 'center' },

  section: { backgroundColor: T.surfaceCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.lineMid },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: T.ink4, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  detailRowCol: { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  detailLbl: { fontSize: 13, color: T.ink4 },
  detailVal: { flex: 1, fontSize: 14, fontWeight: '600', color: T.ink, textAlign: 'right', paddingLeft: 24 },
  detailValLeft: { fontSize: 14, fontWeight: '600', color: T.ink, textAlign: 'left', marginTop: 8, lineHeight: 20 },
  detailValHi: { flex: 1, fontSize: 14, fontWeight: '700', color: T.violet, textAlign: 'right', paddingLeft: 24 },
  
  actionArea: { marginTop: 10 },
  actionButtonsColumn: { gap: 12 },
  
  dismissBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid, paddingVertical: 14, borderRadius: 12 },
  dismissTxt: { fontSize: 15, fontWeight: '700', color: T.ink3 },
  
  warnBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(226,91,58,0.1)', borderWidth: 1, borderColor: 'rgba(226,91,58,0.3)', paddingVertical: 14, borderRadius: 12 },
  warnTxt: { fontSize: 15, fontWeight: '700', color: '#E25B3A' },
  
  blockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.danger, paddingVertical: 14, borderRadius: 12 },
  blockTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.safeLight, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(24,204,117,0.2)' },
  successTxt: { fontSize: 14, fontWeight: '600', color: T.success },
});
