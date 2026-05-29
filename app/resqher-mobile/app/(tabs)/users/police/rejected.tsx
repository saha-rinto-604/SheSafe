import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { T, Ty, R, S } from '../../../../src/constants/theme';

export default function PoliceRejected() {
  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={st.card}>
        <Feather name="x-circle" size={34} color={T.danger} />
        <Text style={st.title}>Police verification was rejected.</Text>
        <Text style={st.text}>Please contact admin/support if you believe this needs another review.</Text>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg, justifyContent: 'center', padding: S.s5 },
  card: { alignItems: 'center', padding: S.s6, borderRadius: R.lg, backgroundColor: T.surfaceBulkyGlass, borderWidth: 1, borderColor: T.lineMid },
  title: { ...Ty.h2, color: T.ink, textAlign: 'center', marginTop: S.s4 },
  text: { ...Ty.body, color: T.ink3, textAlign: 'center', marginTop: S.s2 },
});
