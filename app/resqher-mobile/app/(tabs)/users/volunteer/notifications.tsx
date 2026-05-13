import React from 'react';
import { View, StatusBar, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import VolunteerNotificationsList from '../../../../src/components/VolunteerNotificationsList';
import { T } from '../../../../src/constants/theme';

const MOCK_VOL_NOTIFS = [
  { id: 'v1', title: 'New SOS Nearby', body: 'A new SOS request was posted 800m from your area. Check the map to respond.' },
  { id: 'v2', title: 'Training Reminder', body: 'Community first-aid training tomorrow at 6:00 PM.' },
  { id: 'v3', title: 'Badge Earned', body: 'You earned a Rapid Responder badge — well done!' },
];

export default function VolunteerNotifications() {
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

        <VolunteerNotificationsList notifications={MOCK_VOL_NOTIFS} />
      </View>
    </AtmosphericShell>
  );
}
