/**
 * Toast.tsx — Premium notification system for SheSafe
 * ────────────────────────────────────────────────────
 * Color-coded toast with glassmorphism, Feather icons, entrance/exit
 * animations, auto-dismiss, and optional action button.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast({ type: 'error', title: 'Auth failed', message: '...' });
 */

import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Platform, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R, S } from '../../src/constants/theme';

// ── Types ──────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastConfig = {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;           // ms — default 4000
  action?: { label: string; onPress: () => void };
};

type ToastContextValue = {
  showToast: (config: ToastConfig) => void;
};

// ── Color Palette ──────────────────────────────────────────────────────────────
const TOAST_THEMES: Record<ToastType, {
  bg: string; border: string; icon: keyof typeof Feather.glyphMap;
  iconColor: string; titleColor: string; msgColor: string; progressColor: string;
}> = {
  success: {
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.30)',
    icon: 'check-circle',
    iconColor: '#34D399',
    titleColor: '#34D399',
    msgColor: 'rgba(209,250,229,0.80)',
    progressColor: '#10B981',
  },
  error: {
    bg: 'rgba(244,63,94,0.12)',
    border: 'rgba(244,63,94,0.30)',
    icon: 'alert-circle',
    iconColor: '#FB7185',
    titleColor: '#FB7185',
    msgColor: 'rgba(255,228,230,0.80)',
    progressColor: '#F43F5E',
  },
  warning: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.30)',
    icon: 'alert-triangle',
    iconColor: '#FBBF24',
    titleColor: '#FBBF24',
    msgColor: 'rgba(254,243,199,0.80)',
    progressColor: '#F59E0B',
  },
  info: {
    bg: 'rgba(56,189,248,0.12)',
    border: 'rgba(56,189,248,0.30)',
    icon: 'info',
    iconColor: '#38BDF8',
    titleColor: '#38BDF8',
    msgColor: 'rgba(224,242,254,0.80)',
    progressColor: '#0EA5E9',
  },
};

// ── Context ────────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastConfig & { id: number }) | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((config: ToastConfig) => {
    const id = ++idRef.current;
    setToast({ ...config, id });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <ToastBanner
          key={toast.id}
          config={toast}
          onDismiss={dismiss}
        />
      )}
    </ToastContext.Provider>
  );
}

// ── Banner Component ───────────────────────────────────────────────────────────
function ToastBanner({ config, onDismiss }: { config: ToastConfig; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const theme = TOAST_THEMES[config.type];
  const duration = config.duration ?? 4000;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, []);

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar countdown
    Animated.timing(progress, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();

    // Auto-dismiss
    timerRef.current = setTimeout(dismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const screenW = Dimensions.get('window').width;

  return (
    <Animated.View
      style={[
        st.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
          opacity,
          pointerEvents: 'box-none',
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={dismiss}
        style={[
          st.card,
          {
            backgroundColor: theme.bg,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Icon */}
        <View style={[st.iconWrap, { backgroundColor: `${theme.iconColor}15` }]}>
          <Feather name={theme.icon} size={20} color={theme.iconColor} />
        </View>

        {/* Copy */}
        <View style={st.content}>
          <Text style={[st.title, { color: theme.titleColor }]} numberOfLines={1}>
            {config.title}
          </Text>
          {!!config.message && (
            <Text style={[st.message, { color: theme.msgColor }]} numberOfLines={2}>
              {config.message}
            </Text>
          )}
          {config.action && (
            <TouchableOpacity
              onPress={() => { config.action!.onPress(); dismiss(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={st.actionBtn}
            >
              <Text style={[st.actionTxt, { color: theme.iconColor }]}>
                {config.action.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Close */}
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={st.closeBtn}
        >
          <Feather name="x" size={16} color="rgba(255,255,255,0.40)" />
        </TouchableOpacity>

        {/* Progress bar */}
        <Animated.View
          style={[
            st.progressTrack,
            {
              backgroundColor: `${theme.progressColor}20`,
            },
          ]}
        >
          <Animated.View
            style={[
              st.progressFill,
              {
                backgroundColor: theme.progressColor,
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: {
    position: 'absolute',
    left: S.s4,
    right: S.s4,
    zIndex: 9999,
    elevation: 999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: S.s3,
    paddingBottom: S.s3 + 4, // extra for progress bar
    paddingHorizontal: S.s4,
    borderRadius: R.lg,
    borderWidth: 1,
    overflow: 'hidden',
    // Glassmorphism
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 24 },
    }),
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.s3,
    marginTop: 1,
  },
  content: {
    flex: 1,
    paddingRight: S.s2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  message: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 17,
  },
  actionBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  actionTxt: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 2,
    marginLeft: S.s1,
    marginTop: 1,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
