import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, S, Ty } from '../../../constants/theme';
import { adminService } from '../../../services/adminService';
import { useToast } from '../../../components/Toast';
import { VerificationDocumentViewer } from './VerificationDocumentViewer';
import { useDispatchSocket } from '../../../hooks/useDispatchSocket';

const ALL_POLICE_SELECTION = 'ALL_APPROVED_POLICE';
const ASSIGNABLE_REQUEST_STATUSES = ['PENDING_ADMIN_REVIEW', 'REJECTED_BY_POLICE'];
const ASSIGNED_REQUEST_STATUSES = ['ASSIGNED_TO_POLICE', 'ACCEPTED_BY_POLICE'];
const INACTIVE_INCIDENT_STATUSES = ['RESOLVED', 'CANCELLED'];

function statusLabel(value?: string | null) {
  return String(value || '').replace(/_/g, ' ');
}

function shortTime(value?: string | null) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function severityStyle(value?: string | null) {
  const severity = String(value || 'LOW').toUpperCase();
  if (severity === 'CRITICAL') return [st.severityBadge, st.severityCritical];
  if (severity === 'HIGH') return [st.severityBadge, st.severityHigh];
  if (severity === 'MEDIUM') return [st.severityBadge, st.severityMedium];
  return [st.severityBadge, st.severityLow];
}

function summaryText(summary: any, fallback?: string | null) {
  return summary?.summary || fallback || 'Incident summary is not available yet.';
}

export function PoliceWorkspace({
  insetsBottom,
  requestsOnly = false,
}: {
  insetsBottom: number;
  requestsOnly?: boolean;
}) {
  const { showToast } = useToast();
  const [policeVerifications, setPoliceVerifications] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [approvedPolice, setApprovedPolice] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [selectedPoliceByRequest, setSelectedPoliceByRequest] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<any | null>(null);
  const [summaryLoadingId, setSummaryLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setVerificationError(null);
    setRequestError(null);
    const [verifs, lawRequests, police] = await Promise.allSettled([
      adminService.getPoliceVerifications('PENDING'),
      adminService.getLawEnforcementRequests(),
      adminService.getApprovedPolice(),
    ]);
    if (verifs.status === 'fulfilled') {
      setPoliceVerifications(verifs.value);
    } else {
      setPoliceVerifications([]);
      setVerificationError(verifs.reason?.message || 'Could not load police verification requests.');
    }
    if (lawRequests.status === 'fulfilled') {
      setRequests(lawRequests.value);
    } else {
      setRequests([]);
      setRequestError(lawRequests.reason?.message || 'Could not load law enforcement requests.');
    }
    setApprovedPolice(police.status === 'fulfilled' ? police.value : []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useDispatchSocket({
    onLawEnforcementRequest: load,
    onIncidentStatusUpdated: load,
  });

  const approve = async (userId: string) => {
    setBusyId(userId);
    try {
      await adminService.approvePoliceVerification(userId);
      showToast({ type: 'success', title: 'Police Approved', message: 'This police account can now access assigned tasks.' });
      await load();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Approval Failed', message: err?.message || 'Please try again.' });
    } finally { setBusyId(null); }
  };

  const reject = async (userId: string) => {
    setBusyId(userId);
    try {
      await adminService.rejectPoliceVerification(userId, 'Rejected by admin review.');
      showToast({ type: 'info', title: 'Police Rejected', message: 'The applicant will see the rejected verification page.' });
      await load();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Rejection Failed', message: err?.message || 'Please try again.' });
    } finally { setBusyId(null); }
  };

  const assign = async (requestId: string) => {
    const selectedPoliceId = selectedPoliceByRequest[requestId] || ALL_POLICE_SELECTION;
    const assignToAll = selectedPoliceId === ALL_POLICE_SELECTION;
    const police = assignToAll ? null : approvedPolice.find(item => String(item.id) === String(selectedPoliceId));
    if (!assignToAll && !police) {
      showToast({ type: 'warning', title: 'No Approved Police', message: 'Approve a police account before assigning requests.' });
      return;
    }
    if (assignToAll && approvedPolice.length === 0) {
      showToast({ type: 'warning', title: 'No Approved Police', message: 'Approve at least one police account before assigning to all.' });
      return;
    }
    setBusyId(requestId);
    try {
      await adminService.assignLawEnforcementRequest(requestId, police?.id, assignToAll);
      showToast({
        type: 'success',
        title: 'Request Assigned',
        message: assignToAll ? `Offered to ${approvedPolice.length} approved police.` : `Assigned to ${police?.name}.`,
      });
      await load();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Assignment Failed', message: err?.message || 'Please try again.' });
    } finally { setBusyId(null); }
  };

  const cancel = async (requestId: string) => {
    setBusyId(requestId);
    try {
      await adminService.cancelLawEnforcementRequest(requestId, 'Cancelled by admin.');
      showToast({ type: 'info', title: 'Request Cancelled', message: 'Law enforcement request history was preserved.' });
      await load();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Cancel Failed', message: err?.message || 'Please try again.' });
    } finally { setBusyId(null); }
  };

  const viewSummary = async (item: any) => {
    setSummaryLoadingId(item.id);
    try {
      const detail = await adminService.getLawEnforcementRequest(item.id);
      setSelectedSummary(detail);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Summary Unavailable', message: err?.message || 'Could not load incident summary.' });
    } finally {
      setSummaryLoadingId(null);
    }
  };

  if (loading) {
    return <View style={st.center}><ActivityIndicator color={T.violet} /></View>;
  }

  return (
    <View style={st.container}>
      <View style={st.header}>
        <View style={st.headerIcon}><Feather name="shield" size={20} color={T.violet} /></View>
        <View>
          <Text style={st.title}>{requestsOnly ? 'Law Enforcement Requests' : 'Police'}</Text>
          <Text style={st.subtitle}>
            {requestsOnly
              ? 'Review and assign police assistance requests from active incidents'
              : 'Verify police accounts and assign law enforcement SOS requests'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[st.scroll, { paddingBottom: insetsBottom + 30 }]}>
        {!requestsOnly && (
          <>
        <Text style={st.sectionTitle}>Police Verification Requests</Text>
        {verificationError ? (
          <SectionError text={verificationError} onRetry={load} />
        ) : policeVerifications.length === 0 ? (
          <Empty text="No pending police verification requests." />
        ) : policeVerifications.map(item => (
          <View key={item.userId} style={st.card}>
            <Text style={st.cardTitle}>{item.name}</Text>
            <Text style={st.meta}>{item.phoneNumber} · {item.policeStationOrUnit}</Text>
            <Text style={st.meta}>Badge / Job ID: {item.badgeNumber}</Text>
            <VerificationDocumentViewer
              documents={[
                { label: 'NID Card', uri: item.nidCardUrl || item.idCardUrl, required: true },
                { label: 'Selfie With NID', uri: item.selfieUrl, required: true },
                { label: 'Job Certificate / ID', uri: item.jobIdCardUrl || item.certificateUrl, required: true },
              ]}
            />
            <View style={st.actions}>
              <TouchableOpacity style={st.secondaryBtn} disabled={busyId === item.userId} onPress={() => reject(item.userId)}>
                <Text style={st.secondaryText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.primaryBtn} disabled={busyId === item.userId} onPress={() => approve(item.userId)}>
                <Text style={st.primaryText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

          </>
        )}

        <Text style={[st.sectionTitle, { marginTop: requestsOnly ? 0 : S.s5 }]}>Law Enforcement SOS Requests</Text>
        {requestError ? (
          <SectionError text={requestError} onRetry={load} />
        ) : requests.length === 0 ? (
          <Empty text="No law enforcement SOS requests yet." />
        ) : requests.map(item => {
          const incidentStatus = String(item.incidentStatus || '').toUpperCase();
          const requestStatus = String(item.status || '').toUpperCase();
          const incidentInactive = INACTIVE_INCIDENT_STATUSES.includes(incidentStatus);
          const requestInactive = INACTIVE_INCIDENT_STATUSES.includes(requestStatus);
          const assignable = !incidentInactive && ASSIGNABLE_REQUEST_STATUSES.includes(requestStatus);
          const assigned = !incidentInactive && ASSIGNED_REQUEST_STATUSES.includes(requestStatus);
          const statusBadgeText = incidentInactive
            ? statusLabel(incidentStatus)
            : requestInactive
              ? statusLabel(requestStatus)
              : assigned
                ? 'Assigned to Police'
                : statusLabel(requestStatus);

          return (
            <View key={item.id} style={st.card}>
              <View style={st.topRow}>
                <Text style={st.caseCode}>{item.incidentDisplayCode}</Text>
                <Text
                  style={[
                    st.badge,
                    assigned && st.badgeAssigned,
                    (incidentStatus === 'RESOLVED' || requestStatus === 'RESOLVED') && st.badgeResolved,
                    (incidentStatus === 'CANCELLED' || requestStatus === 'CANCELLED') && st.badgeCancelled,
                  ]}
                >
                  {statusBadgeText}
                </Text>
              </View>
              <Text style={st.cardTitle}>{item.victimName}</Text>
              <Text style={st.meta}>Requested by {item.requesterName} ({item.requesterRole})</Text>
              <Text style={st.meta}>{item.address || 'Location unavailable'}</Text>
              <View style={st.intelligenceBox}>
                <View style={st.intelligenceTop}>
                  <Text style={st.assignedTitle}>AI Incident Intelligence</Text>
                  <Text style={severityStyle(item.severity)}>{String(item.severity || 'LOW').toUpperCase()}</Text>
                </View>
                <Text style={st.meta} numberOfLines={3}>{item.summaryPreview || item.incidentSummaryText || 'Automatic incident summary will appear here.'}</Text>
                {!!item.severityReason && <Text style={st.reasonPreview} numberOfLines={2}>{item.severityReason}</Text>}
              </View>
              {!!(item.assignedToAll || item.assignedPoliceName || item.assignedPolice?.name) && (
                <View style={st.assignedBox}>
                  <Text style={st.assignedTitle}>{item.assignedToAll ? 'Assigned Scope' : 'Assigned Officer'}</Text>
                  <Text style={st.meta}>{item.assignedToAll ? 'All approved police' : item.assignedPoliceName || item.assignedPolice?.name}</Text>
                  {item.assignedToAll ? (
                    <Text style={st.meta}>{Number(item.assignedPoliceCount || 0)} officer(s) notified</Text>
                  ) : !!(item.assignedPolicePhone || item.assignedPolice?.phone) && (
                    <Text style={st.meta}>{item.assignedPolicePhone || item.assignedPolice?.phone}</Text>
                  )}
                  {!!item.assignedAt && <Text style={st.meta}>Assigned {new Date(item.assignedAt).toLocaleString()}</Text>}
                </View>
              )}
              {!!item.rejectionReason && <Text style={st.danger}>Rejected: {item.rejectionReason}</Text>}
              {assignable && approvedPolice.length > 0 && (
                <View style={st.policePickRow}>
                  <TouchableOpacity
                    style={[
                      st.policeChip,
                      st.allPoliceChip,
                      (selectedPoliceByRequest[item.id] || ALL_POLICE_SELECTION) === ALL_POLICE_SELECTION && st.policeChipActive,
                    ]}
                    onPress={() => setSelectedPoliceByRequest(prev => ({ ...prev, [item.id]: ALL_POLICE_SELECTION }))}
                  >
                    <Feather name="users" size={13} color={(selectedPoliceByRequest[item.id] || ALL_POLICE_SELECTION) === ALL_POLICE_SELECTION ? T.ink : T.violet} />
                    <Text
                      style={[
                        st.policeChipText,
                        (selectedPoliceByRequest[item.id] || ALL_POLICE_SELECTION) === ALL_POLICE_SELECTION && st.policeChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      All approved police
                    </Text>
                  </TouchableOpacity>
                  {approvedPolice.map(police => {
                    const isSelected = String(selectedPoliceByRequest[item.id]) === String(police.id);
                    return (
                      <TouchableOpacity
                        key={police.id}
                        style={[st.policeChip, isSelected && st.policeChipActive]}
                        onPress={() => setSelectedPoliceByRequest(prev => ({ ...prev, [item.id]: String(police.id) }))}
                      >
                        <Text style={[st.policeChipText, isSelected && st.policeChipTextActive]} numberOfLines={1}>{police.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <View style={st.actions}>
                <TouchableOpacity style={st.secondaryBtn} disabled={summaryLoadingId === item.id} onPress={() => viewSummary(item)}>
                  <Text style={st.secondaryText}>{summaryLoadingId === item.id ? 'Loading...' : 'View Incident Summary'}</Text>
                </TouchableOpacity>
                {!incidentInactive && !requestInactive && (
                  <TouchableOpacity style={st.secondaryBtn} disabled={busyId === item.id} onPress={() => cancel(item.id)}>
                    <Text style={st.secondaryText}>Reject Request</Text>
                  </TouchableOpacity>
                )}
                {assignable ? (
                  <TouchableOpacity style={st.primaryBtn} disabled={busyId === item.id} onPress={() => assign(item.id)}>
                    <Text style={st.primaryText}>
                      {requestStatus === 'REJECTED_BY_POLICE'
                        ? (selectedPoliceByRequest[item.id] || ALL_POLICE_SELECTION) === ALL_POLICE_SELECTION ? 'Reassign All Police' : 'Reassign Police'
                        : (selectedPoliceByRequest[item.id] || ALL_POLICE_SELECTION) === ALL_POLICE_SELECTION ? 'Assign All Police' : 'Assign Police'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[st.statusOnlyBadge, assigned && st.statusOnlyAssigned, (incidentInactive || requestInactive) && st.statusOnlyInactive]}>
                    <Feather name={assigned ? 'check-circle' : incidentStatus === 'RESOLVED' || requestStatus === 'RESOLVED' ? 'check' : 'slash'} size={14} color={assigned ? T.success : T.ink3} />
                    <Text style={[st.statusOnlyText, assigned && st.statusOnlyAssignedText]}>{statusBadgeText}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <IncidentSummaryModal
        request={selectedSummary}
        approvedPolice={approvedPolice}
        selectedPoliceId={selectedSummary ? selectedPoliceByRequest[selectedSummary.id] || ALL_POLICE_SELECTION : ALL_POLICE_SELECTION}
        busy={!!selectedSummary && busyId === selectedSummary.id}
        onClose={() => setSelectedSummary(null)}
        onAssign={(requestId) => assign(requestId)}
        onReject={(requestId) => cancel(requestId)}
      />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={st.detailRow}>
      <Text style={st.detailLabel}>{label}</Text>
      <Text style={st.detailValue}>{String(value)}</Text>
    </View>
  );
}

function IncidentSummaryModal({
  request,
  approvedPolice,
  selectedPoliceId,
  busy,
  onClose,
  onAssign,
  onReject,
}: {
  request: any | null;
  approvedPolice: any[];
  selectedPoliceId: string;
  busy: boolean;
  onClose: () => void;
  onAssign: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  if (!request) return null;
  const summary = request.incidentSummary || {};
  const incidentStatus = String(request.incidentStatus || '').toUpperCase();
  const requestStatus = String(request.status || '').toUpperCase();
  const canAct = !INACTIVE_INCIDENT_STATUSES.includes(incidentStatus) && ASSIGNABLE_REQUEST_STATUSES.includes(requestStatus);
  const assignToAll = selectedPoliceId === ALL_POLICE_SELECTION;
  const selectedPolice = assignToAll ? null : approvedPolice.find(item => String(item.id) === String(selectedPoliceId));

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={st.modalBackdrop}>
        <View style={st.summaryModal}>
          <View style={st.summaryHeader}>
            <View>
              <Text style={st.summaryTitle}>Incident Summary</Text>
              <Text style={st.meta}>{request.incidentDisplayCode} - {statusLabel(request.status)}</Text>
            </View>
            <TouchableOpacity style={st.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={T.ink3} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.summaryScroll}>
            <View style={st.intelligenceBox}>
              <View style={st.intelligenceTop}>
                <Text style={st.assignedTitle}>Seriousness</Text>
                <Text style={severityStyle(request.severity)}>{String(request.severity || 'LOW').toUpperCase()}</Text>
              </View>
              <Text style={st.summaryBody}>{summaryText(summary, request.incidentSummaryText)}</Text>
              {!!request.severityReason && (
                <>
                  <Text style={st.detailLabel}>Severity Reason</Text>
                  <Text style={st.reasonPreview}>{request.severityReason}</Text>
                </>
              )}
            </View>

            <View style={st.detailBlock}>
              <Text style={st.detailBlockTitle}>Incident Details</Text>
              <DetailRow label="Incident ID" value={summary.incidentCode || request.incidentDisplayCode} />
              <DetailRow label="Request source" value={summary.requestSource || request.requesterRole} />
              <DetailRow label="Incident status" value={request.incidentStatus} />
              <DetailRow label="SOS creation time" value={shortTime(summary.sosCreatedAt)} />
              <DetailRow label="Police request time" value={shortTime(summary.policeRequestTime || request.createdAt)} />
              <DetailRow label="Summary generated" value={shortTime(request.summaryGeneratedAt)} />
              <DetailRow label="Location" value={summary.incidentLocation?.address || request.address || 'Location unavailable'} />
              <DetailRow label="Current location source" value={summary.currentLocation?.source} />
              <DetailRow label="Responder count" value={summary.responderCount ?? 0} />
              <DetailRow label="Participant count" value={summary.participantCount ?? 0} />
            </View>

            <View style={st.detailBlock}>
              <Text style={st.detailBlockTitle}>Requester And Victim</Text>
              <DetailRow label="Requested by" value={summary.requestedBy?.name || request.requesterName} />
              <DetailRow label="Requester role" value={summary.requestedBy?.role || request.requesterRole} />
              <DetailRow label="Requester phone" value={summary.requestedBy?.phone} />
              <DetailRow label="Victim" value={summary.victim?.name || request.victimName} />
              <DetailRow label="Victim phone" value={summary.victim?.phone} />
            </View>

            {!!summary.caseDetails?.length && (
              <View style={st.detailBlock}>
                <Text style={st.detailBlockTitle}>Important Case Details</Text>
                {summary.caseDetails.map((item: string, index: number) => (
                  <Text key={`${item}-${index}`} style={st.bulletText}>- {item}</Text>
                ))}
              </View>
            )}

            {!!summary.importantChatDetails?.length && (
              <View style={st.detailBlock}>
                <Text style={st.detailBlockTitle}>Recent Chat Details</Text>
                {summary.importantChatDetails.map((item: any, index: number) => (
                  <Text key={`${item.at}-${index}`} style={st.bulletText}>
                    - {item.sender || 'Participant'}: {item.message}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={st.modalActions}>
            {canAct && (
              <>
                <TouchableOpacity style={st.secondaryBtn} disabled={busy} onPress={() => onReject(request.id)}>
                  <Text style={st.secondaryText}>Reject Request</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.primaryBtn} disabled={busy} onPress={() => onAssign(request.id)}>
                  <Text style={st.primaryText}>
                    {assignToAll ? 'Assign Police' : `Assign ${selectedPolice?.name || 'Police'}`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={st.secondaryBtn} onPress={onClose}>
              <Text style={st.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SectionError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={st.empty}>
      <Feather name="alert-triangle" size={28} color={T.gold} />
      <Text style={st.emptyText}>{text}</Text>
      <TouchableOpacity style={st.retryBtn} onPress={onRetry}>
        <Text style={st.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={st.empty}>
      <Feather name="check-circle" size={30} color={T.success} />
      <Text style={st.emptyText}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.s3, marginBottom: S.s4 },
  headerIcon: { width: 44, height: 44, borderRadius: R.md, backgroundColor: T.violetDim, borderWidth: 1, borderColor: T.lineMid, alignItems: 'center', justifyContent: 'center' },
  title: { ...Ty.h2, color: T.ink },
  subtitle: { ...Ty.bodySm, color: T.ink4 },
  scroll: { gap: S.s3 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: T.ink, marginBottom: S.s1 },
  card: { backgroundColor: '#0F1020', borderRadius: R.lg, borderWidth: 1, borderColor: T.lineMid, padding: S.s4, gap: S.s2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.s3 },
  caseCode: { fontSize: 13, fontWeight: '900', color: T.violet },
  badge: { paddingHorizontal: S.s2, paddingVertical: 4, borderRadius: R.sm, backgroundColor: T.violetDim, overflow: 'hidden', fontSize: 10, fontWeight: '900', color: T.violet, textTransform: 'uppercase' },
  badgeAssigned: { backgroundColor: T.safeLight, color: T.success },
  badgeResolved: { backgroundColor: T.safeLight, color: T.success },
  badgeCancelled: { backgroundColor: T.dangerLight, color: T.dangerText },
  severityBadge: { paddingHorizontal: S.s2, paddingVertical: 4, borderRadius: R.sm, overflow: 'hidden', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  severityLow: { backgroundColor: T.surfaceCard, color: T.ink3 },
  severityMedium: { backgroundColor: T.accentLight, color: T.accent },
  severityHigh: { backgroundColor: 'rgba(245,158,11,0.16)', color: T.gold },
  severityCritical: { backgroundColor: T.dangerLight, color: T.dangerText },
  cardTitle: { fontSize: 16, fontWeight: '900', color: T.ink },
  meta: { ...Ty.bodySm, color: T.ink3 },
  danger: { ...Ty.bodySm, color: T.dangerText, fontWeight: '800' },
  intelligenceBox: { padding: S.s3, borderRadius: R.md, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid, gap: 6 },
  intelligenceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.s3 },
  reasonPreview: { ...Ty.bodySm, color: T.ink2, lineHeight: 18 },
  assignedBox: { padding: S.s3, borderRadius: R.md, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid, gap: 3 },
  assignedTitle: { fontSize: 11, color: T.violet, fontWeight: '900', textTransform: 'uppercase' },
  policePickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.s2, marginTop: S.s2 },
  policeChip: { maxWidth: 180, minHeight: 34, paddingHorizontal: S.s3, borderRadius: R.md, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  allPoliceChip: { maxWidth: 220, borderColor: 'rgba(138,56,246,0.35)' },
  policeChipActive: { backgroundColor: T.violetDim, borderColor: T.violet },
  policeChipText: { fontSize: 11, fontWeight: '800', color: T.ink3 },
  policeChipTextActive: { color: T.ink },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: S.s2, marginTop: S.s2 },
  primaryBtn: { minHeight: 40, paddingHorizontal: S.s4, borderRadius: R.md, backgroundColor: T.violet, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 12, fontWeight: '900', color: T.onPrimary },
  secondaryBtn: { minHeight: 40, paddingHorizontal: S.s4, borderRadius: R.md, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 12, fontWeight: '800', color: T.ink3 },
  statusOnlyBadge: { minHeight: 40, paddingHorizontal: S.s4, borderRadius: R.md, borderWidth: 1, borderColor: T.lineMid, backgroundColor: T.surfaceCard, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.s2 },
  statusOnlyAssigned: { borderColor: `${T.success}55`, backgroundColor: T.safeLight },
  statusOnlyInactive: { opacity: 0.92 },
  statusOnlyText: { color: T.ink3, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  statusOnlyAssignedText: { color: T.success },
  empty: { alignItems: 'center', justifyContent: 'center', padding: S.s5, borderRadius: R.lg, backgroundColor: T.surfaceBulkyGlass, borderWidth: 1, borderColor: T.lineMid },
  emptyText: { ...Ty.bodySm, color: T.ink3, marginTop: S.s2 },
  retryBtn: { marginTop: S.s3, minHeight: 36, paddingHorizontal: S.s4, borderRadius: R.md, backgroundColor: T.violet, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: T.onPrimary, fontSize: 12, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: S.s4 },
  summaryModal: { width: '100%', maxWidth: 720, maxHeight: '88%', borderRadius: R.lg, backgroundColor: '#0F1020', borderWidth: 1, borderColor: T.lineMid, overflow: 'hidden' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: S.s4, borderBottomWidth: 1, borderBottomColor: T.lineMid },
  summaryTitle: { fontSize: 18, fontWeight: '900', color: T.ink },
  closeBtn: { width: 36, height: 36, borderRadius: R.md, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid, alignItems: 'center', justifyContent: 'center' },
  summaryScroll: { padding: S.s4, gap: S.s3 },
  summaryBody: { ...Ty.bodySm, color: T.ink, lineHeight: 20 },
  detailBlock: { padding: S.s3, borderRadius: R.md, backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid, gap: 7 },
  detailBlockTitle: { fontSize: 12, color: T.violet, fontWeight: '900', textTransform: 'uppercase', marginBottom: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: S.s3 },
  detailLabel: { flex: 0.42, fontSize: 11, color: T.ink4, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { flex: 0.58, ...Ty.bodySm, color: T.ink2, textAlign: 'right' },
  bulletText: { ...Ty.bodySm, color: T.ink2, lineHeight: 19 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: S.s2, padding: S.s4, borderTopWidth: 1, borderTopColor: T.lineMid, flexWrap: 'wrap' },
});
