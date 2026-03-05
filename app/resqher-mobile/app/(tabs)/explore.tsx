import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, R, S, Ty } from '../../src/constants/theme';
import { Feather } from '@expo/vector-icons';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={st.center}>
        <View style={st.iconBox}>
          <Feather name="compass" size={40} color={T.violet} />
        </View>
        <Text style={st.title}>Explore</Text>
        <Text style={st.subtitle}>Discover nearby resources and safe spaces.</Text>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.s5 },
  iconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.lineMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: S.s4,
  },
  title: { ...Ty.h2, marginBottom: S.s2, textAlign: 'center' },
  subtitle: { ...Ty.bodySm, color: T.ink3, textAlign: 'center' },
});
