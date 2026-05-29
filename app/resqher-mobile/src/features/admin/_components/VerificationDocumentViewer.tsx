import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R } from '../../../constants/theme';

type VerificationDocument = {
  label: string;
  uri?: string | null;
  required?: boolean;
};

type Props = {
  documents: VerificationDocument[];
};

export function VerificationDocumentViewer({ documents }: Props) {
  const [selectedDocument, setSelectedDocument] = useState<VerificationDocument | null>(null);

  return (
    <View style={st.container}>
      {documents.map((document) => (
        <View key={document.label} style={st.docItem}>
          <View style={st.docHeader}>
            <View style={st.docTitleRow}>
              <Feather name={document.uri ? 'file-text' : 'file-minus'} size={16} color={document.uri ? T.violet : T.ink4} />
              <Text style={st.docLabel}>{document.label}</Text>
            </View>
            <View style={st.docActions}>
              <Text style={[st.docStatus, document.uri ? st.docStatusOk : st.docStatusMissing]}>
                {document.uri ? 'Uploaded' : document.required ? 'Missing' : 'Not provided'}
              </Text>
              {!!document.uri && (
                <TouchableOpacity style={st.viewBtn} onPress={() => setSelectedDocument(document)} activeOpacity={0.78}>
                  <Feather name="eye" size={14} color={T.onPrimary} />
                  <Text style={st.viewText}>View</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {!document.uri && (
            <View style={st.missingBox}>
              <Feather name="file-minus" size={22} color={T.ink4} />
              <Text style={st.missingText}>No document preview available</Text>
            </View>
          )}
        </View>
      ))}

      <Modal
        visible={!!selectedDocument?.uri}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDocument(null)}
      >
        <View style={st.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedDocument(null)} />
          <View style={st.modalCard}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{selectedDocument?.label}</Text>
              <TouchableOpacity style={st.closeBtn} onPress={() => setSelectedDocument(null)} activeOpacity={0.78}>
                <Feather name="x" size={18} color={T.ink3} />
              </TouchableOpacity>
            </View>
            {!!selectedDocument?.uri && (
              <Image source={{ uri: selectedDocument.uri }} style={st.docImage} resizeMode="contain" />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { gap: 10 },
  docItem: { gap: 10 },
  docHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  docTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  docLabel: { fontSize: 14, fontWeight: '700', color: T.ink, flex: 1 },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docStatus: { fontSize: 11, fontWeight: '900' },
  docStatusOk: { color: T.success },
  docStatusMissing: { color: T.gold },
  viewBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: R.md,
    backgroundColor: T.violet,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewText: { fontSize: 11, fontWeight: '900', color: T.onPrimary },
  docImage: {
    width: '100%',
    height: 420,
    borderRadius: R.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  missingBox: {
    height: 100,
    borderRadius: R.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: T.lineMid,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  missingText: { fontSize: 12, color: T.ink4, fontWeight: '700' },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    borderRadius: R.lg,
    backgroundColor: '#0F1020',
    borderWidth: 1,
    borderColor: T.lineMid,
    padding: 14,
    gap: 12,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { flex: 1, fontSize: 15, fontWeight: '900', color: T.ink },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: R.md,
    backgroundColor: T.surfaceCard,
    borderWidth: 1,
    borderColor: T.lineMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VerificationDocumentViewer;
