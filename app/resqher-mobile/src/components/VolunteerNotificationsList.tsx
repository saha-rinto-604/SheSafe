import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R } from '../constants/theme';

type Notification = {
  id: string;
  title: string;
  body: string;
};

export default function VolunteerNotificationsList({
  notifications,
  emptyText = 'No notifications',
}: {
  notifications: Notification[];
  emptyText?: string;
}) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    >
      {notifications.length === 0 && (
        <View style={styles.emptyCard}>
          <Feather name="bell-off" size={20} color={T.ink4} />
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
      {notifications.map((item, index) => (
        <View key={item.id}>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Feather name="bell" size={18} color={T.violet} />
            </View>
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
          {index < notifications.length - 1 && <View style={{ height: 12 }} />}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: T.violetDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${T.violet}30`,
    flexShrink: 0,
  },
  card: {
    flex: 1,
    backgroundColor: T.surfaceBulky,
    borderRadius: R.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: T.ink,
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    fontWeight: '500',
    color: T.ink4,
    lineHeight: 18,
  },
  emptyCard: {
    minHeight: 150,
    borderRadius: R.lg,
    backgroundColor: T.surfaceBulky,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink4,
    textAlign: 'center',
  },
});
