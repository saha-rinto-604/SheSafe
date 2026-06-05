import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, LayoutAnimation,
  Animated, Easing, ScrollView,
} from 'react-native';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import AuthShell from '../../components/auth/AuthShell';
import { T, R, S, Ty } from '../../src/constants/theme';
import { G } from '../../src/constants/gradients';
import { useAuth } from '../../src/context/AuthContext';
import type { UserRole } from '../../src/services/api';
import { useToast } from '../../src/components/Toast';
import PasswordStrength, { isStrongPassword } from '../../src/components/PasswordStrength';
import SheSafeLogo from '../../src/components/SheSafeLogo';
import { routeForPoliceStatus } from '../../src/constants/routes';
import SecureTextField from '../../components/auth/SecureTextField';
import { getApiBaseUrlError } from '../../src/services/api';

type Role = UserRole;
type FormData = {
  firstName: string; lastName: string;
  phone: string; password: string; confirmPassword: string;
  policeStationOrUnit: string; badgeNumber: string; otpCode: string;
};

const ROLE_OPTIONS = [
  { value: 'standard_user' as Role, label: 'Standard User', description: 'Personal safety & SOS alerts.', icon: 'user' as const },
  { value: 'volunteer' as Role, label: 'Volunteer', description: 'Respond to community SOS alerts.', icon: 'heart' as const },
  { value: 'law_enforcement' as Role, label: 'Law Enforcement', description: 'Access authorized incident tools.', icon: 'shield' as const },
];
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const ROLE_TO_AUTH: Record<UserRole, 'USER' | 'VOLUNTEER' | 'POLICE'> = {
  standard_user: 'USER',
  volunteer: 'VOLUNTEER',
  law_enforcement: 'POLICE',
};

// ─── Minimalist Role Tile ─────────────────────────────────────────────────────
// 1px border, border-only glow on selection — no background fill change
const RoleTile = React.memo(function RoleTile({
  opt, isActive, disabled, onPress,
}: { opt: typeof ROLE_OPTIONS[0]; isActive: boolean; disabled?: boolean; onPress: () => void }) {
  const scale = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1.02 : 1.0,
      useNativeDriver: USE_NATIVE_DRIVER,
      tension: 260, friction: 16,
    }).start();
  }, [isActive, scale]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.975, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(scale, { toValue: isActive ? 1.0 : 1.02, useNativeDriver: USE_NATIVE_DRIVER, tension: 260, friction: 14 }),
    ]).start();
    onPress();
  }, [disabled, isActive, onPress, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        disabled={disabled}
        style={[st.roleTile, isActive && st.roleTileActive]}
        accessibilityRole="radio"
        accessibilityState={{ checked: isActive }}
        accessibilityLabel={opt.label}
      >
        <Feather name={opt.icon} size={18} color={isActive ? T.violet : T.ink4} />
        <View style={st.roleTileText}>
          <Text style={[st.roleTileLabel, isActive && st.roleTileLabelActive]} numberOfLines={1}>{opt.label}</Text>
          <Text style={st.roleTileDesc} numberOfLines={1} ellipsizeMode="tail">{opt.description}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── 3-Node Progress Tracker ──────────────────────────────────────────────────
const STEP_LABELS = ['Role', 'Identity', 'Security', 'Verify'] as const;

function ProgressNode({ n, label, step }: { n: 1 | 2 | 3 | 4; label: string; step: 1 | 2 | 3 | 4 }) {
  const done = step > n;
  const active = step === n;
  return (
    <View style={st.stepNode}>
      <View style={[st.stepCircle, (active || done) && st.stepCircleActive]}>
        {done
          ? <Feather name="check" size={12} color={T.onPrimary} />
          : <Text style={[st.stepNum, (active || done) && st.stepNumActive]}>{n}</Text>
        }
      </View>
      <Text style={[st.stepLabel, (active || done) && st.stepLabelActive]}>{label}</Text>
    </View>
  );
}

function StepProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  const line1 = useMemo(() => new Animated.Value(0), []);
  const line2 = useMemo(() => new Animated.Value(0), []);
  const line3 = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(line1, { toValue: step >= 2 ? 1 : 0, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(line2, { toValue: step >= 3 ? 1 : 0, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(line3, { toValue: step >= 4 ? 1 : 0, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start();
  }, [line1, line2, line3, step]);

  return (
    <View style={st.progressWrap}>
      <ProgressNode n={1} label={STEP_LABELS[0]} step={step} />
      <View style={st.lineTrack}>
        <Animated.View style={[st.lineFill, {
          width: line1.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <ProgressNode n={2} label={STEP_LABELS[1]} step={step} />
      <View style={st.lineTrack}>
        <Animated.View style={[st.lineFill, {
          width: line2.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <ProgressNode n={3} label={STEP_LABELS[2]} step={step} />
      <View style={st.lineTrack}>
        <Animated.View style={[st.lineFill, {
          width: line3.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <ProgressNode n={4} label={STEP_LABELS[3]} step={step} />
    </View>
  );
}

// ─── Stable Form Field (defined outside Signup to prevent remount on re-render) ─
function FormField({
  name, placeholder, icon, secure, keyboard, rules,
  control, errors, focused, setFocused,
}: {
  name: keyof FormData;
  placeholder: string;
  icon: keyof typeof Feather.glyphMap;
  secure?: boolean;
  keyboard?: any;
  rules?: object;
  control: any;
  errors: any;
  focused: string | null;
  setFocused: (v: string | null) => void;
}) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, value } }) => (
        <>
          {secure ? (
            <SecureTextField
              placeholder={placeholder}
              value={value}
              onChangeText={onChange}
              focused={focused === name}
              hasError={!!errors[name]}
              containerStyle={st.inputWrap}
              focusedStyle={st.inputFocused}
              errorStyle={st.inputError}
              inputStyle={st.input}
              iconStyle={st.inputIcon}
              iconName={icon}
              onFocus={() => setFocused(name)}
              onBlur={() => setFocused(null)}
              accessibilityLabel={placeholder}
            />
          ) : (
            <View style={[st.inputWrap, focused === name && st.inputFocused, errors[name] && st.inputError]}>
              <Feather name={icon} size={18} color={focused === name ? T.violet : T.inputIconDefault} style={st.inputIcon} />
              <TextInput
                placeholder={placeholder}
                placeholderTextColor={T.ink5}
                value={value}
                onChangeText={onChange}
                keyboardType={keyboard}
                style={st.input}
                onFocus={() => setFocused(name)}
                onBlur={() => setFocused(null)}
                accessibilityLabel={placeholder}
              />
            </View>
          )}
          {!!errors[name] && <Text style={st.errTxt}>{(errors[name] as any).message}</Text>}
        </>
      )}
    />
  );
}

// ─── Signup ────────────────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter();
  const { requestSignupOtp, verifySignupOtp, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const { control, handleSubmit, formState: { errors }, trigger } = useForm<FormData>({
    defaultValues: {
      firstName: '', lastName: '', phone: '', password: '', confirmPassword: '',
      policeStationOrUnit: '', badgeNumber: '', otpCode: '',
    },
  });
  const pw = useWatch({ control, name: 'password' }) ?? '';
  const selectedMeta = useMemo(() => ROLE_OPTIONS.find(o => o.value === role) ?? null, [role]);
  const busy = submitting || authLoading;

  const goStep = (s: 1 | 2 | 3 | 4) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(s);
  };

  const goNext = async () => {
    if (busy) return;
    if (step === 1) {
      if (!role) { showToast({ type: 'warning', title: 'Role Required', message: 'Please select an account type to continue.' }); return; }
      goStep(2);
    } else if (step === 2) {
      const fields: (keyof FormData)[] = ['firstName', 'lastName', 'phone'];
      if (role === 'law_enforcement') fields.push('policeStationOrUnit', 'badgeNumber');
      const valid = await trigger(fields);
      if (valid) goStep(3);
    }
  };

  const goBack = () => {
    if (busy) return;
    if (step === 4) goStep(3);
    else if (step === 2) goStep(1);
    else if (step === 3) goStep(2);
    else router.back();
  };

  const phoneRules = {
    required: 'Phone is required',
    validate: (v: string) => /^(\+8801[3-9]\d{8}|8801[3-9]\d{8}|01[3-9]\d{8})$/.test(v.trim()) || 'Invalid format',
  };

  const onSubmit = async (data: FormData) => {
    if (submittingRef.current || busy) return;
    const apiError = getApiBaseUrlError();
    if (apiError) {
      showToast({ type: 'error', title: 'Backend URL Required', message: apiError });
      return;
    }
    if (!role) {
      showToast({ type: 'warning', title: 'Role Required', message: 'Please select an account type to continue.' });
      goStep(1);
      return;
    }
    // Enforce strong password format
    if (!isStrongPassword(data.password)) {
      showToast({
        type: 'error',
        title: 'Weak Password',
        message: 'Password does not meet security requirements. Please include a mix of uppercase, numbers, and special characters.',
        duration: 5000,
      });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await requestSignupOtp(
        data.phone.trim(),
        data.password,
        data.firstName.trim(),
        data.lastName.trim(),
        ROLE_TO_AUTH[role] ?? 'USER',
        role === 'law_enforcement' ? {
          policeStationOrUnit: data.policeStationOrUnit.trim(),
          badgeNumber: data.badgeNumber.trim(),
        } : undefined
      );

      showToast({ type: 'success', title: 'OTP Sent', message: 'Check your phone for the verification code.' });
      goStep(4);
    } catch (e: any) {
      const msg = e?.message ?? '';
      const code = e?.code;
      if (msg.toLowerCase().includes('already registered')) {
        showToast({
          type: 'warning',
          title: 'Phone Already Registered',
          message: 'An account with this phone number already exists. Please sign in instead.',
          action: { label: 'Sign In', onPress: () => router.push('/(auth)/login') },
        });
      } else {
        const serverIssue = code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'API_CONFIG_ERROR';
        showToast({
          type: 'error',
          title: code === 'SERVER_ERROR' ? 'Server Error' : serverIssue ? 'Server Unreachable' : 'Registration Failed',
          message: msg || 'Unable to send OTP. Please try again.',
        });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const onVerifyOtp = async (data: FormData) => {
    if (submittingRef.current || busy) return;
    const apiError = getApiBaseUrlError();
    if (apiError) {
      showToast({ type: 'error', title: 'Backend URL Required', message: apiError });
      return;
    }
    const trimmedOtp = data.otpCode.trim();
    if (!/^\d{4,8}$/.test(trimmedOtp)) {
      showToast({ type: 'warning', title: 'Invalid OTP', message: 'Please enter the verification code sent to your phone.' });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await verifySignupOtp(data.phone.trim(), trimmedOtp);
      showToast({ type: 'success', title: 'Welcome to SheSafe!', message: 'Your account has been created successfully.' });
      const rolePaths: Record<string, string> = {
        USER: '/(tabs)/users/standard-user/sos_screen',
        VOLUNTEER: '/(tabs)/users/volunteer/volunteer-verification',
        POLICE: routeForPoliceStatus(result.verificationStatus, result.user?.policeProfile),
      };
      router.replace(rolePaths[result.role] as any);
    } catch (e: any) {
      const msg = e?.message ?? '';
      const code = e?.code;
      if (msg.toLowerCase().includes('already registered')) {
        showToast({
          type: 'warning',
          title: 'Phone Already Registered',
          message: 'An account with this phone number already exists. Please sign in instead.',
          action: { label: 'Sign In', onPress: () => router.push('/(auth)/login') },
        });
      } else {
        const serverIssue = code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'API_CONFIG_ERROR';
        showToast({
          type: 'error',
          title: code === 'SERVER_ERROR' ? 'Server Error' : serverIssue ? 'Server Unreachable' : 'Registration Failed',
          message: msg || 'Unable to verify OTP. Please try again.',
        });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };


  const STEP_TITLES = {
    1: { title: 'Join SheSafe', subtitle: 'Select how you want to use the app.' },
    2: { title: 'Your Identity', subtitle: 'Tell us who you are.' },
    3: { title: 'Secure Account', subtitle: 'Create a strong password.' },
    4: { title: 'Verify Phone', subtitle: 'Enter the code sent to your phone.' },
  };

  return (
    <AuthShell onBack={goBack}>
      <ScrollView
        style={{ borderRadius: R.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={st.card}>
          <SheSafeLogo size={32} center style={st.logo} />
          {/* ── Progress + Header ── */}
          <StepProgress step={step} />
          <View style={st.header}>
            <Text style={st.title}>{STEP_TITLES[step].title}</Text>
            <Text style={st.subtitle}>{STEP_TITLES[step].subtitle}</Text>
          </View>

          {/* ─── STEP 1: Role Selection ─────────────────── */}
          {step === 1 && (
            <>
              <View style={st.roleList}>
                {ROLE_OPTIONS.map(opt => (
                  <RoleTile
                    key={opt.value}
                    opt={opt}
                    isActive={role === opt.value}
                    disabled={busy}
                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setRole(opt.value); }}
                  />
                ))}
              </View>

              {!!role && (role === 'volunteer' || role === 'law_enforcement') && (
                <View style={st.infoBox}>
                  <Feather name="info" size={14} color={T.violet} />
                  <Text style={st.infoTxt}>Requires admin verification before full access.</Text>
                </View>
              )}

              <TouchableOpacity
                disabled={!role || busy}
                style={role && !busy ? st.btn : st.btnDisabled}
                onPress={goNext}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                {role ? (
                  <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={st.btnInner}>
                    <Text style={st.btnTxt}>Continue</Text>
                    <Feather name="arrow-right" size={18} color={T.onPrimary} />
                  </LinearGradient>
                ) : (
                  <View style={st.btnInner}>
                    <Text style={[st.btnTxt, { color: T.ink5 }]}>Select a role to continue</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity disabled={busy} onPress={() => router.push('/(auth)/login')} style={st.linkRow}>
                <Text style={st.linkTxt}>Already have an account? <Text style={st.linkAccent}>Log in</Text></Text>
              </TouchableOpacity>
            </>
          )}

          {/* ─── STEP 2: Identity ──────────────────────── */}
          {step === 2 && (
            <>
              {/* Selected role badge */}
              <View style={st.roleBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.s2 }}>
                  <Feather name={selectedMeta?.icon ?? 'user'} size={14} color={T.violet} />
                  <Text style={st.roleBadgeTxt}>{selectedMeta?.label}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { if (!busy) goStep(1); }}
                  disabled={busy}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={st.linkAccent}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* First + Last name in one row */}
              <View style={st.row}>
                <View style={{ flex: 1 }}>
                  <Controller
                    control={control}
                    name="firstName"
                    rules={{ required: 'Required', minLength: { value: 2, message: 'Min 2 chars' } }}
                    render={({ field: { onChange, value } }) => (
                      <View style={[st.inputWrap, focused === 'firstName' && st.inputFocused, errors.firstName && st.inputError]}>
                        <TextInput
                          placeholder="First name"
                          placeholderTextColor={T.ink5}
                          value={value} onChangeText={onChange} style={st.input}
                          onFocus={() => setFocused('firstName')} onBlur={() => setFocused(null)}
                        />
                      </View>
                    )}
                  />
                  {!!errors.firstName && <Text style={st.errTxt}>{errors.firstName.message}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Controller
                    control={control}
                    name="lastName"
                    rules={{ required: 'Required', minLength: { value: 2, message: 'Min 2 chars' } }}
                    render={({ field: { onChange, value } }) => (
                      <View style={[st.inputWrap, focused === 'lastName' && st.inputFocused, errors.lastName && st.inputError]}>
                        <TextInput
                          placeholder="Last name"
                          placeholderTextColor={T.ink5}
                          value={value} onChangeText={onChange} style={st.input}
                          onFocus={() => setFocused('lastName')} onBlur={() => setFocused(null)}
                        />
                      </View>
                    )}
                  />
                  {!!errors.lastName && <Text style={st.errTxt}>{errors.lastName.message}</Text>}
                </View>
              </View>

              <FormField name="phone" placeholder="Phone number" icon="phone" keyboard="phone-pad" rules={phoneRules} control={control} errors={errors} focused={focused} setFocused={setFocused} />

              {role === 'law_enforcement' && (
                <View style={st.policeFields}>
                  <FormField
                    name="policeStationOrUnit"
                    placeholder="Police station / unit"
                    icon="home"
                    rules={{ required: 'Police station or unit is required' }}
                    control={control}
                    errors={errors}
                    focused={focused}
                    setFocused={setFocused}
                  />
                  <FormField
                    name="badgeNumber"
                    placeholder="Badge or job ID number"
                    icon="shield"
                    rules={{ required: 'Badge or job ID number is required' }}
                    control={control}
                    errors={errors}
                    focused={focused}
                    setFocused={setFocused}
                  />
                  <View style={st.uploadBox}>
                    <Feather name="shield" size={18} color={T.violet} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.uploadTitle}>Police Job Certificate / Job ID Card</Text>
                      <Text style={st.uploadSub}>You will upload this required document after account creation.</Text>
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity
                disabled={busy}
                style={busy ? st.btnDisabled : st.btn}
                onPress={goNext}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Continue to security"
              >
                <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={st.btnInner}>
                  <Text style={st.btnTxt}>Continue</Text>
                  <Feather name="arrow-right" size={18} color={T.onPrimary} />
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ─── STEP 3: Security ──────────────────────── */}
          {step === 3 && (
            <>
              <FormField name="password" placeholder="Password" icon="lock" secure rules={{ required: 'Required' }} control={control} errors={errors} focused={focused} setFocused={setFocused} />
              <PasswordStrength password={pw} />
              <FormField name="confirmPassword" placeholder="Confirm password" icon="shield" secure rules={{ required: 'Required', validate: (v: string) => v === pw || 'Passwords do not match' }} control={control} errors={errors} focused={focused} setFocused={setFocused} />

              <TouchableOpacity
                disabled={busy}
                style={[busy ? st.btnDisabled : st.btn, { marginTop: S.s4 }]}
                onPress={() => handleSubmit(onSubmit)()}
                activeOpacity={0.82}
              >
                {busy
                  ? <View style={st.btnInner}><ActivityIndicator color={T.onPrimary} /></View>
                  : (
                    <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={st.btnInner}>
                      <Text style={st.btnTxt}>Send OTP</Text>
                    </LinearGradient>
                  )
                }
              </TouchableOpacity>
            </>
          )}

          {step === 4 && (
            <>
              <FormField
                name="otpCode"
                placeholder="Verification code"
                icon="key"
                keyboard="number-pad"
                rules={{
                  required: 'Verification code is required',
                  validate: (v: string) => /^\d{4,8}$/.test(v.trim()) || 'Invalid OTP',
                }}
                control={control}
                errors={errors}
                focused={focused}
                setFocused={setFocused}
              />

              <TouchableOpacity
                disabled={busy}
                style={[busy ? st.btnDisabled : st.btn, { marginTop: S.s4 }]}
                onPress={() => handleSubmit(onVerifyOtp)()}
                activeOpacity={0.82}
              >
                {busy
                  ? <View style={st.btnInner}><ActivityIndicator color={T.onPrimary} /></View>
                  : (
                    <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={st.btnInner}>
                      <Text style={st.btnTxt}>Verify & Create Account</Text>
                    </LinearGradient>
                  )
                }
              </TouchableOpacity>

              <TouchableOpacity
                disabled={busy}
                onPress={() => handleSubmit(onSubmit)()}
                style={st.linkRow}
                activeOpacity={0.7}
              >
                <Text style={st.linkTxt}>Didn&apos;t receive OTP? <Text style={st.linkAccent}>Resend</Text></Text>
              </TouchableOpacity>
            </>
          )}
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
    paddingBottom: S.s3,
    borderWidth: 1,
    borderColor: T.hairlineMicro,
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.25, shadowRadius: 28, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
    }),
  },

  // ── 3-node progress tracker
  logo: { marginBottom: S.s4 },

  progressWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: S.s4, paddingHorizontal: S.s1,
  },
  stepNode: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: T.lineBold,
    backgroundColor: T.surfaceCard,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: T.violet, borderColor: T.violet,
  },
  stepNum: { fontSize: 11, fontWeight: '700', color: T.ink4 },
  stepNumActive: { color: T.onPrimary },
  stepLabel: { fontSize: 9, fontWeight: '600', color: T.ink4, letterSpacing: 0.3 },
  stepLabelActive: { color: T.violet },
  lineTrack: {
    flex: 1, height: 2,
    backgroundColor: T.lineBold,
    borderRadius: R.full,
    overflow: 'hidden',
    marginHorizontal: S.s1,
    marginBottom: 14,
  },
  lineFill: { height: '100%', backgroundColor: T.violet, borderRadius: R.full },

  header: { alignItems: 'center', marginBottom: S.s3 },
  title: { ...Ty.h3, marginBottom: 2 },
  subtitle: { ...Ty.bodySm, color: T.ink4, textAlign: 'center' },

  // ── Minimalist role tiles — 1px border, glow-only on select
  roleList: { gap: 10, marginBottom: S.s3 },
  roleTile: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    paddingHorizontal: S.s4,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: T.lineBold,
    backgroundColor: T.surfaceBulkyGlass,
  },
  roleTileActive: {
    borderColor: T.violet,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
      android: { elevation: 6 },
    }),
  },
  roleTileText: { flex: 1, marginLeft: S.s3, minWidth: 0 },
  roleTileLabel: { fontSize: 14, fontWeight: '700', color: T.ink, marginBottom: 1 },
  roleTileLabelActive: { color: T.violet },
  roleTileDesc: { fontSize: 12, color: T.ink4, lineHeight: 16 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.s2,
    backgroundColor: T.surfaceBulkyGlass, paddingHorizontal: S.s3, paddingVertical: S.s2,
    borderRadius: R.sm, marginBottom: S.s3,
    borderWidth: 1, borderColor: T.lineMid,
  },
  infoTxt: { fontSize: 12, color: T.ink3, flex: 1, lineHeight: 17 },

  roleBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.surfaceBulkyGlass, paddingHorizontal: S.s3, paddingVertical: S.s2,
    borderRadius: R.sm, borderWidth: 1, borderColor: T.lineMid, marginBottom: S.s3,
  },
  roleBadgeTxt: { fontSize: 13, fontWeight: '700', color: T.ink2 },
  policeFields: { gap: S.s2, marginTop: S.s1 },
  uploadBox: {
    minHeight: 58,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: T.lineBold,
    backgroundColor: T.surfaceBulkyGlass,
    paddingHorizontal: S.s4,
    paddingVertical: S.s3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s3,
    marginBottom: S.s2,
  },
  uploadTitle: { fontSize: 13, fontWeight: '800', color: T.ink },
  uploadSub: { fontSize: 11, fontWeight: '600', color: T.ink4, marginTop: 2 },

  row: { flexDirection: 'row', gap: S.s2, marginBottom: S.s1 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', height: 48,
    borderRadius: R.sm, borderWidth: 1, borderColor: T.lineBold,
    backgroundColor: T.surfaceCard, paddingHorizontal: S.s3, marginBottom: S.s2,
  },
  inputFocused: { borderColor: T.violet, borderWidth: 1, backgroundColor: 'rgba(138,56,246,0.06)' },
  inputError: { borderColor: T.danger, backgroundColor: T.dangerLight },
  inputIcon: { marginRight: S.s2 },
  input: { flex: 1, height: '100%', color: T.ink, fontSize: 14 },
  errTxt: { fontSize: 11, color: T.dangerText, fontWeight: '500', marginTop: -6, marginBottom: S.s1 },

  btn: {
    borderRadius: R.md, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.30, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  btnInner: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.s2 },
  btnDisabled: { borderRadius: R.md, overflow: 'hidden', backgroundColor: T.disabledBg },
  btnTxt: { ...Ty.btn },

  linkRow: { marginTop: S.s3, alignItems: 'center', paddingVertical: S.s1 },
  linkTxt: { fontSize: 13, color: T.ink4, fontWeight: '500' },
  linkAccent: { color: T.violet, fontWeight: '700' },
});
