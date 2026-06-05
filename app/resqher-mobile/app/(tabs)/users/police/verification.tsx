import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../../src/services/api';
import { T, R, S } from '../../../../src/constants/theme';
import SheSafeMark from '../../../../src/components/SheSafeMark';
import { useAuth } from '../../../../src/context/AuthContext';

type PoliceVerification = {
  status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  documents?: {
    nidCardUrl?: string;
    selfieUrl?: string;
    jobIdCardUrl?: string;
  };
  rejectionReason?: string;
};

type DocType = 'nid-card' | 'selfie' | 'job-id-card';

function getErrorMessage(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback;
}

function documentMimeType(localUri: string) {
  const filename = localUri.split('/').pop() || 'document.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match?.[1]?.toLowerCase();
  return {
    filename,
    mimeType: ext === 'jpg' ? 'image/jpeg' : ext ? `image/${ext}` : 'image/jpeg',
  };
}

async function uploadVerificationDocument(type: DocType, localUri: string) {
  const formData = new FormData();
  const { filename, mimeType } = documentMimeType(localUri);

  formData.append('document', {
    uri: localUri,
    name: filename,
    type: mimeType,
  } as any);

  const { data } = await api.post(`/api/police-verification/upload/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data?.verification as PoliceVerification;
}

function UploadCard({
  title,
  hint,
  uri,
  onPick,
  onRemove,
  uploadLabel,
}: {
  title: string;
  hint: string;
  uri?: string;
  onPick: () => void;
  onRemove: () => void;
  uploadLabel: string;
}) {
  return (
    <View style={s.card}>
      <View style={s.docHeader}>
        <View style={s.docTitleWrap}>
          <Text style={s.docTitle}>{title}</Text>
          <Text style={s.docHint}>{hint}</Text>
        </View>
        <View style={s.requiredBadge}><Text style={s.requiredText}>Required</Text></View>
      </View>

      {uri ? (
        <View style={s.previewWrap}>
          <Image source={{ uri }} style={s.preview} />
          <View style={s.previewActions}>
            <TouchableOpacity style={s.changeBtn} onPress={onRemove}>
              <Feather name="x" size={14} color={T.dangerText} />
              <Text style={s.removeText}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.changeBtn} onPress={onPick}>
              <Feather name="refresh-cw" size={14} color={T.violet} />
              <Text style={s.changeText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.uploadBtn} onPress={onPick} activeOpacity={0.78}>
          <Feather name="upload-cloud" size={18} color={T.violet} />
          <Text style={s.uploadText}>{uploadLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PoliceVerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [record, setRecord] = useState<PoliceVerification | null>(null);
  const [nidCardUri, setNidCardUri] = useState<string | undefined>();
  const [selfieUri, setSelfieUri] = useState<string | undefined>();
  const [jobIdCardUri, setJobIdCardUri] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocType | null>(null);

  const goToLogin = async () => {
    await signOut();
    router.replace('/(auth)/login' as any);
  };

  const handleBack = async () => {
    if (record?.status === 'pending') {
      await goToLogin();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    await goToLogin();
  };

  useEffect(() => {
    api.get('/api/police-verification')
      .then(({ data }) => {
        const next = data?.verification as PoliceVerification;
        setRecord(next);
        setNidCardUri(next?.documents?.nidCardUrl);
        setSelfieUri(next?.documents?.selfieUrl);
        setJobIdCardUri(next?.documents?.jobIdCardUrl);
        if (next?.status === 'pending') router.replace('/(tabs)/users/police/pending' as any);
        if (next?.status === 'approved') router.replace('/(tabs)/users/police/dashboard' as any);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [router]);

  const uploadDocument = async (type: DocType, localUri: string) => {
    setUploadingType(type);
    try {
      const uploaded = await uploadVerificationDocument(type, localUri);
      setRecord(uploaded);
      setNidCardUri(uploaded.documents?.nidCardUrl || (type === 'nid-card' ? localUri : nidCardUri));
      setSelfieUri(uploaded.documents?.selfieUrl || (type === 'selfie' ? localUri : selfieUri));
      setJobIdCardUri(uploaded.documents?.jobIdCardUrl || (type === 'job-id-card' ? localUri : jobIdCardUri));
    } catch (err: any) {
      Alert.alert('Upload failed', getErrorMessage(err, 'Could not upload the selected document.'));
    } finally {
      setUploadingType(null);
    }
  };

  const pickFromGallery = async (type: DocType) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const localUri = result.assets[0].uri;
    await uploadDocument(type, localUri);
  };

  const pickSelfie = async () => {
    Alert.alert('Upload Selfie', 'Choose a source', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take Photo',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });
          if (result.canceled || !result.assets?.[0]?.uri) return;
          const localUri = result.assets[0].uri;
          await uploadDocument('selfie', localUri);
        },
      },
      { text: 'Choose from Gallery', onPress: () => pickFromGallery('selfie') },
    ]);
  };

  const clearDocument = (type: DocType) => {
    if (type === 'nid-card') setNidCardUri(undefined);
    if (type === 'selfie') setSelfieUri(undefined);
    if (type === 'job-id-card') setJobIdCardUri(undefined);
  };

  const canSubmit = !!nidCardUri && !!selfieUri && !!jobIdCardUri && !submitting && !uploadingType;

  const submit = async () => {
    if (!nidCardUri || !selfieUri || !jobIdCardUri) {
      Alert.alert(
        'Documents required',
        'Police NID Card, Selfie With NID, and Police Job Certificate / Job ID Card are required before submitting.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/police-verification/submit');
      router.replace('/(tabs)/users/police/pending' as any);
    } catch (err: any) {
      Alert.alert('Submission failed', getErrorMessage(err, 'Could not submit police verification.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color={T.violet} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
        >
          <Feather name="chevron-left" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Police Verification</Text>
        <View style={s.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + S.s6 }]}>
        <View style={s.heroIcon}><SheSafeMark size={46} /></View>
        <Text style={s.title}>Police Verification</Text>
        <Text style={s.subtitle}>Submit your NID details and police job document for admin review.</Text>

        {record?.status === 'rejected' && (
          <View style={s.rejectedBox}>
            <Feather name="x-circle" size={16} color={T.danger} />
            <Text style={s.rejectedText}>{record.rejectionReason || 'Your previous police verification was rejected. Please upload valid documents and resubmit.'}</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Identity Verification</Text>
        <UploadCard
          title="Police NID Card"
          hint="Required. Same identity document flow used for volunteers."
          uri={nidCardUri}
          uploadLabel={uploadingType === 'nid-card' ? 'Uploading...' : 'Upload NID Card'}
          onPick={() => pickFromGallery('nid-card')}
          onRemove={() => clearDocument('nid-card')}
        />
        <UploadCard
          title="Selfie With NID"
          hint="Required. Take or upload a clear selfie holding your NID."
          uri={selfieUri}
          uploadLabel={uploadingType === 'selfie' ? 'Uploading...' : 'Upload Selfie'}
          onPick={pickSelfie}
          onRemove={() => clearDocument('selfie')}
        />

        <Text style={s.sectionTitle}>Police Employment Verification</Text>
        <UploadCard
          title="Police Job Certificate / Job ID Card"
          hint="Required. This cannot be skipped."
          uri={jobIdCardUri}
          uploadLabel={uploadingType === 'job-id-card' ? 'Uploading...' : 'Upload Job Document'}
          onPick={() => pickFromGallery('job-id-card')}
          onRemove={() => clearDocument('job-id-card')}
        />

        <Text style={s.requiredNote}>* NID Card, Selfie With NID, and Police Job Certificate / Job ID Card are required to submit.</Text>

        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
          disabled={!canSubmit}
          onPress={submit}
        >
          {submitting ? <ActivityIndicator color={T.onPrimary} /> : <Text style={s.submitText}>Submit for Admin Review</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingBottom: S.s3, borderBottomWidth: 1, borderBottomColor: T.lineMid, backgroundColor: T.surfaceGlass },
  headerBtn: { width: 36, height: 36, borderRadius: R.hBtn, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.lineMid, backgroundColor: T.surfaceCard },
  headerTitle: { flex: 1, textAlign: 'center', color: T.ink, fontSize: 16, fontWeight: '800', marginHorizontal: S.s2 },
  headerSpacer: { width: 36, height: 36 },
  content: { padding: S.s5 },
  heroIcon: { width: 66, height: 66, borderRadius: R.lg, backgroundColor: T.violetDim, borderWidth: 1, borderColor: T.lineMid, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: S.s4 },
  title: { fontSize: 24, fontWeight: '900', color: T.ink, textAlign: 'center' },
  subtitle: { fontSize: 14, color: T.ink3, textAlign: 'center', marginTop: S.s2, lineHeight: 20 },
  sectionTitle: { color: T.ink, fontSize: 14, fontWeight: '900', marginTop: S.s5, marginBottom: S.s2 },
  rejectedBox: { flexDirection: 'row', gap: S.s2, padding: S.s3, borderRadius: R.md, backgroundColor: T.dangerLight, borderWidth: 1, borderColor: T.dangerBorder, marginTop: S.s4 },
  rejectedText: { flex: 1, color: T.dangerText, fontSize: 13, fontWeight: '700' },
  card: { marginTop: S.s2, padding: S.s4, borderRadius: R.lg, backgroundColor: T.surfaceBulkyGlass, borderWidth: 1, borderColor: T.lineMid },
  docHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: S.s3 },
  docTitleWrap: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '900', color: T.ink },
  docHint: { fontSize: 12, color: T.ink4, marginTop: 3, lineHeight: 17 },
  requiredBadge: { paddingHorizontal: S.s2, paddingVertical: 4, borderRadius: R.sm, backgroundColor: T.dangerLight, borderWidth: 1, borderColor: T.dangerBorder },
  requiredText: { fontSize: 10, fontWeight: '900', color: T.dangerText },
  uploadBtn: { marginTop: S.s4, height: 48, borderRadius: R.md, borderWidth: 1, borderColor: T.violet, backgroundColor: T.violetDim, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: S.s2 },
  uploadText: { color: T.violet, fontSize: 13, fontWeight: '900' },
  previewWrap: { marginTop: S.s4 },
  preview: { width: '100%', height: 190, borderRadius: R.md, backgroundColor: T.surfaceCard },
  previewActions: { marginTop: S.s2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: S.s2 },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: S.s1, paddingHorizontal: S.s3, paddingVertical: S.s2 },
  changeText: { color: T.violet, fontWeight: '800', fontSize: 12 },
  removeText: { color: T.dangerText, fontWeight: '800', fontSize: 12 },
  requiredNote: { color: T.ink4, fontSize: 12, lineHeight: 18, marginTop: S.s3 },
  submitBtn: { marginTop: S.s5, height: 50, borderRadius: R.md, backgroundColor: T.violet, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { color: T.onPrimary, fontSize: 14, fontWeight: '900' },
});
