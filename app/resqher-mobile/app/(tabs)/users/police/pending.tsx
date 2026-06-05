import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { T, Ty, R, S } from '../../../../src/constants/theme';
import SheSafeMark from '../../../../src/components/SheSafeMark';
import api from '../../../../src/services/api';
import { useAuth } from '../../../../src/context/AuthContext';

export default function PolicePending() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const goToLogin = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/login' as any);
  }, [router, signOut]);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await api.get('/api/police-verification');
      const status = data?.verification?.status;
      if (status === 'approved') {
        router.replace('/(tabs)/users/police/dashboard' as any);
      } else if (status === 'rejected' || status === 'not_submitted') {
        router.replace('/(tabs)/users/police/verification' as any);
      }
    } catch {
      // Keep the pending screen visible if the status check fails briefly.
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    const initialTimer = setTimeout(checkStatus, 0);
    const timer = setInterval(checkStatus, 5000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [checkStatus]);

  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <TouchableOpacity
        style={[st.backBtn, { top: insets.top + S.s3 }]}
        onPress={goToLogin}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.75}
      >
        <Feather name="chevron-left" size={22} color={T.ink} />
      </TouchableOpacity>
      <View style={st.card}>
        <View style={st.logoWrap}>
          <SheSafeMark size={58} />
        </View>
        <Text style={st.title}>Your police account is pending verification.</Text>
        <Text style={st.text}>Admin will review your NID, job ID card, and account details.</Text>
        <TouchableOpacity style={st.refreshBtn} onPress={checkStatus} activeOpacity={0.78}>
          {checking ? <ActivityIndicator size="small" color={T.onPrimary} /> : <Text style={st.refreshText}>Check Status</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg, justifyContent: 'center', padding: S.s5 },
  backBtn: { position: 'absolute', left: S.s4, width: 36, height: 36, borderRadius: R.hBtn, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.lineMid, backgroundColor: T.surfaceCard, zIndex: 5 },
  card: { alignItems: 'center', padding: S.s6, borderRadius: R.lg, backgroundColor: T.surfaceBulkyGlass, borderWidth: 1, borderColor: T.lineMid },
  logoWrap: { width: 74, height: 74, borderRadius: R.lg, backgroundColor: T.violetDim, borderWidth: 1, borderColor: T.lineMid, alignItems: 'center', justifyContent: 'center' },
  title: { ...Ty.h2, color: T.ink, textAlign: 'center', marginTop: S.s4 },
  text: { ...Ty.body, color: T.ink3, textAlign: 'center', marginTop: S.s2 },
  refreshBtn: { marginTop: S.s4, minHeight: 42, minWidth: 130, paddingHorizontal: S.s4, borderRadius: R.md, backgroundColor: T.violet, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: T.onPrimary, fontSize: 13, fontWeight: '900' },
});
