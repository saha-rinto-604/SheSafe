import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, UIManager, ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import AuthShell from '../../components/auth/AuthShell';
import { T, R, S, Ty } from '../../src/constants/theme';
import { G } from '../../src/constants/gradients';
import { useAuth } from '../../src/context/AuthContext';
import { ROLE_DEFAULT_ROUTE } from '../../src/constants/routes';
import { useToast } from '../../src/components/Toast';

type FormData = { phone: string; password: string };

export default function AdminLogin() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { phone: '', password: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<'phone' | 'password' | null>(null);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const phone = data.phone.trim();
      const password = data.password;

      // Mock admin login shortcut
      if (phone === '01727307772' && password === 'admin9090') {
        setTimeout(() => {
          setSubmitting(false);
          router.replace('/(tabs)/users/admin/dashboard' as any);
        }, 600);
        return;
      }

      const { role } = await signIn(phone, password);
      if (role !== 'ADMIN') {
        showToast({
          type: 'warning',
          title: 'Admin Access Only',
          message: 'These credentials do not have admin access. Redirecting to the correct dashboard.',
          duration: 4500,
        });
      }
      const route = ROLE_DEFAULT_ROUTE[role] || ROLE_DEFAULT_ROUTE.USER;
      router.replace(route as any);
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.toLowerCase().includes('sign up')) {
        showToast({
          type: 'warning',
          title: 'Account Not Found',
          message: 'No admin account exists with this phone number.',
        });
      } else {
        showToast({
          type: 'error',
          title: 'Authentication Failed',
          message: 'Please check your phone number and password, then try again.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <ScrollView
        style={{ borderRadius: R.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={st.card}>
          <View style={st.header}>
            <Text style={st.title}>Admin Portal</Text>
            <Text style={st.subtitle}>Sign in to manage system access and approvals.</Text>
          </View>

          <View style={st.form}>
            <Controller
              control={control}
              name="phone"
              rules={{ required: 'Phone is required' }}
              render={({ field: { onChange, value } }) => (
                <>
                  <View style={[
                    st.inputWrap,
                    focused === 'phone' && st.inputFocused,
                    errors.phone && st.inputError,
                  ]}>
                    <Feather
                      name="phone"
                      size={18}
                      color={focused === 'phone' ? T.violet : T.inputIconDefault}
                      style={st.inputIcon}
                    />
                    <TextInput
                      placeholder="Phone number"
                      placeholderTextColor={T.ink5}
                      value={value}
                      onChangeText={onChange}
                      keyboardType="phone-pad"
                      style={st.input}
                      onFocus={() => setFocused('phone')}
                      onBlur={() => setFocused(null)}
                      accessibilityLabel="Phone number"
                    />
                  </View>
                  {!!errors.phone && <Text style={st.errTxt}>{errors.phone.message}</Text>}
                </>
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{ required: 'Password is required' }}
              render={({ field: { onChange, value } }) => (
                <>
                  <View style={[
                    st.inputWrap,
                    focused === 'password' && st.inputFocused,
                    errors.password && st.inputError,
                  ]}>
                    <Feather
                      name="lock"
                      size={18}
                      color={focused === 'password' ? T.violet : T.inputIconDefault}
                      style={st.inputIcon}
                    />
                    <TextInput
                      placeholder="Password"
                      placeholderTextColor={T.ink5}
                      value={value}
                      onChangeText={onChange}
                      secureTextEntry
                      style={st.input}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      accessibilityLabel="Password"
                    />
                  </View>
                  {!!errors.password && <Text style={st.errTxt}>{errors.password.message}</Text>}
                </>
              )}
            />

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password' as any)}
              style={st.forgotRow}
              activeOpacity={0.7}
            >
              <Text style={st.forgotTxt}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            disabled={submitting}
            style={st.primaryBtn}
            onPress={handleSubmit(onSubmit)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Login"
          >
            <LinearGradient
              colors={G.navActive.colors}
              start={G.navActive.start}
              end={G.navActive.end}
              style={st.gradientBtn}
            >
              {submitting
                ? <ActivityIndicator color={T.onPrimary} />
                : <Text style={st.btnTxt}>Login</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <View style={st.linkRow}>
            <Text style={st.linkTxt}>Admin access only</Text>
          </View>
        </View>
      </ScrollView>
    </AuthShell>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: T.surfaceBulkyGlass,
    borderRadius: R.xl,
    padding: S.s5,
    paddingBottom: S.s4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.hairlineMicro,
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.25, shadowRadius: 28, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
    }),
  },

  header: { alignItems: 'center', marginBottom: S.s4 },
  title: { ...Ty.h2, marginBottom: 2 },
  subtitle: { ...Ty.bodySm, color: T.ink4, textAlign: 'center' },

  form: { gap: S.s2 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: T.surfaceCard,
    paddingHorizontal: S.s4,
    marginBottom: S.s3,
  },
  inputFocused: {
    borderColor: T.violet,
    borderWidth: 1,
    backgroundColor: 'rgba(138,56,246,0.06)',
  },
  inputError: {
    borderColor: T.danger,
    backgroundColor: T.dangerLight,
  },
  inputIcon: { marginRight: S.s2 },
  input: {
    flex: 1,
    height: '100%',
    color: T.ink,
    fontSize: 15,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none',
      },
    }),
  },
  errTxt: {
    ...Ty.error,
    marginTop: 2,
  },

  forgotRow: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotTxt: { fontSize: 13, fontWeight: '600', color: T.violet },

  primaryBtn: {
    marginTop: S.s4,
    borderRadius: R.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  gradientBtn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { ...Ty.btn },

  linkRow: { marginTop: S.s3, alignItems: 'center', paddingVertical: S.s1 },
  linkTxt: { ...Ty.helper, fontSize: 13, color: T.ink4 },
});
