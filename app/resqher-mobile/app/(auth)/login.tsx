import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, UIManager, ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import AuthShell from '../../components/auth/AuthShell';
import { T, R, S, Ty, Theme } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

type FormData = { phone: string; password: string };

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { phone: '', password: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<'phone' | 'password' | null>(null);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      /* Real auth: await signIn(data.phone.trim(), data.password); */
      router.replace('/users/sos_screen');
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Please check your credentials.');
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
          {/* ── Header ── */}
          <View style={st.header}>
            <Text style={st.title}>Welcome back</Text>
            <Text style={st.subtitle}>Sign in to your ResQher account</Text>
          </View>

          {/* ── Fields ── */}
          <View style={st.form}>
            {/* Phone */}
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
                      color={focused === 'phone' ? T.violet : T.ink4}
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

            {/* Password */}
            <Controller
              control={control}
              name="password"
              rules={{ required: 'Password is required', minLength: { value: 4, message: 'Min 4 characters' } }}
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
                      color={focused === 'password' ? T.violet : T.ink4}
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

            {/* Forgot password */}
            <TouchableOpacity
              onPress={() => Alert.alert('Reset password', 'A reset link will be sent to your registered phone.')}
              style={st.forgotRow}
              activeOpacity={0.7}
            >
              <Text style={st.forgotTxt}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* ── Login button ── */}
          <TouchableOpacity
            disabled={submitting}
            style={st.primaryBtn}
            onPress={handleSubmit(onSubmit)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Login"
          >
            <LinearGradient
              colors={[T.violet, T.violetDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={st.gradientBtn}
            >
              {submitting
                ? <ActivityIndicator color={T.onPrimary} />
                : <Text style={st.btnTxt}>Login</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Sign up link ── */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            style={st.linkRow}
            activeOpacity={0.7}
          >
            <Text style={st.linkTxt}>
              Don't have an account?{'  '}
              <Text style={st.linkAccent}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AuthShell>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: R.xl,
    padding: S.s5,
    paddingBottom: S.s4,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: T.ink, shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 5 },
    }),
  },

  // ── Header — reduced bottom margin so it fits on one screen
  header: { alignItems: 'center', marginBottom: S.s4 },
  title: { ...Ty.h2, marginBottom: 2 },
  subtitle: { ...Ty.bodySm, color: T.ink4, textAlign: 'center' },

  // ── Form group
  form: { gap: S.s2 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: R.sm,
    borderWidth: 1.5,
    borderColor: T.lineMid,
    backgroundColor: T.bgMuted,
    paddingHorizontal: S.s4,
  },
  inputFocused: {
    borderColor: T.violet,
    borderWidth: 2,
    backgroundColor: T.surface,
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
  },
  errTxt: {
    ...Ty.error,
    marginTop: 2,
  },

  // Forgot password — sits inline below password field, right-aligned
  forgotRow: { alignItems: 'flex-end', paddingVertical: 2 },
  forgotTxt: { fontSize: 13, fontWeight: '600', color: T.violet },

  // ── Button
  primaryBtn: {
    marginTop: S.s4,
    borderRadius: R.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: T.violetDark, shadowOpacity: 0.30, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 5 },
    }),
  },
  gradientBtn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { ...Ty.btn },

  // ── Bottom link
  linkRow: { marginTop: S.s3, alignItems: 'center', paddingVertical: S.s1 },
  linkTxt: { ...Ty.helper, fontSize: 13, color: T.ink4 },
  linkAccent: { color: T.violet, fontWeight: '700' },
});
