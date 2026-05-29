import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, S, Ty } from '../constants/theme';

type IncidentEndStatus = 'RESOLVED' | 'CANCELLED';

type Props = {
  visible: boolean;
  status: IncidentEndStatus;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export default function IncidentStatusAlert({
  visible,
  status,
  message,
  confirmLabel = 'OK',
  onConfirm,
}: Props) {
  const isResolved = status === 'RESOLVED';
  const title = isResolved ? 'Incident Resolved' : 'Incident Cancelled';
  const color = isResolved ? T.success : T.danger;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onConfirm}>
      <View style={st.backdrop}>
        <View style={st.card}>
          <View style={[st.iconWrap, { borderColor: `${color}55`, backgroundColor: `${color}18` }]}>
            <Feather name={isResolved ? 'check-circle' : 'alert-triangle'} size={24} color={color} />
          </View>
          <Text style={st.title}>{title}</Text>
          <Text style={st.message}>
            {message || 'This incident is no longer active. Returning you to your dashboard.'}
          </Text>
          <TouchableOpacity style={st.actionBtn} onPress={onConfirm} activeOpacity={0.82}>
            <Text style={st.actionText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 2, 10, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.s5,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: S.s5,
    borderRadius: R.lg,
    backgroundColor: T.surfaceBulky,
    borderWidth: 1,
    borderColor: T.lineMid,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 14 },
    }),
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: R.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.s3,
  },
  title: { ...Ty.h3, color: T.ink, textAlign: 'center' },
  message: { ...Ty.bodySm, color: T.ink3, textAlign: 'center', lineHeight: 20, marginTop: S.s2 },
  actionBtn: {
    marginTop: S.s5,
    minHeight: 44,
    alignSelf: 'stretch',
    borderRadius: R.md,
    backgroundColor: T.violet,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.s4,
  },
  actionText: { color: T.onPrimary, fontSize: 13, fontWeight: '900' },
});
