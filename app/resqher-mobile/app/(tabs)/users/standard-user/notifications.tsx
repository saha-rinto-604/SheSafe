import React from 'react';
import { View, StatusBar, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import StandardUserNotificationsList from '../../../../src/components/StandardUserNotificationsList';
import { T } from '../../../../src/constants/theme';

const MOCK_NOTIFS = [
  { id: 'n1', title: 'Emergency Contact Verified', body: 'Your emergency contact John Doe has accepted your request.' },
  { id: 'n2', title: 'Privacy Checkup', body: 'Review your active location sharing settings to ensure you are only sharing with trusted contacts.' },
  { id: 'n3', title: 'System Alert', body: 'A new safe zone has been verified near your work address.' },
  { id: 'n4', title: 'Weekly Summary', body: 'You had no unresolved alerts this week. Keep up the good work staying safe.' },
];

export default function StandardUserNotifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <AtmosphericShell>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: 'transparent' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: T.surfaceBulky }}
              onPress={() => router.back()}
              hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            >
              <Feather name="chevron-left" size={22} color={T.ink} />
            </TouchableOpacity>

            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: T.ink }}>Notifications</Text>
              <Text style={{ fontSize: 12, color: T.ink4, marginTop: 2 }}>Recent alerts and updates</Text>
            </View>
          </View>
        </View>

        <StandardUserNotificationsList notifications={MOCK_NOTIFS} />
      </View>
    </AtmosphericShell>
  );
}
