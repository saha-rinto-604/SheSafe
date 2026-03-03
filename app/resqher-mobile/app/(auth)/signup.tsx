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

// ─── Animated Role Card ───────────────────────────────────────────────────────
const AnimatedRoleCard = React.memo(function AnimatedRoleCard({
  opt, isActive, onPress,
}: { opt: typeof ROLE_OPTIONS[0]; isActive: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1.025 : 1.0,
      useNativeDriver: true,
      tension: 260, friction: 16,
    }).start();
  }, [isActive]);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.975, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: isActive ? 1.0 : 1.025, useNativeDriver: true, tension: 260, friction: 14 }),
    ]).start();
    onPress();
  }, [isActive, onPress]);

  return (
    <Animated.View style={[st.roleCardWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        style={[st.roleCard, isActive && st.roleCardActive]}
        accessibilityRole="radio"
        accessibilityState={{ checked: isActive }}
        accessibilityLabel={opt.label}
      >
        <View style={[st.roleIconBox, isActive && st.roleIconBoxActive]}>
          <Feather name={opt.icon} size={19} color={isActive ? T.violet : T.gray400} />
        </View>
        <View style={st.roleText}>
          <Text style={[st.roleLabel, isActive && st.roleLabelActive]} numberOfLines={1}>{opt.label}</Text>
          <Text style={st.roleDesc} numberOfLines={1} ellipsizeMode="tail">{opt.description}</Text>
        </View>
        <View style={[st.roleCheck, isActive && st.roleCheckActive]}>
          {isActive
            ? <Feather name="check" size={11} color={T.onPrimary} />
            : <View style={st.roleCheckDot} />
          }
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Modern Step Tracker ─────────────────────────────────────────────────────
function StepProgress({ step }: { step: 1 | 2 }) {
  const lineWidth = useRef(new Animated.Value(step === 2 ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(lineWidth, {
      toValue: step === 2 ? 1 : 0,
      duration: 380,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [step]);

  const Node = ({ n, label }: { n: 1 | 2; label: string }) => {
    const done = step > n;
    const active = step === n;
    return (
      <View style={st.stepNode}>
        <View style={[
          st.stepCircle,
          (active || done) && st.stepCircleActive,
        ]}>
          {done
            ? <Feather name="check" size={13} color={T.onPrimary} />
            : <Text style={[st.stepNum, (active || done) && st.stepNumActive]}>{n}</Text>
          }
        </View>
        <Text style={[st.stepLabel, (active || done) && st.stepLabelActive]}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={st.progressWrap}>
      <Node n={1} label="Role" />
      {/* Connecting line */}
      <View style={st.lineTrack}>
        <Animated.View style={[st.lineFill, {
          width: lineWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <Node n={2} label="Details" />
    </View>
  );
}


// ─── Signup ────────────────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: { firstName: '', lastName: '', phone: '', password: '', confirmPassword: '' },
  });
  const pw = watch('password');
  const selectedMeta = useMemo(() => ROLE_OPTIONS.find(o => o.value === role) ?? null, [role]);

  const goNext = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setStep(2); };
  const goBack = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setStep(1); };

  const phoneRules = {
    required: 'Phone is required',
    validate: (v: string) => /^01[3-9]\d{8}$/.test(v.trim()) || 'Invalid format',
  };

  const onSubmit = async (data: FormData) => {
    if (!role) { Alert.alert('Required', 'Please select an account type.'); goBack(); return; }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      router.replace('/users/sos_screen');
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
            <Feather name={icon} size={18} color={focused === name ? T.violet : T.ink4} style={st.inputIcon} />
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

  return (
    <AuthShell onBack={step === 2 ? goBack : () => router.back()}>
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
            <Text style={st.title}>{step === 1 ? 'Join ResQher' : 'Your Details'}</Text>
            <Text style={st.subtitle}>{step === 1 ? 'Select how you want to use the app.' : 'Almost there — fill in your info.'}</Text>
          </View>

          {/* ─── STEP 1: Role ─────────────────────────────── */}
          {step === 1 && (
            <>
              <View style={st.roleList}>
                {ROLE_OPTIONS.map(opt => (
                  <AnimatedRoleCard
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

          {/* ─── STEP 2: Details ──────────────────────────── */}
          {step === 2 && (
            <>
              {/* Selected role badge */}
              <View style={st.roleBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.s2 }}>
                  <Feather name={selectedMeta?.icon ?? 'user'} size={14} color={T.violet} />
                  <Text style={st.roleBadgeTxt}>{selectedMeta?.label}</Text>
                </View>
                <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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

              <TouchableOpacity onPress={goBack} style={st.linkRow}>
                <Text style={st.linkTxt}>← Go back</Text>
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
    backgroundColor: T.surface,
    borderRadius: R.xl,
    padding: S.s5,
    paddingBottom: S.s3,
    ...Platform.select({
      ios: { shadowColor: T.ink, shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 5 },
    }),
  },

  // ── Modern step tracker
  progressWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: S.s4, paddingHorizontal: S.s3,
  },
  stepNode: { alignItems: 'center', gap: 5 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: T.lineMid,
    backgroundColor: T.bgMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: T.violet, borderColor: T.violet,
  },
  stepNum: { fontSize: 13, fontWeight: '700', color: T.ink4 },
  stepNumActive: { color: T.onPrimary },
  stepLabel: { fontSize: 10, fontWeight: '600', color: T.ink4, letterSpacing: 0.3 },
  stepLabelActive: { color: T.violet },
  // Connecting animated line
  lineTrack: {
    flex: 1, height: 2.5,
    backgroundColor: T.lineMid,
    borderRadius: R.full,
    overflow: 'hidden',
    marginHorizontal: S.s2,
    marginBottom: 15,
  },
  lineFill: { height: '100%', backgroundColor: T.violet, borderRadius: R.full },

  // ── Header
  header: { alignItems: 'center', marginBottom: S.s3 },
  title: { ...Ty.h3, marginBottom: 2 },
  subtitle: { ...Ty.bodySm, color: T.ink4, textAlign: 'center' },

  // ── Role cards
  roleList: { gap: 10, marginBottom: S.s3 },

  // Wrapper handles the active shadow elevation
  roleCardWrap: {
    borderRadius: R.md,
    ...Platform.select({
      ios: { shadowColor: T.violetDark, shadowOpacity: 0, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: {},
    }),
  },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,                    // Fixed height — no text-wrap size jumps
    paddingHorizontal: S.s4,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: T.lineMid,        // Neutral border from theme
    backgroundColor: T.surface,
  },

  roleCardActive: {
    borderColor: T.violet,
    borderWidth: 2,
    backgroundColor: T.violetLighter,   // Light purple from theme
    ...Platform.select({
      ios: { shadowOpacity: 0.18 },
      android: { elevation: 4 },
    }),
  },

  roleIconBox: {
    width: 40, height: 40,
    borderRadius: 10,
    backgroundColor: T.surfaceMid,   // Neutral from theme
    alignItems: 'center', justifyContent: 'center',
    marginRight: S.s3,
    flexShrink: 0,
  },
  roleIconBoxActive: {
    backgroundColor: T.violetLighter,   // Light violet from theme
  },

  roleText: { flex: 1, minWidth: 0 }, // minWidth:0 enables text truncation in flex
  roleLabel: { fontSize: 14, fontWeight: '700', color: T.ink, marginBottom: 2 },
  roleLabelActive: { color: T.violet },
  roleDesc: { fontSize: 12, color: T.gray400, lineHeight: 16 },

  // Radio check indicator
  roleCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: T.lineBold,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: S.s2,
    flexShrink: 0,
    backgroundColor: T.surface,
  },
  roleCheckActive: {
    backgroundColor: T.violet, borderColor: T.violet,
  },
  roleCheckDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: T.lineBold,   // Subtle dot from theme
  },

  // ── Info box
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.s2,
    backgroundColor: T.bgMuted, paddingHorizontal: S.s3, paddingVertical: S.s2,
    borderRadius: R.sm, marginBottom: S.s3,
    borderWidth: 1, borderColor: T.lineMid,
  },
  infoTxt: { fontSize: 12, color: T.ink2, flex: 1, lineHeight: 17 },

  // ── Role badge (step 2)
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.bgMuted, paddingHorizontal: S.s3, paddingVertical: S.s2,
    borderRadius: R.sm, borderWidth: 1, borderColor: T.lineMid, marginBottom: S.s3,
  },
  roleBadgeTxt: { fontSize: 13, fontWeight: '700', color: T.ink2 },

  // ── Name row
  row: { flexDirection: 'row', gap: S.s2, marginBottom: S.s1 },

  // ── Inputs — no labels, placeholder-only, tighter height
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', height: 48,
    borderRadius: R.sm, borderWidth: 1.5, borderColor: T.lineMid,
    backgroundColor: T.surface, paddingHorizontal: S.s3, marginBottom: S.s2,
  },
  inputFocused: { borderColor: T.violet, borderWidth: 2, backgroundColor: T.surface },
  inputError: { borderColor: T.danger, backgroundColor: T.dangerLight },
  inputIcon: { marginRight: S.s2 },
  input: { flex: 1, height: '100%', color: T.ink, fontSize: 14 },
  errTxt: { fontSize: 11, color: T.danger, fontWeight: '500', marginTop: -6, marginBottom: S.s1 },

  // ── Buttons
  btn: {
    borderRadius: R.md, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: T.violetDark, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  btnInner: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.s2 },
  btnDisabled: { borderRadius: R.md, overflow: 'hidden', backgroundColor: T.disabledBg },
  btnTxt: { ...Ty.btn },

  // ── Links
  linkRow: { marginTop: S.s3, alignItems: 'center', paddingVertical: S.s1 },
  linkTxt: { fontSize: 13, color: T.ink4, fontWeight: '500' },
  linkAccent: { color: T.violet, fontWeight: '700' },
});
