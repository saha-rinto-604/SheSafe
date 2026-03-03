import React from 'react';
import { SafeAreaView, View, StyleSheet, Dimensions, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { T, Theme } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

type Props = {
  children: React.ReactNode;
  onBack?: () => void;
};

export default function AuthShell({ children, onBack }: Props) {
  return (
    <View style={styles.main}>
      {/* Fixed Background — Nearly neutral with minimal brand tint */}
      <View style={styles.fixedHeader}>
        <LinearGradient
          colors={['#FAFBFC', '#F9FAFB', '#F3F4F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          {/* Decorative shapes for a premium look — minimal purple */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.circle3} />
        </LinearGradient>
      </View>

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {onBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Feather name="chevron-left" size={24} color={Theme.colors.primaryDark} />
            </TouchableOpacity>
          )}

          <View style={styles.logoContainer}>
            <View style={styles.logoIconBg}>
              <Feather name="shield" size={42} color={Theme.colors.primary} />
            </View>
          </View>

          <View style={styles.content}>
            {children}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: Theme.colors.background },
  safe: { flex: 1 },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: `rgba(168,85,247,0.08)`, // Very subtle purple — barely visible
    top: -width * 0.4,
    right: -width * 0.3,
  },
  circle2: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: `rgba(168,85,247,0.04)`, // Minimal purple tint
    bottom: -width * 0.15,
    left: -width * 0.1,
  },
  circle3: {
    position: 'absolute',
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    backgroundColor: `rgba(168,85,247,0.06)`, // Subtle accent
    top: width * 0.05,
    left: width * 0.1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.violetDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 30,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: T.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});