/**
 * volunteer-verification.tsx — Volunteer Verification Screen (Standard User)
 * ─────────────────────────────────────────────────────────────────────────────
 * States: Initial → Form (Upload Docs) → Pending → Verified | Rejected
 * Persistence: expo-secure-store (key: resqher_volunteer_verification_v1)
 * Upload: expo-image-picker (gallery for ID/Certificate, camera+gallery for Selfie)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
    Alert,
    Image,
    Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';

// ── Constants ──────────────────────────────────────────────────────────────────
export const VERIFICATION_KEY = 'resqher_volunteer_verification_v1';
export const VERIFICATION_ACK_KEY = 'resqher_volunteer_verification_ack_v1';

export type VerificationStatus =
    | 'not_applied'
    | 'draft'
    | 'pending'
    | 'verified'
    | 'rejected';

export type VerificationRecord = {
    status: VerificationStatus;
    submittedOn?: string;       // ISO string
    documents?: {
        idCardUri?: string;
        selfieUri?: string;
        certificateUri?: string;
    };
    rejectionReason?: string;
};

const INITIAL_RECORD: VerificationRecord = { status: 'not_applied' };

// ── Helpers ────────────────────────────────────────────────────────────────────
export async function loadVerificationRecord(): Promise<VerificationRecord> {
    try {
        const raw = await SecureStore.getItemAsync(VERIFICATION_KEY);
        if (raw) return { ...INITIAL_RECORD, ...JSON.parse(raw) };
    } catch { /* returns default */ }
    return { ...INITIAL_RECORD };
}

async function saveRecord(record: VerificationRecord) {
    try {
        await SecureStore.setItemAsync(VERIFICATION_KEY, JSON.stringify(record));
    } catch { /* best-effort */ }
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch { return iso; }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={s.section}>
            <Text style={s.sectionTitle}>{title}</Text>
            <View style={s.sectionCard}>{children}</View>
        </View>
    );
}

function Divider() {
    return <View style={s.divider} />;
}

// Status color and icon helper
function statusMeta(status: VerificationStatus) {
    switch (status) {
        case 'pending':
            return { color: T.accent, icon: 'clock' as const, label: 'Pending Review' };
        case 'verified':
            return { color: T.success, icon: 'check-circle' as const, label: 'Verified' };
        case 'rejected':
            return { color: T.danger, icon: 'x-circle' as const, label: 'Rejected' };
        default:
            return { color: T.ink4, icon: 'help-circle' as const, label: 'Unknown' };
    }
}

// ── Upload row component ────────────────────────────────────────────────────────
function UploadRow({
    label,
    hint,
    optional,
    uri,
    onPick,
    onRemove,
}: {
    label: string;
    hint: string;
    optional?: boolean;
    uri?: string;
    onPick: () => void;
    onRemove: () => void;
}) {
    return (
        <View style={s.uploadRow}>
            <View style={s.uploadLeft}>
                <View style={s.uploadLabelRow}>
                    <Text style={s.uploadLabel}>{label}</Text>
                    {optional && (
                        <View style={s.optionalBadge}>
                            <Text style={s.optionalText}>Optional</Text>
                        </View>
                    )}
                </View>
                <Text style={s.uploadHint}>{hint}</Text>
            </View>

            {uri ? (
                <View style={s.uploadPreviewWrap}>
                    <Image source={{ uri }} style={s.uploadPreview} />
                    <TouchableOpacity
                        style={s.uploadChangeBtn}
                        onPress={onPick}
                        activeOpacity={0.75}
                    >
                        <Text style={s.uploadChangeBtnText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={s.uploadRemoveBtn}
                        onPress={onRemove}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="x" size={14} color={T.danger} />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={s.uploadBtn} onPress={onPick} activeOpacity={0.75}>
                    <Feather name="upload" size={15} color={T.violet} />
                    <Text style={s.uploadBtnText}>Upload</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function VolunteerVerificationScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [record, setRecord] = useState<VerificationRecord>(INITIAL_RECORD);
    const [viewState, setViewState] = useState<'loading' | 'initial' | 'form' | 'status'>('loading');
    const [idCardUri, setIdCardUri] = useState<string | undefined>();
    const [selfieUri, setSelfieUri] = useState<string | undefined>();
    const [certUri, setCertUri] = useState<string | undefined>();
    const [submitting, setSubmitting] = useState(false);

    // ── Load persisted record on mount ────────────────────────────────────
    useEffect(() => {
        loadVerificationRecord().then(rec => {
            setRecord(rec);
            if (rec.status === 'not_applied') {
                setViewState('initial');
            } else if (rec.status === 'draft') {
                // Restore any saved draft uris
                setIdCardUri(rec.documents?.idCardUri);
                setSelfieUri(rec.documents?.selfieUri);
                setCertUri(rec.documents?.certificateUri);
                setViewState('form');
            } else {
                setViewState('status');
            }
        });
    }, []);

    // ── Persist helper ────────────────────────────────────────────────────
    const persist = useCallback(async (rec: VerificationRecord) => {
        setRecord(rec);
        await saveRecord(rec);
    }, []);

    // ── Actions ──────────────────────────────────────────────────────────
    const handleApply = async () => {
        const draft: VerificationRecord = { status: 'draft', documents: {} };
        await persist(draft);
        setViewState('form');
    };

    const handleSubmit = async () => {
        if (!idCardUri || !selfieUri) {
            Alert.alert(
                'Documents required',
                'Please upload your ID Card and a Selfie holding your ID before submitting.',
            );
            return;
        }
        setSubmitting(true);
        const pendingRecord: VerificationRecord = {
            status: 'pending',
            submittedOn: new Date().toISOString(),
            documents: {
                idCardUri,
                selfieUri,
                certificateUri: certUri,
            },
        };
        await persist(pendingRecord);
        setSubmitting(false);
        setViewState('status');
    };

    const handleReapply = async () => {
        const draft: VerificationRecord = { status: 'draft', documents: {} };
        setIdCardUri(undefined);
        setSelfieUri(undefined);
        setCertUri(undefined);
        await persist(draft);
        setViewState('form');
    };

    // ── Image picker helpers ──────────────────────────────────────────────
    const pickFromGallery = async (
        setter: (uri: string) => void,
    ) => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission required', 'Please allow access to your photo library.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
            setter(result.assets[0].uri);
        }
    };

    const pickSelfie = async () => {
        Alert.alert('Upload Selfie', 'Choose a source', [
            {
                text: 'Camera',
                onPress: async () => {
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (!perm.granted) {
                        Alert.alert('Permission required', 'Please allow camera access.');
                        return;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                        quality: 0.8,
                        allowsEditing: true,
                        aspect: [3, 4],
                    });
                    if (!result.canceled && result.assets[0]) {
                        setSelfieUri(result.assets[0].uri);
                    }
                },
            },
            {
                text: 'Photo Library',
                onPress: () => pickFromGallery(setSelfieUri),
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    // ── Persist draft uris whenever images change ─────────────────────────
    useEffect(() => {
        if (viewState !== 'form') return;
        const updated: VerificationRecord = {
            ...record,
            status: 'draft',
            documents: {
                idCardUri,
                selfieUri,
                certificateUri: certUri,
            },
        };
        void saveRecord(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idCardUri, selfieUri, certUri]);

    const canSubmit = !!idCardUri && !!selfieUri;

    // ─────────────────────────────────────────────────────────────────────
    if (viewState === 'loading') return null;

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Header ─────────────────────────────────────────────── */}
                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Volunteer Verification</Text>
                    <View style={s.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ════ STATE A — Initial (not applied) ════════════════ */}
                    {viewState === 'initial' && (
                        <>
                            {/* Hero */}
                            <View style={s.heroWrap}>
                                <View style={s.heroIconRing}>
                                    <Feather name="shield" size={36} color={T.violet} />
                                </View>
                                <Text style={s.heroTitle}>Become a Verified Volunteer</Text>
                                <Text style={s.heroSubtitle}>
                                    Help people during emergencies near you.
                                </Text>
                            </View>

                            {/* What verified volunteers can do */}
                            <Section title="Verified volunteers can">
                                {[
                                    { icon: 'radio' as const, text: 'Respond to SOS alerts' },
                                    { icon: 'map-pin' as const, text: 'Assist victims nearby' },
                                    { icon: 'message-square' as const, text: 'Join incident rooms' },
                                ].map((item, i, arr) => (
                                    <React.Fragment key={item.text}>
                                        <View style={s.bulletRow}>
                                            <View style={s.bulletIconBox}>
                                                <Feather name={item.icon} size={14} color={T.violet} />
                                            </View>
                                            <Text style={s.bulletText}>{item.text}</Text>
                                        </View>
                                        {i < arr.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </Section>

                            {/* UX tip card */}
                            <View style={s.tipCard}>
                                <Feather name="info" size={15} color={T.accent} style={{ marginTop: 1 }} />
                                <Text style={s.tipText}>
                                    Verification confirms your identity and helps us protect
                                    victims from fake responders. The process takes less than
                                    2 minutes — you only need to upload ID proof once.
                                </Text>
                            </View>

                            {/* Apply button */}
                            <TouchableOpacity
                                style={s.primaryBtn}
                                onPress={handleApply}
                                activeOpacity={0.8}
                            >
                                <Feather name="check-circle" size={17} color={T.onPrimary} />
                                <Text style={s.primaryBtnText}>Apply for Verification</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* ════ STATE B — Application Form ═════════════════════ */}
                    {viewState === 'form' && (
                        <>
                            <View style={s.formIntro}>
                                <Text style={s.formIntroTitle}>Upload Your Documents</Text>
                                <Text style={s.formIntroSub}>
                                    We only need identity proof. Your existing profile info
                                    already covers the rest.
                                </Text>
                            </View>

                            <Section title="Identity Verification">
                                <UploadRow
                                    label="ID Card"
                                    hint="National ID / Passport / Driving License"
                                    uri={idCardUri}
                                    onPick={() => pickFromGallery(setIdCardUri)}
                                    onRemove={() => setIdCardUri(undefined)}
                                />
                                <Divider />
                                <UploadRow
                                    label="Selfie With ID"
                                    hint="A selfie photo holding your ID — prevents fake accounts"
                                    uri={selfieUri}
                                    onPick={pickSelfie}
                                    onRemove={() => setSelfieUri(undefined)}
                                />
                                <Divider />
                                <UploadRow
                                    label="Certificate"
                                    hint="First aid / medical / security training (boosts trust score)"
                                    optional
                                    uri={certUri}
                                    onPick={() => pickFromGallery(setCertUri)}
                                    onRemove={() => setCertUri(undefined)}
                                />
                            </Section>

                            {/* Required fields note */}
                            {!canSubmit && (
                                <Text style={s.requiredNote}>
                                    * ID Card and Selfie are required to submit.
                                </Text>
                            )}

                            {/* Submit */}
                            <TouchableOpacity
                                style={[s.primaryBtn, !canSubmit && s.primaryBtnDisabled]}
                                onPress={canSubmit && !submitting ? handleSubmit : undefined}
                                activeOpacity={canSubmit ? 0.8 : 1}
                            >
                                <Feather name="send" size={17} color={canSubmit ? T.onPrimary : T.disabledText} />
                                <Text style={[s.primaryBtnText, !canSubmit && s.primaryBtnTextDisabled]}>
                                    {submitting ? 'Submitting…' : 'Submit Verification Request'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* ════ STATE C/D/E — Status View ══════════════════════ */}
                    {viewState === 'status' && (() => {
                        const meta = statusMeta(record.status);
                        return (
                            <>
                                {/* Status card */}
                                <View style={s.statusCard}>
                                    <View style={[s.statusIconRing, { borderColor: `${meta.color}40`, backgroundColor: `${meta.color}12` }]}>
                                        <Feather name={meta.icon} size={34} color={meta.color} />
                                    </View>
                                    <Text style={s.statusCardTitle}>Verification Status</Text>

                                    <View style={[s.statusBadge, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}40` }]}>
                                        <View style={[s.statusDot, { backgroundColor: meta.color }]} />
                                        <Text style={[s.statusBadgeText, { color: meta.color }]}>
                                            {meta.label}
                                        </Text>
                                    </View>

                                    {record.submittedOn && (
                                        <Text style={s.statusDate}>
                                            Submitted on {formatDate(record.submittedOn)}
                                        </Text>
                                    )}
                                </View>

                                {/* Pending message */}
                                {record.status === 'pending' && (
                                    <Section title="What happens next">
                                        <View style={s.infoRow}>
                                            <Feather name="clock" size={15} color={T.accent} />
                                            <Text style={s.infoText}>
                                                Your documents are being reviewed. This usually takes
                                                24–48 hours.
                                            </Text>
                                        </View>
                                        <Divider />
                                        <View style={s.infoRow}>
                                            <Feather name="bell" size={15} color={T.violet} />
                                            <Text style={s.infoText}>
                                                You will be notified once verification is complete.
                                            </Text>
                                        </View>
                                    </Section>
                                )}

                                {/* Verified message */}
                                {record.status === 'verified' && (
                                    <Section title="You're Verified">
                                        <View style={s.infoRow}>
                                            <Feather name="check-circle" size={15} color={T.success} />
                                            <Text style={s.infoText}>
                                                You are now a verified volunteer. You can respond to
                                                nearby SOS alerts and join incident rooms.
                                            </Text>
                                        </View>
                                    </Section>
                                )}

                                {/* Rejected message + reapply */}
                                {record.status === 'rejected' && (
                                    <>
                                        <Section title="Rejection Reason">
                                            <View style={s.rejectionReasonWrap}>
                                                <Feather name="alert-circle" size={15} color={T.danger} style={{ marginTop: 1 }} />
                                                <Text style={s.rejectionReasonText}>
                                                    {record.rejectionReason || 'No reason was provided.'}
                                                </Text>
                                            </View>
                                        </Section>
                                        <TouchableOpacity
                                            style={[s.primaryBtn, s.reapplyBtn]}
                                            onPress={handleReapply}
                                            activeOpacity={0.8}
                                        >
                                            <Feather name="refresh-cw" size={17} color={T.onPrimary} />
                                            <Text style={s.primaryBtnText}>Reapply</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </ScrollView>
            </View>
        </AtmosphericShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1 },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.lineMid,
        backgroundColor: T.surfaceGlass,
    },
    headerBtn: {
        width: 36, height: 36,
        borderRadius: R.hBtn,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: T.lineMid,
        backgroundColor: T.surfaceCard,
    },
    headerTitle: {
        flex: 1, textAlign: 'center',
        fontSize: 16, fontWeight: '700',
        color: T.ink, marginHorizontal: 10,
    },
    headerSpacer: { width: 36, height: 36 },

    // ── Scroll ────────────────────────────────────────────────────────────────
    scroll: { paddingHorizontal: 14, paddingTop: 20 },

    // ── Section ───────────────────────────────────────────────────────────────
    section: { marginBottom: 20 },
    sectionTitle: {
        fontSize: 11, fontWeight: '700',
        color: T.ink3, letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 10, marginLeft: 4,
    },
    sectionCard: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg, borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: 14, paddingVertical: 6,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
        marginVertical: 2,
    },

    // ── Hero (Initial) ────────────────────────────────────────────────────────
    heroWrap: {
        alignItems: 'center',
        paddingVertical: 28,
        marginBottom: 20,
    },
    heroIconRing: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: T.violetDim,
        borderWidth: 2, borderColor: `${T.violet}40`,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
        ...Platform.select({
            ios: { shadowColor: T.violet, shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 6 },
        }),
    },
    heroTitle: {
        fontSize: 22, fontWeight: '800',
        color: T.ink, letterSpacing: -0.4,
        textAlign: 'center', marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 14, fontWeight: '400',
        color: T.ink3, textAlign: 'center',
        lineHeight: 20, paddingHorizontal: 8,
    },

    // ── Bullet row ────────────────────────────────────────────────────────────
    bulletRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, gap: 12,
    },
    bulletIconBox: {
        width: 30, height: 30, borderRadius: R.xs,
        backgroundColor: T.violetDim,
        alignItems: 'center', justifyContent: 'center',
    },
    bulletText: {
        flex: 1,
        fontSize: 14, fontWeight: '600',
        color: T.ink2,
    },

    // ── UX Tip card ───────────────────────────────────────────────────────────
    tipCard: {
        flexDirection: 'row', gap: 10,
        backgroundColor: `${T.accent}10`,
        borderRadius: R.md, borderWidth: 1,
        borderColor: `${T.accent}30`,
        paddingHorizontal: 14, paddingVertical: 12,
        marginBottom: 24,
    },
    tipText: {
        flex: 1,
        fontSize: 13, fontWeight: '400',
        color: T.ink3, lineHeight: 18,
    },

    // ── Primary button ────────────────────────────────────────────────────────
    primaryBtn: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 10,
        backgroundColor: T.violet,
        borderRadius: R.md, paddingVertical: 15,
        marginBottom: 12,
    },
    primaryBtnDisabled: {
        backgroundColor: T.disabled,
    },
    primaryBtnText: {
        fontSize: 15, fontWeight: '700',
        color: T.onPrimary, letterSpacing: 0.2,
    },
    primaryBtnTextDisabled: {
        color: T.disabledText,
    },
    reapplyBtn: {
        backgroundColor: T.dangerPressed,
    },

    // ── Form intro ────────────────────────────────────────────────────────────
    formIntro: {
        marginBottom: 20,
    },
    formIntroTitle: {
        fontSize: 20, fontWeight: '800',
        color: T.ink, letterSpacing: -0.3,
        marginBottom: 6,
    },
    formIntroSub: {
        fontSize: 13, fontWeight: '400',
        color: T.ink4, lineHeight: 18,
    },
    requiredNote: {
        fontSize: 12, fontWeight: '400',
        color: T.ink4, marginBottom: 14, marginLeft: 4,
    },

    // ── Upload row ────────────────────────────────────────────────────────────
    uploadRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, gap: 12,
    },
    uploadLeft: { flex: 1 },
    uploadLabelRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 8, marginBottom: 3,
    },
    uploadLabel: {
        fontSize: 14, fontWeight: '600',
        color: T.ink,
    },
    uploadHint: {
        fontSize: 12, fontWeight: '400',
        color: T.ink4, lineHeight: 16,
    },
    optionalBadge: {
        paddingHorizontal: 6, paddingVertical: 1,
        borderRadius: R.xs,
        backgroundColor: T.surfaceMid,
        borderWidth: 1, borderColor: T.lineMid,
    },
    optionalText: {
        fontSize: 10, fontWeight: '600',
        color: T.ink4, letterSpacing: 0.3,
    },

    // Preview when file is already selected
    uploadPreviewWrap: {
        alignItems: 'center', gap: 5,
    },
    uploadPreview: {
        width: 52, height: 52, borderRadius: R.sm,
        borderWidth: 1, borderColor: `${T.violet}40`,
    },
    uploadChangeBtn: {
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: R.xs,
        backgroundColor: T.violetDim,
        borderWidth: 1, borderColor: `${T.violet}30`,
    },
    uploadChangeBtnText: {
        fontSize: 11, fontWeight: '600',
        color: T.violet,
    },
    uploadRemoveBtn: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: T.dangerLight,
        borderWidth: 1, borderColor: T.dangerBorder,
        alignItems: 'center', justifyContent: 'center',
    },

    // Upload button (empty state)
    uploadBtn: {
        flexDirection: 'row', alignItems: 'center',
        gap: 6, paddingHorizontal: 12, paddingVertical: 9,
        borderRadius: R.sm,
        backgroundColor: T.violetDim,
        borderWidth: 1, borderColor: `${T.violet}30`,
    },
    uploadBtnText: {
        fontSize: 13, fontWeight: '600',
        color: T.violet,
    },

    // ── Status card ───────────────────────────────────────────────────────────
    statusCard: {
        alignItems: 'center',
        backgroundColor: T.surfaceCard,
        borderRadius: R.lg, borderWidth: 1,
        borderColor: T.lineMid,
        paddingVertical: 28, paddingHorizontal: 20,
        marginBottom: 20,
    },
    statusIconRing: {
        width: 72, height: 72, borderRadius: 36,
        borderWidth: 2,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    statusCardTitle: {
        fontSize: 13, fontWeight: '700',
        color: T.ink3, letterSpacing: 1.0,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: R.pill, borderWidth: 1,
        marginBottom: 10,
    },
    statusDot: {
        width: 7, height: 7, borderRadius: 4,
    },
    statusBadgeText: {
        fontSize: 14, fontWeight: '700',
        letterSpacing: 0.2,
    },
    statusDate: {
        fontSize: 12, fontWeight: '400',
        color: T.ink4,
    },

    // ── Info rows (inside section cards) ──────────────────────────────────────
    infoRow: {
        flexDirection: 'row', alignItems: 'flex-start',
        gap: 10, paddingVertical: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13, fontWeight: '400',
        color: T.ink3, lineHeight: 18,
    },

    // ── Rejection reason ──────────────────────────────────────────────────────
    rejectionReasonWrap: {
        flexDirection: 'row', alignItems: 'flex-start',
        gap: 10, paddingVertical: 12,
    },
    rejectionReasonText: {
        flex: 1,
        fontSize: 13, fontWeight: '500',
        color: T.dangerText, lineHeight: 18,
    },
});

