import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, LayoutAnimation,
  UIManager, Animated, Easing, ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import AuthShell from '../../components/auth/AuthShell';
import { T, R, S, Ty } from '../../src/constants/theme';
import { G } from '../../src/constants/gradients';
import { useAuth } from '../../src/context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Role = 'USER' | 'VOLUNTEER' | 'POLICE' | 'ADMIN';
type FormData = {
  firstName: string; lastName: string;
  phone: string; password: string; confirmPassword: string;
};

const ROLE_OPTIONS = [
  { value: 'USER' as Role, label: 'Standard User', description: 'Personal safety & SOS alerts.', icon: 'user' as const },
  { value: 'VOLUNTEER' as Role, label: 'Volunteer', description: 'Respond to community SOS alerts.', icon: 'heart' as const },
  { value: 'POLICE' as Role, label: 'Law Enforcement', description: 'Access authorized incident tools.', icon: 'shield' as const },
];

// ─── Minimalist Role Tile ─────────────────────────────────────────────────────
// 1px border, border-only glow on selection — no background fill change
const RoleTile = React.memo(function RoleTile({
  opt, isActive, onPress,
}: { opt: typeof ROLE_OPTIONS[0]; isActive: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1.02 : 1.0,
      useNativeDriver: true,
      tension: 260, friction: 16,
    }).start();
  }, [isActive]);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.975, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: isActive ? 1.0 : 1.02, useNativeDriver: true, tension: 260, friction: 14 }),
    ]).start();
    onPress();
  }, [isActive, onPress]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
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
const STEP_LABELS = ['Role', 'Identity', 'Security'] as const;

function StepProgress({ step }: { step: 1 | 2 | 3 }) {
  const line1 = useRef(new Animated.Value(step >= 2 ? 1 : 0)).current;
  const line2 = useRef(new Animated.Value(step >= 3 ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(line1, { toValue: step >= 2 ? 1 : 0, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(line2, { toValue: step >= 3 ? 1 : 0, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start();
  }, [step]);

  const Node = ({ n, label }: { n: 1 | 2 | 3; label: string }) => {
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
  };

  return (
    <View style={st.progressWrap}>
      <Node n={1} label={STEP_LABELS[0]} />
      <View style={st.lineTrack}>
        <Animated.View style={[st.lineFill, {
          width: line1.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <Node n={2} label={STEP_LABELS[1]} />
      <View style={st.lineTrack}>
        <Animated.View style={[st.lineFill, {
          width: line2.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <Node n={3} label={STEP_LABELS[2]} />
    </View>
  );
}

// ─── Signup ────────────────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const { control, handleSubmit, watch, formState: { errors }, trigger } = useForm<FormData>({
    defaultValues: { firstName: '', lastName: '', phone: '', password: '', confirmPassword: '' },
  });
  const pw = watch('password');
  const selectedMeta = useMemo(() => ROLE_OPTIONS.find(o => o.value === role) ?? null, [role]);

  const goStep = (s: 1 | 2 | 3) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(s);
  };

  const goNext = async () => {
    if (step === 1) {
      if (!role) { Alert.alert('Required', 'Please select an account type.'); return; }
      goStep(2);
    } else if (step === 2) {
      const valid = await trigger(['firstName', 'lastName', 'phone']);
      if (valid) goStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) goStep(1);
    else if (step === 3) goStep(2);
    else router.back();
  };

  const phoneRules = {
    required: 'Phone is required',
    validate: (v: string) => /^01[3-9]\d{8}$/.test(v.trim()) || 'Invalid format',
  };

  const onSubmit = async (data: FormData) => {
    if (!role) { Alert.alert('Required', 'Please select an account type.'); goStep(1); return; }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      const rolePaths: Record<Role, string> = {
        'USER': '/(tabs)/users/standard-user/sos_screen',
        'VOLUNTEER': '/(tabs)/users/volunteer/dashboard',
        'POLICE': '/(tabs)/users/police/dashboard',
        'ADMIN': '/(tabs)/users/admin/dashboard',
      };
      router.replace(rolePaths[role] as any);
    }, 1500);
  };

  // Reusable inline field
  const Field = ({
    name, placeholder, icon, secure, keyboard, rules,
  }: {
    name: keyof FormData;
    placeholder: string;
    icon: keyof typeof Feather.glyphMap;
    secure?: boolean;
    keyboard?: any;
    rules?: object;
  }) => (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, value } }) => (
        <>
          <View style={[st.inputWrap, focused === name && st.inputFocused, errors[name] && st.inputError]}>
            <Feather name={icon} size={18} color={focused === name ? T.violet : T.inputIconDefault} style={st.inputIcon} />
            <TextInput
              placeholder={placeholder}
              placeholderTextColor={T.ink5}
              value={value}
              onChangeText={onChange}
              secureTextEntry={secure}
              keyboardType={keyboard}
              style={st.input}
              onFocus={() => setFocused(name)}
              onBlur={() => setFocused(null)}
              accessibilityLabel={placeholder}
            />
          </View>
          {!!errors[name] && <Text style={st.errTxt}>{(errors[name] as any).message}</Text>}
        </>
      )}
    />
  );

  const STEP_TITLES = {
    1: { title: 'Join ResQher', subtitle: 'Select how you want to use the app.' },
    2: { title: 'Your Identity', subtitle: 'Tell us who you are.' },
    3: { title: 'Secure Account', subtitle: 'Create a strong password.' },
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
                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setRole(opt.value); }}
                  />
                ))}
              </View>

              {!!role && (role === 'VOLUNTEER' || role === 'POLICE') && (
                <View style={st.infoBox}>
                  <Feather name="info" size={14} color={T.violet} />
                  <Text style={st.infoTxt}>Requires admin verification before full access.</Text>
                </View>
              )}

              <TouchableOpacity
                disabled={!role}
                style={role ? st.btn : st.btnDisabled}
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

              <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={st.linkRow}>
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
                <TouchableOpacity onPress={() => goStep(1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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

              <Field name="phone" placeholder="Phone number" icon="phone" keyboard="phone-pad" rules={phoneRules} />

              <TouchableOpacity
                style={st.btn}
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
              <Field name="password" placeholder="Password" icon="lock" secure rules={{ required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } }} />
              <Field name="confirmPassword" placeholder="Confirm password" icon="shield" secure rules={{ required: 'Required', validate: (v: string) => v === pw || 'Passwords do not match' }} />

              <TouchableOpacity
                disabled={submitting}
                style={[st.btn, { marginTop: S.s4 }]}
                onPress={handleSubmit(onSubmit)}
                activeOpacity={0.82}
              >
                {submitting
                  ? <View style={st.btnInner}><ActivityIndicator color={T.onPrimary} /></View>
                  : (
                    <LinearGradient colors={G.navActive.colors} start={G.navActive.start} end={G.navActive.end} style={st.btnInner}>
                      <Text style={st.btnTxt}>Create Account</Text>
                    </LinearGradient>
                  )
                }
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
