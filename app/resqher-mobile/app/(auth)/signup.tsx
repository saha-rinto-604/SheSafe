import React, { useMemo, useState, useRef } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  View,
  Platform,
  LayoutAnimation,
  UIManager,
  ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import AuthShell from '../../components/auth/AuthShell';
import { Theme } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Role = 'USER' | 'VOLUNTEER' | 'POLICE' | 'ADMIN';

type FormData = {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

const ROLE_OPTIONS: Array<{
  value: Role;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
    {
      value: 'USER',
      label: 'Standard User',
      description: 'Use ResQher for personal safety & SOS.',
      icon: 'user',
    },
    {
      value: 'VOLUNTEER',
      label: 'Volunteer',
      description: 'Respond to community SOS alerts.',
      icon: 'heart',
    },
    {
      value: 'POLICE',
      label: 'Law Enforcement',
      description: 'Access authorized incident workflows.',
      icon: 'shield',
    },
  ];

export default function Signup() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const pw = watch('password');

  const selectedRoleMeta = useMemo(
    () => ROLE_OPTIONS.find((r) => r.value === role) ?? null,
    [role]
  );

  const handleRoleSelect = (r: Role) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRole(r);
  };

  const goNext = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(2);
  };

  const goBack = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(1);
  };

  const phoneRules = {
    required: 'Phone is required',
    validate: (v: string) => {
      const value = v.trim();
      const bd = /^01[3-9]\d{8}$/;
      if (!bd.test(value)) return 'Invalid phone format';
      return true;
    },
  };

  const passwordRules = {
    required: 'Password is required',
    minLength: { value: 8, message: 'Min 8 characters' },
  };

  const onSubmit = async (data: FormData) => {
    if (!role) {
      Alert.alert('Required', 'Please select an account type first.');
      goBack();
      return;
    }

    setSubmitting(true);

    // --- MOCK SIGNUP LOGIC ---
    // Simulating backend delay while it is under development
    setTimeout(() => {
      setSubmitting(false);
      
      // Redirecting directly to the SOS Map screen
      router.replace('/(tabs)/sos_screen'); 
      
      console.log("Mock Signup Successful: User Registered as", role);
    }, 1500); 
    // -------------------------
  };

  return (
    <AuthShell>
      <View style={styles.cardContainer}>
        <View style={styles.cardInner}>
          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 32 }}>
            <View style={styles.headerContainer}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>Step {step} of 2</Text>
              </View>
              <Text style={styles.title}>
                {step === 1 ? 'Join ResQher' : 'Your Details'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1
                  ? 'Select how you want to use the app.'
                  : 'Almost there! Fill in the fields below.'}
              </Text>
            </View>

            {step === 1 && (
              <View style={styles.stepContent}>
                <View style={styles.roleList}>
                  {ROLE_OPTIONS.map((opt) => {
                    const isActive = role === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        activeOpacity={0.7}
                        onPress={() => handleRoleSelect(opt.value)}
                        style={[styles.roleCard, isActive && styles.roleCardActive]}
                      >
                        <View style={[styles.roleIconBox, isActive && styles.roleIconBoxActive]}>
                          <Feather
                            name={opt.icon}
                            size={20}
                            color={isActive ? Theme.colors.primary : Theme.colors.muted}
                          />
                        </View>
                        <View style={styles.roleTextContainer}>
                          <Text style={[styles.roleLabel, isActive && styles.roleLabelActive]}>
                            {opt.label}
                          </Text>
                          <Text style={styles.roleDesc}>{opt.description}</Text>
                        </View>
                        <View style={[styles.radioCircle, isActive && styles.radioCircleActive]}>
                          {isActive && <View style={styles.radioInner} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {!!role && (role === 'VOLUNTEER' || role === 'POLICE') && (
                  <View style={styles.infoBox}>
                    <Feather name="info" size={16} color={Theme.colors.primary} />
                    <Text style={styles.infoText}>
                      This profile requires verification by an admin before full access is granted.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  disabled={!role}
                  style={[styles.primaryBtn, !role && styles.primaryBtnDisabled]}
                  onPress={goNext}
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                  <Feather name="arrow-right" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Already have an account? Log in</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.selectedRoleBadge}>
                  <View style={styles.selectedRoleLeft}>
                    <Feather name={selectedRoleMeta?.icon ?? 'user'} size={16} color={Theme.colors.primary} />
                    <Text style={styles.selectedRoleText}>{selectedRoleMeta?.label}</Text>
                  </View>
                  <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.changeLink}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>First Name</Text>
                    <Controller
                      control={control}
                      name="firstName"
                      rules={{ required: 'Required', minLength: 2 }}
                      render={({ field: { onChange, value } }) => (
                        <View style={[styles.inputWrapper, errors.firstName && styles.inputError]}>
                          <TextInput
                            placeholder="Jane"
                            placeholderTextColor="#9CA3AF"
                            value={value}
                            onChangeText={onChange}
                            style={styles.input}
                          />
                        </View>
                      )}
                    />
                    {!!errors.firstName && <Text style={styles.errorText}>{errors.firstName.message}</Text>}
                  </View>

                  <View style={styles.col}>
                    <Text style={styles.label}>Last Name</Text>
                    <Controller
                      control={control}
                      name="lastName"
                      rules={{ required: 'Required', minLength: 2 }}
                      render={({ field: { onChange, value } }) => (
                        <View style={[styles.inputWrapper, errors.lastName && styles.inputError]}>
                          <TextInput
                            placeholder="Doe"
                            placeholderTextColor="#9CA3AF"
                            value={value}
                            onChangeText={onChange}
                            style={styles.input}
                          />
                        </View>
                      )}
                    />
                    {!!errors.lastName && <Text style={styles.errorText}>{errors.lastName.message}</Text>}
                  </View>
                </View>

                <Text style={styles.label}>Phone Number</Text>
                <Controller
                  control={control}
                  name="phone"
                  rules={phoneRules}
                  render={({ field: { onChange, value } }) => (
                    <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
                      <Feather name="phone" size={18} color="#9CA3AF" style={styles.inputIcon} />
                      <TextInput
                        placeholder="017xxxxxxxx"
                        placeholderTextColor="#9CA3AF"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="phone-pad"
                        style={styles.input}
                      />
                    </View>
                  )}
                />
                {!!errors.phone && <Text style={styles.errorText}>{errors.phone.message}</Text>}

                <Text style={styles.label}>Password</Text>
                <Controller
                  control={control}
                  name="password"
                  rules={passwordRules}
                  render={({ field: { onChange, value } }) => (
                    <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                      <Feather name="lock" size={18} color="#9CA3AF" style={styles.inputIcon} />
                      <TextInput
                        placeholder="Minimum 8 characters"
                        placeholderTextColor="#9CA3AF"
                        value={value}
                        onChangeText={onChange}
                        secureTextEntry
                        style={styles.input}
                      />
                    </View>
                  )}
                />
                {!!errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}

                <Text style={styles.label}>Confirm Password</Text>
                <Controller
                  control={control}
                  name="confirmPassword"
                  rules={{
                    required: 'Required',
                    validate: (v) => v === pw || 'Passwords do not match',
                  }}
                  render={({ field: { onChange, value } }) => (
                    <View style={[styles.inputWrapper, { marginBottom: 8 }, errors.confirmPassword && styles.inputError]}>
                      <Feather name="shield" size={18} color="#9CA3AF" style={styles.inputIcon} />
                      <TextInput
                        placeholder="Re-type password"
                        placeholderTextColor="#9CA3AF"
                        value={value}
                        onChangeText={onChange}
                        secureTextEntry
                        style={styles.input}
                      />
                    </View>
                  )}
                />
                {!!errors.confirmPassword && (
                  <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
                )}

                <TouchableOpacity
                  disabled={submitting}
                  style={[styles.primaryBtn, { marginTop: 24 }]}
                  onPress={handleSubmit(onSubmit)}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={goBack} style={styles.linkBtn}>
                  <Text style={[styles.linkText, { color: Theme.colors.muted }]}>Go Back</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    shadowColor: Theme.colors.primaryDark,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    flexShrink: 1,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
    flexShrink: 1,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  stepPill: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  stepPillText: {
    color: Theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  stepContent: {},
  roleList: {
    gap: 12,
    marginBottom: 20,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  roleCardActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: '#FAFAFF',
  },
  roleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  roleIconBoxActive: {
    backgroundColor: '#F3E8FF',
  },
  roleTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  roleLabelActive: {
    color: Theme.colors.primaryDark,
  },
  roleDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: Theme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 14,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  col: {
    flex: 1,
  },
  selectedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 24,
  },
  selectedRoleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedRoleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  changeLink: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    height: '100%',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    marginTop: -10,
    marginBottom: 16,
    marginLeft: 4,
  },
  primaryBtn: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    gap: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  linkBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: Theme.colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});