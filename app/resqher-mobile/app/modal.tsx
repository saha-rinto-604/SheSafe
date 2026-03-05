import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { T, R, S, Ty } from '../src/constants/theme';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={st.header}>
        <Text style={st.title}>Details</Text>
        <TouchableOpacity onPress={() => router.back()} style={st.closeBtn}>
          <Feather name="x" size={20} color={T.ink2} />
        </TouchableOpacity>
      </View>
      <View style={st.body}>
        <Text style={st.bodyText}>Modal content goes here.</Text>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.surface },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: S.s4, paddingVertical: S.s3,
    borderBottomWidth: 1, borderBottomColor: T.lineMid,
  },
  title: { ...Ty.h3 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.surfaceCard, borderWidth: 1, borderColor: T.lineMid,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, padding: S.s5, alignItems: 'center', justifyContent: 'center' },
  bodyText: { ...Ty.body, color: T.ink3 },
});
