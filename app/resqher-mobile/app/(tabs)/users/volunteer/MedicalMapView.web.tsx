import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { T, R, S, Ty } from '../../../../src/constants/theme';

export default function VolunteerMedicalMapViewWeb() {
  const router = useRouter();

  return (
    <View style={st.root}>
      <View style={st.card}>
        <View style={st.iconWrap}>
          <Feather name="map" size={28} color={T.violet} />
        </View>
        <Text style={st.title}>Medical Map</Text>
        <Text style={st.copy}>
          The native medical map uses Google Maps through react-native-maps and is available in Expo Go or native builds.
        </Text>
        <Pressable style={st.button} onPress={() => router.back()}>
          <Feather name="arrow-left" size={16} color={T.onPrimary} />
          <Text style={st.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bg,
    padding: S.s5,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: T.surfaceBulky,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: T.lineMid,
    padding: S.s5,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: R.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.violetDim,
    marginBottom: S.s4,
  },
  title: {
    ...Ty.h2,
    textAlign: 'center',
    marginBottom: S.s2,
  },
  copy: {
    ...Ty.bodyMd,
    color: T.ink3,
    textAlign: 'center',
    marginBottom: S.s5,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.s2,
    backgroundColor: T.violet,
    borderRadius: R.md,
    paddingHorizontal: S.s5,
    paddingVertical: S.s3,
  },
  buttonText: {
    ...Ty.btn,
    fontSize: 14,
  },
});
