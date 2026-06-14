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
import { ROLE_DEFAULT_ROUTE } from '../../src/constants/routes';
import { useToast } from '../../src/components/Toast';
import SheSafeLogo from '../../src/components/SheSafeLogo';
import SecureTextField from '../../components/auth/SecureTextField';
import { getApiBaseUrlError, isAuthConnectionError, SERVER_UNREACHABLE_MESSAGE, warmAuthBackend } from '../../src/services/api';

type FormData = { phone: string; password: string };

export default function AdminLogin() {
  const router = useRouter();
  const { signInAdmin, signOut, isLoading: authLoading, isSignedIn, role } = useAuth();
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

  useEffect(() => {
    if (!authLoading && isSignedIn && role === 'ADMIN') {
      router.replace(ROLE_DEFAULT_ROUTE.ADMIN as any);
    }
  }, [authLoading, isSignedIn, role, router]);

  const onSubmit = async (data: FormData) => {
    if (submittingRef.current || submitting || authLoading) return;
    clearToast();
    const apiError = getApiBaseUrlError();
    if (apiError) {
      showToast({ type: 'error', title: 'Connection unavailable', message: SERVER_UNREACHABLE_MESSAGE });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const phone = data.phone.trim();
      const password = data.password;

      const { role } = await signInAdmin(phone, password);
      if (role !== 'ADMIN') {
        await signOut();
        showToast({
          type: 'warning',
          title: 'Admin Access Only',
          message: 'These credentials do not have admin access.',
          duration: 4500,
        });
        return;
      }
      showToast({ type: 'success', title: 'Admin access confirmed', message: 'Welcome back to SheSafe administration.' });
      router.replace(ROLE_DEFAULT_ROUTE.ADMIN as any);
    } catch (e: any) {
      const connectionIssue = isAuthConnectionError(e);
      showToast({
        type: 'error',
        title: connectionIssue ? 'Connection unavailable' : 'Admin sign-in failed',
        message: connectionIssue
          ? SERVER_UNREACHABLE_MESSAGE
          : 'Invalid admin credentials.',
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const busy = submitting || authLoading;

  return (
    <AuthShell variant="admin">
      <ScrollView
        style={{ borderRadius: R.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={st.card}>
          <View style={st.header}>
            <SheSafeLogo size={34} center style={st.logo} />
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
                      placeholder="Admin phone number"
                      placeholderTextColor={T.ink5}
                      value={value}
                      onChangeText={onChange}
                      keyboardType="phone-pad"
                      style={st.input}
                      onFocus={() => setFocused('phone')}
                      onBlur={() => setFocused(null)}
                      accessibilityLabel="Admin phone number"
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

            <TouchableOpacity
              disabled
              style={st.forgotRow}
              activeOpacity={1}
            >
              <Text style={st.forgotTxt}>Admin credentials are managed privately</Text>
            </TouchableOpacity>
          </View>

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
                : <Text style={st.btnTxt}>Sign in to Admin Portal</Text>
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
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none',
      } as any,
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
