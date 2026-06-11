import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AuthShell from '../../components/auth/AuthShell';
import { T, R, S, Ty } from '../../src/constants/theme';
import { G } from '../../src/constants/gradients';
import { useAuth } from '../../src/context/AuthContext';
import { routeForRoleStatus } from '../../src/constants/routes';
import { useToast } from '../../src/components/Toast';
import SheSafeLogo from '../../src/components/SheSafeLogo';
import SecureTextField from '../../components/auth/SecureTextField';
import { getApiBaseUrlError, isAuthConnectionError, warmAuthBackend } from '../../src/services/api';

type FormData = { phone: string; password: string };

export default function Login() {
  const router = useRouter();
  const { signIn, isLoading: authLoading } = useAuth();
  const { showToast, clearToast } = useToast();
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { phone: '', password: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<'phone' | 'password' | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    void warmAuthBackend();
  }, []);

  const onSubmit = async (data: FormData) => {
    if (submittingRef.current || submitting || authLoading) return;
    clearToast();
    const apiError = getApiBaseUrlError();
    if (apiError) {
      showToast({ type: 'error', title: 'Connection unavailable', message: 'We couldn’t reach SheSafe servers. Please check your connection and try again.' });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const phone = data.phone.trim();
      const password = data.password;

      const { role, verificationStatus, user } = await signIn(phone, password);
      const route = routeForRoleStatus(role, verificationStatus, user);
      showToast({
        type: 'success',
        title: role === 'POLICE' ? 'Police access confirmed' : 'Welcome back.',
        message: role === 'POLICE' ? 'Welcome back to SheSafe law enforcement.' : 'You’re signed in securely.',
      });
      router.replace(route as any);
    } catch (e: any) {
      const connectionIssue = isAuthConnectionError(e);
      showToast({
        type: 'error',
        title: connectionIssue ? 'Connection unavailable' : 'Sign-in failed',
        message: connectionIssue
          ? 'We couldn’t reach SheSafe servers. Please check your connection and try again.'
          : 'The phone number or password is incorrect.',
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const busy = submitting || authLoading;

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
            <SheSafeLogo size={34} center style={st.logo} />
            <Text style={st.title}>Welcome back</Text>
            <Text style={st.subtitle}>Sign in to your SheSafe account</Text>
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

            {/* Password */}
            <Controller
              control={control}
              name="password"
              rules={{ required: 'Password is required' }}
              render={({ field: { onChange, value } }) => (
                <>
                  <SecureTextField
                    placeholder="Password"
                    value={value}
                    onChangeText={onChange}
                    focused={focused === 'password'}
                    hasError={!!errors.password}
                    containerStyle={st.inputWrap}
                    focusedStyle={st.inputFocused}
                    errorStyle={st.inputError}
                    inputStyle={st.input}
                    iconStyle={st.inputIcon}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    accessibilityLabel="Password"
                  />
                  {!!errors.password && <Text style={st.errTxt}>{errors.password.message}</Text>}
                </>
              )}
            />

            {/* Forgot password */}
            <TouchableOpacity
              disabled={busy}
              onPress={() => router.push('/(auth)/forgot-password' as any)}
              style={st.forgotRow}
              activeOpacity={0.7}
            >
              <Text style={st.forgotTxt}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* ── Login button ── */}
          <TouchableOpacity
            disabled={busy}
            style={st.primaryBtn}
            onPress={() => handleSubmit(onSubmit)()}
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
              {busy
                ? <ActivityIndicator color={T.onPrimary} />
                : <Text style={st.btnTxt}>Login</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Sign up link ── */}
          <TouchableOpacity
            disabled={busy}
            onPress={() => router.push('/(auth)/signup')}
            style={st.linkRow}
            activeOpacity={0.7}
          >
            <Text style={st.linkTxt}>
              Don&apos;t have an account?{'  '}
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
    backgroundColor: T.surfaceBulkyGlass,
    borderRadius: R.xl,
    padding: S.s5,
    paddingBottom: S.s4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.hairlineMicro,
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.25, shadowRadius: 28, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
    }),
  },

  header: { alignItems: 'center', marginBottom: S.s4 },
  logo: { marginBottom: S.s3 },
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
  linkAccent: { color: T.violet, fontWeight: '700', fontSize: 14 },
});
