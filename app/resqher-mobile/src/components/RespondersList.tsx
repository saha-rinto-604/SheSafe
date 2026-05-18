import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Image, FlatList, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, S, R } from '../constants/theme';
import UserAvatar from './shared/UserAvatar';

// Accept a flexible responder shape for mock lists
type ResponderItem = {
  id: string;
  name: string;
  avatarUri?: string | null;
  avatarUrl?: string | null;
  role?: string;
  isAdmin?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  data: ResponderItem[];
  onRemove: (id: string) => void;
};

export default function RespondersList({ visible, onClose, data, onRemove }: Props) {
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  const renderRow = ({ item }: { item: ResponderItem }) => (
    <View style={styles.row}>
      <View style={styles.leftRow}>
        <UserAvatar uri={item.avatarUri ?? item.avatarUrl} size={44} style={styles.avatar} />
        <View>
          <Text style={styles.name}>{item.name}</Text>
          {(item.isAdmin || item.role === 'POLICE') && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminText}>ADMIN</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.rightRow}>
        <TouchableOpacity onPress={() => setOpenMenuFor(openMenuFor === item.id ? null : item.id)} style={styles.kebabBtn}>
          <Feather name="more-vertical" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {openMenuFor === item.id && (
          <View style={styles.actionMenu}>
            <TouchableOpacity style={styles.actionRow} onPress={() => { onRemove(item.id); setOpenMenuFor(null); }}>
              <Feather name="trash-2" size={14} color="#FF453A" />
              <Text style={styles.actionText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Responders</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={data}
            keyExtractor={(i) => i.id}
            renderItem={renderRow}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.03)', marginVertical: 8 }} />}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1E153A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  name: { color: '#FFFFFF', fontWeight: '700', marginLeft: 10 },
  rightRow: { flexDirection: 'row', alignItems: 'center' },
  kebabBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  actionMenu: { backgroundColor: '#2A213E', borderRadius: 12, padding: 8, marginLeft: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionText: { color: '#FF453A', fontWeight: '700', marginLeft: 8 },
  adminBadge: { marginTop: 4, backgroundColor: 'rgba(255,69,58,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  adminText: { color: '#FF453A', fontWeight: '800', fontSize: 11 },
});
