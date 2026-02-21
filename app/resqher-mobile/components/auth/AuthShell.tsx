import React from 'react';
import { SafeAreaView, View, StyleSheet, Dimensions, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Theme } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

type Props = {
  children: React.ReactNode;
};

export default function AuthShell({ children }: Props) {
  return (
    <View style={styles.main}>
      {/* Fixed Background */}
      <View style={styles.fixedHeader}>
        <LinearGradient
          colors={[Theme.colors.gradientStart, Theme.colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          {/* Decorative shapes for a premium look */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />
        </LinearGradient>
      </View>

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
    height: 340, // Extended so logo won't clip when bounced
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },
  circle1: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    top: -width * 0.2,
    right: -width * 0.2,
  },
  circle2: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    bottom: -width * 0.1,
    left: -width * 0.1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80, // Moved down to allow space above logo
    paddingBottom: 40,
  },
  logoIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40
  },
});