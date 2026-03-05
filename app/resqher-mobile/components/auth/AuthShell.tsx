
import React from 'react';
import {
  SafeAreaView, View, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { T } from '../../src/constants/theme';
import { G } from '../../src/constants/gradients';

type Props = {
  children: React.ReactNode;
  onBack?: () => void;
};

// ─── Auth Shell ─────────────────────────────────────────────────────────────
export default function AuthShell({ children, onBack }: Props) {
  return (
    <View style={styles.main}>
      {/* OLED Black → subtle violet aura from bottom */}
      <LinearGradient
        colors={G.authBg.colors}
        locations={G.authBg.locations as unknown as [number, number, ...number[]]}
        start={G.authBg.start}
        end={G.authBg.end}
        style={StyleSheet.absoluteFill}
      />



      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {onBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Feather name="chevron-left" size={24} color={T.ink} />
            </TouchableOpacity>
          )}

          <View style={styles.logoContainer}>
            <View style={styles.logoIconBg}>
              <Feather name="shield" size={42} color={T.violet} />
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
  main: { flex: 1, backgroundColor: '#000000' },
  safe: { flex: 1 },

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
    borderWidth: 1,
    borderColor: 'rgba(138,56,246,0.20)',
    ...Platform.select({
      ios: {
        shadowColor: '#8A38F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 30,
      },
      android: { elevation: 16 },
    }),
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 30,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#8A38F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
});