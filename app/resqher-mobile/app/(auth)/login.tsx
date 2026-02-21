import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, View, Platform, LayoutAnimation, UIManager, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import AuthShell from '../../components/auth/AuthShell';
import { Theme } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

type FormData = {
  phone: string;
  password: string;
};

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { phone: '', password: '' },
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await signIn(data.phone.trim(), data.password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Please check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <View style={styles.cardContainer}>
        <View style={styles.cardInner}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 32 }}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Login to continue</Text>

            <Text style={styles.label}>Phone</Text>
            <Controller
              control={control}
              name="phone"
              rules={{ required: 'Phone is required' }}
              render={({ field: { onChange, value } }) => (
                <View style={[styles.inputContainer, errors.phone && styles.inputError]}>
                  <Feather name="phone" size={20} color={Theme.colors.muted} style={styles.inputIcon} />
                  <TextInput
                    placeholder="e.g. 017xxxxxxxx"
                    placeholderTextColor={Theme.colors.muted}
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
              rules={{ required: 'Password is required', minLength: { value: 4, message: 'Min 4 characters' } }}
              render={({ field: { onChange, value } }) => (
                <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                  <Feather name="lock" size={20} color={Theme.colors.muted} style={styles.inputIcon} />
                  <TextInput
                    placeholder="Your password"
                    placeholderTextColor={Theme.colors.muted}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry
                    style={styles.input}
                  />
                </View>
              )}
            />
            {!!errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}

            <TouchableOpacity disabled={submitting} style={styles.primaryBtn} onPress={handleSubmit(onSubmit)}>
              <LinearGradient
                colors={[Theme.colors.primaryLight, Theme.colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBtn}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Login</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={styles.linkBtn}>
              <Text style={styles.linkText}>Don’t have an account? Sign up</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    shadowColor: Theme.colors.primaryDark,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
    flexShrink: 1,
  },
  cardInner: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    flexShrink: 1,
  },
  title: { fontSize: 26, fontWeight: '800', color: Theme.colors.text },
  subtitle: { marginTop: 6, marginBottom: 20, color: Theme.colors.muted, fontSize: 15 },

  label: { marginTop: 12, marginBottom: 8, color: Theme.colors.text, fontWeight: '600', fontSize: 14 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 16,
  },
  inputError: { borderColor: Theme.colors.danger, backgroundColor: '#FEF2F2' },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: '100%',
    color: Theme.colors.text,
    fontSize: 16,
  },
  errorText: { marginTop: 6, color: Theme.colors.danger, fontSize: 13, fontWeight: '500' },

  primaryBtn: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gradientBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  linkBtn: { marginTop: 20, alignItems: 'center', paddingVertical: 10 },
  linkText: { color: Theme.colors.primary, fontWeight: '600', fontSize: 15 },
});