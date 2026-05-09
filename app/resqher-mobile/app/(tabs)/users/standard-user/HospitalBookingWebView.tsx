/**
 * HospitalBookingWebView.tsx — In-App Hospital Booking Portal
 * ─────────────────────────────────────────────────────────────────────────
 * Opens hospital's official booking page in a WebView while maintaining
 * the ResQher Bulky Glass header for brand continuity.
 *
 * Requires: npx expo install react-native-webview
 */

import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, StatusBar,
    ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, S, R } from '../../../../src/constants/theme';

// Conditional WebView import — gracefully degrades if not installed
let WebView: any = null;
try {
    WebView = require('react-native-webview').WebView;
} catch {
    // WebView not installed — will show fallback UI
}

const D = {
    cardFill: T.surfaceBulky,
    hairline: T.hairlineMicro,
    title: '#FFFFFF',
    subtitle: '#C4C1D4',
    muted: '#A09CB2',
} as const;

export default function HospitalBookingWebView() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ bookingUrl?: string; hospitalName?: string }>();
    const url = params.bookingUrl ?? 'https://www.google.com';
    const hospitalName = params.hospitalName ?? 'Hospital Portal';

    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const webViewRef = useRef<any>(null);

    const handleClose = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.back();
    }, [router]);

    const handleReload = useCallback(() => {
        Haptics.selectionAsync();
        webViewRef.current?.reload();
    }, []);

    // Fallback if WebView is not installed
    if (!WebView) {
        return (
            <AtmosphericShell>
                <View style={[st.root, { paddingTop: insets.top }]}>
                    <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                    <View style={st.header}>
                        <TouchableOpacity onPress={handleClose} style={st.headerBtn} activeOpacity={0.7}>
                            <Ionicons name="close" size={22} color={D.title} />
                        </TouchableOpacity>
                        <View style={st.headerCenter}>
                            <Text style={st.headerTitle} numberOfLines={1}>{hospitalName}</Text>
                        </View>
                        <View style={st.headerBtn} />
                    </View>
                    <View style={st.fallback}>
                        <View style={st.fallbackCircle}>
                            <Ionicons name="globe-outline" size={32} color={D.muted} />
                        </View>
                        <Text style={st.fallbackTitle}>WebView Not Available</Text>
                        <Text style={st.fallbackDesc}>
                            Install react-native-webview to enable in-app booking.{'\n'}
                            Run: npx expo install react-native-webview
                        </Text>
                        <Text style={st.fallbackUrl} numberOfLines={2}>{url}</Text>
                    </View>
                </View>
            </AtmosphericShell>
        );
    }

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Bulky Glass Header ── */}
                <View style={st.headerBar}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={st.headerTint} pointerEvents="none" />
                    <View style={st.headerContent}>
                        <TouchableOpacity onPress={handleClose} style={st.headerBtn} activeOpacity={0.7}>
                            <Ionicons name="close" size={22} color={D.title} />
                        </TouchableOpacity>
                        <View style={st.headerCenter}>
                            <Text style={st.headerTitle} numberOfLines={1}>{hospitalName}</Text>
                            <Text style={st.headerSub} numberOfLines={1}>Secure Booking Portal</Text>
                        </View>
                        <TouchableOpacity onPress={handleReload} style={st.headerBtn} activeOpacity={0.7}>
                            <Feather name="refresh-cw" size={18} color={D.subtitle} />
                        </TouchableOpacity>
                    </View>
                    {/* Progress bar */}
                    {loading && (
                        <View style={st.progressTrack}>
                            <View style={[st.progressBar, { width: `${progress * 100}%` }]} />
                        </View>
                    )}
                </View>

                {/* ── WebView ── */}
                <WebView
                    ref={webViewRef}
                    source={{ uri: url }}
                    style={st.webview}
                    startInLoadingState
                    renderLoading={() => (
                        <View style={st.loadingWrap}>
                            <ActivityIndicator size="large" color={T.violet} />
                            <Text style={st.loadingText}>Loading portal…</Text>
                        </View>
                    )}
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    onLoadProgress={({ nativeEvent }: any) => setProgress(nativeEvent.progress)}
                    javaScriptEnabled
                    domStorageEnabled
                    scalesPageToFit
                />
            </View>
        </AtmosphericShell>
    );
}

const st = StyleSheet.create({
    root: { flex: 1 },

    // ── Simple header (fallback) ────────────────────────────────────────────
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingTop: S.s3, paddingBottom: S.s3 },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: D.cardFill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: S.s2 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: D.title, letterSpacing: -0.2 },
    headerSub: { fontSize: 11, fontWeight: '500', color: D.muted, marginTop: 1 },

    // ── Bulky Glass header bar ──────────────────────────────────────────────
    headerBar: {
        backgroundColor: T.surfaceGlass, borderBottomWidth: 1,
        borderBottomColor: `${T.violet}22`, overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6 },
        }),
    },
    headerTint: { ...StyleSheet.absoluteFillObject, backgroundColor: T.surfaceOverlay },
    headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingTop: S.s3, paddingBottom: S.s3 },

    progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
    progressBar: { height: 2, backgroundColor: T.violet, borderRadius: 1 },

    webview: { flex: 1, backgroundColor: '#0A0A0C' },

    loadingWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0C', gap: S.s3 },
    loadingText: { fontSize: 14, fontWeight: '600', color: D.muted },

    // ── Fallback ────────────────────────────────────────────────────────────
    fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.s6, gap: S.s3 },
    fallbackCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: D.cardFill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: S.s2 },
    fallbackTitle: { fontSize: 18, fontWeight: '700', color: D.subtitle },
    fallbackDesc: { fontSize: 14, fontWeight: '400', color: D.muted, textAlign: 'center', lineHeight: 20 },
    fallbackUrl: { fontSize: 12, fontWeight: '500', color: T.violet, textAlign: 'center', marginTop: S.s2 },
});
