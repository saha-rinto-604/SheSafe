/**
 * forgot-password.tsx — Two-step password reset via OTP
 * Step 1: Enter phone number → request OTP
 * Step 2: Enter OTP + new password → reset
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import AuthShell from '../../components/auth/AuthShell';
import { T, R, S } from '../../src/constants/theme';
import { G } from '../../src/constants/gradients';
import { authService } from '../../src/services/api';
import { useToast } from '../../src/components/Toast';
import PasswordStrength, { isStrongPassword } from '../../src/components/PasswordStrength';

// Simple shared input field
function Field({
  icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, focused, onFocus, onBlur, error,
}: {
  icon: keyof typeof Feather.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  focused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  error?: string;
}) {
  return (
    <View style={{ marginBottom: S.s3 }}>
      <View style={[
        st.inputWrap,
        focused && st.inputFocused,
        !!error && st.inputError,
      ]}>
        <Feather name={icon} size={18} color={focused ? T.violet : 'rgba(255,255,255,0.35)'} style={st.inputIcon} />
        <TextInput
          style={st.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType ?? 'default'}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCapitalize="none"
        />
      </View>
      {!!error && <Text style={st.errTxt}>{error}</Text>}
    </View>
  );
}

export default function ForgotPassword() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      showToast({ type: 'warning', title: 'Phone Required', message: 'Please enter your registered phone number.' });
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword(trimmed);
      showToast({ type: 'success', title: 'OTP Sent', message: 'Check your phone for the verification code.' });
      setStep(2);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Request Failed', message: e?.message ?? 'Unable to send OTP. Please verify your phone number.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      showToast({ type: 'warning', title: 'Invalid OTP', message: 'Please enter the 6-digit verification code.' });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      showToast({
        type: 'error',
        title: 'Weak Password',
        message: 'Password does not meet security requirements. Please include uppercase, numbers, and special characters.',
        duration: 5000,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ type: 'warning', title: 'Password Mismatch', message: 'The passwords you entered do not match. Please try again.' });
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(phone.trim(), trimmedOtp, newPassword);
      showToast({
        type: 'success',
        title: 'Password Reset Complete',
        message: 'Your password has been updated. Please sign in with your new credentials.',
        action: { label: 'Sign In', onPress: () => router.replace('/(auth)/login' as any) },
        duration: 6000,
      });
      // Navigate after a short delay so the toast is visible
      setTimeout(() => router.replace('/(auth)/login' as any), 2000);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Reset Failed', message: e?.message ?? 'Invalid or expired OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell onBack={() => (step === 2 ? setStep(1) : router.back())}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={st.card}>
          {/* ── Step indicator ── */}
          <View style={st.stepRow}>
            {[1, 2].map((n) => (
              <View
                key={n}
                style={[st.stepDot, step >= n && st.stepDotActive]}
              />
            ))}
          </View>

          {/* ── Header ── */}
          <View style={st.header}>
            <Text style={st.title}>
              {step === 1 ? 'Forgot Password' : 'Reset Password'}
            </Text>
            <Text style={st.subtitle}>
              {step === 1
                ? 'Enter your phone number to receive a one-time code.'
                : `Enter the OTP sent to ${phone} and choose a new password.`}
            </Text>
          </View>

          {/* ── Step 1: Phone entry ── */}
          {step === 1 && (
            <>
              <Field
                icon="phone"
                placeholder="Phone number (e.g. 01XXXXXXXXX)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                focused={focused === 'phone'}
                onFocus={() => setFocused('phone')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity
                style={st.primaryBtn}
                onPress={handleRequestOtp}
                activeOpacity={0.82}
                disabled={loading}
              >
                <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={st.gradientBtn}>
                  {loading ? <ActivityIndicator color={T.onPrimary} /> : <Text style={st.btnTxt}>Send OTP</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 2: OTP + new password ── */}
          {step === 2 && (
            <>
              <Field
                icon="key"
                placeholder="6-digit OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                focused={focused === 'otp'}
                onFocus={() => setFocused('otp')}
                onBlur={() => setFocused(null)}
              />
              <Field
                icon="lock"
                placeholder="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                focused={focused === 'pw'}
                onFocus={() => setFocused('pw')}
                onBlur={() => setFocused(null)}
              />
              <PasswordStrength password={newPassword} />
              <Field
                icon="lock"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                focused={focused === 'cpw'}
                onFocus={() => setFocused('cpw')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity
                style={st.primaryBtn}
                onPress={handleResetPassword}
                activeOpacity={0.82}
                disabled={loading}
              >
                <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={st.gradientBtn}>
                  {loading ? <ActivityIndicator color={T.onPrimary} /> : <Text style={st.btnTxt}>Reset Password</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={st.resendRow}
                onPress={handleRequestOtp}
                activeOpacity={0.7}
              >
                <Text style={st.resendTxt}>Didn&apos;t receive OTP? Resend</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Back to login ── */}
          <TouchableOpacity
            style={st.linkRow}
            onPress={() => router.replace('/(auth)/login' as any)}
            activeOpacity={0.7}
          >
            <Text style={st.linkTxt}>
              Remember your password?{'  '}
              <Text style={st.linkAccent}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AuthShell>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(18,12,38,0.82)',
    borderRadius: R.xl,
    padding: S.s5,
    paddingBottom: S.s4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.25, shadowRadius: 28, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
    }),
  },

  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: S.s4 },
  stepDot: { width: 28, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepDotActive: { backgroundColor: T.violet },

  header: { alignItems: 'center', marginBottom: S.s4 },
  title: { fontSize: 22, fontWeight: '700', color: T.ink, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 18 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: S.s4,
  },
  inputFocused: { borderColor: T.violet, backgroundColor: 'rgba(138,56,246,0.06)' },
  inputError: { borderColor: T.danger },
  inputIcon: { marginRight: S.s2 },
  input: { flex: 1, height: '100%', color: T.ink, fontSize: 15 },
  errTxt: { fontSize: 12, color: T.danger, marginTop: 2 },

  primaryBtn: {
    marginTop: S.s4,
    borderRadius: R.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  gradientBtn: { height: 50, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: T.onPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  resendRow: { alignItems: 'center', marginTop: S.s3, paddingVertical: 4 },
  resendTxt: { fontSize: 13, fontWeight: '600', color: T.violet },

  linkRow: { marginTop: S.s3, alignItems: 'center', paddingVertical: S.s1 },
  linkTxt: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  linkAccent: { color: T.violet, fontWeight: '700', fontSize: 14 },
});
