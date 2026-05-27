/**
 * PasswordStrength.tsx — Real-time password validation + strength meter
 * ──────────────────────────────────────────────────────────────────────
 * Shows a dynamic checklist and color-coded progress bar as the user types.
 * Designed for the SheSafe dark theme with smooth animations.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, S } from '../../src/constants/theme';

// ── Validation Rules ───────────────────────────────────────────────────────────
export type PasswordRule = {
  key: string;
  label: string;
  test: (pw: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length',   label: 'At least 8 characters',       test: (pw) => pw.length >= 8 },
  { key: 'upper',    label: 'One uppercase letter (A-Z)',   test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower',    label: 'One lowercase letter (a-z)',   test: (pw) => /[a-z]/.test(pw) },
  { key: 'digit',    label: 'One numerical digit (0-9)',    test: (pw) => /\d/.test(pw) },
  { key: 'special',  label: 'One special character (!@#$)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

/** Returns true only if ALL rules pass. */
export function isStrongPassword(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

/** Returns 0-5 score representing how many rules pass. */
export function getPasswordScore(pw: string): number {
  if (!pw) return 0;
  return PASSWORD_RULES.filter((r) => r.test(pw)).length;
}

// ── Strength Levels ────────────────────────────────────────────────────────────
const STRENGTH_LEVELS = [
  { label: '',             color: 'transparent' },      // 0
  { label: 'Very Weak',   color: '#EF4444' },           // 1
  { label: 'Weak',         color: '#F97316' },           // 2
  { label: 'Fair',         color: '#F59E0B' },           // 3
  { label: 'Good',         color: '#22D3EE' },           // 4
  { label: 'Strong',       color: '#10B981' },           // 5
] as const;

// ── Animated Check Item ────────────────────────────────────────────────────────
function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  const scale = useRef(new Animated.Value(passed ? 1 : 0.9)).current;
  const opacity = useRef(new Animated.Value(passed ? 1 : 0.45)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: passed ? 1 : 0.95,
        tension: 200,
        friction: 15,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: passed ? 1 : 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [passed]);

  return (
    <Animated.View style={[st.checkRow, { opacity, transform: [{ scale }] }]}>
      <View style={[st.checkIcon, passed && st.checkIconPassed]}>
        <Feather
          name={passed ? 'check' : 'circle'}
          size={passed ? 11 : 8}
          color={passed ? '#10B981' : '#636366'}
        />
      </View>
      <Text style={[st.checkLabel, passed && st.checkLabelPassed]}>
        {label}
      </Text>
    </Animated.View>
  );
}

// ── Strength Bar ───────────────────────────────────────────────────────────────
function StrengthBar({ score }: { score: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: score / PASSWORD_RULES.length,
      duration: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [score]);

  const level = STRENGTH_LEVELS[score] ?? STRENGTH_LEVELS[0];

  return (
    <View style={st.barWrap}>
      <View style={st.barTrack}>
        <Animated.View
          style={[
            st.barFill,
            {
              backgroundColor: level.color,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      {score > 0 && (
        <Text style={[st.barLabel, { color: level.color }]}>
          {level.label}
        </Text>
      )}
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(() => getPasswordScore(password), [password]);
  const results = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(password) })),
    [password],
  );

  // Don't render at all if no input
  if (!password) return null;

  return (
    <View style={st.container}>
      {/* Strength bar */}
      <StrengthBar score={score} />

      {/* Checklist */}
      <View style={st.checkList}>
        {results.map((r) => (
          <CheckItem key={r.key} label={r.label} passed={r.passed} />
        ))}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: {
    marginTop: S.s1,
    marginBottom: S.s2,
    paddingHorizontal: S.s1,
  },

  // ── Strength bar
  barWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.s2,
    gap: S.s2,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    minWidth: 60,
    textAlign: 'right',
  },

  // ── Checklist
  checkList: {
    gap: 5,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s2,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconPassed: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.30)',
  },
  checkLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: T.ink5,
  },
  checkLabelPassed: {
    color: '#34D399',
  },
});
