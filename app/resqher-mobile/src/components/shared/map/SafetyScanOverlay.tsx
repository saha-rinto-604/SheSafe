/**
 * SafetyScanOverlay.tsx — Route safety scan animated overlay
 * ─────────────────────────────────────────────────────────────
 * Extracted verbatim from volunteer/index.tsx lines 405-501.
 * Full-screen overlay with spinning animated rings and a shield icon.
 */

import React, { memo } from 'react';
import { Animated as RNAnimated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../../constants/theme';

const { width } = Dimensions.get('window');

// ── Safety Scan Overlay — same as standard explore ─────────────────────────
export const SafetyScanOverlay = memo(function SafetyScanOverlay({
    visible,
    spinAnim,
    r0,
    r1,
    r2,
    zoneName,
}: {
    visible: boolean;
    spinAnim: RNAnimated.Value;
    r0: RNAnimated.Value;
    r1: RNAnimated.Value;
    r2: RNAnimated.Value;
    zoneName?: string | null;
}) {
    if (!visible) return null;

    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <View style={scanStyles.overlay} pointerEvents="none">
            <View style={scanStyles.card}>
                <View style={scanStyles.iconWrap}>
                    <RNAnimated.View style={[scanStyles.ring, { transform: [{ scale: r0 }, { rotate: spin }] }]} />
                    <RNAnimated.View style={[scanStyles.ring, { transform: [{ scale: r1 }, { rotate: spin }] }]} />
                    <RNAnimated.View style={[scanStyles.ring, { transform: [{ scale: r2 }, { rotate: spin }] }]} />
                    <View style={scanStyles.core}>
                        <Ionicons name="shield-checkmark" size={18} color={T.onPrimary} />
                    </View>
                </View>
                <Text style={scanStyles.title}>Safety Scan Running</Text>
                <Text style={scanStyles.subtitle}>
                    {zoneName ? `Checking safe route around ${zoneName}…` : 'Recalculating safest possible route…'}
                </Text>
            </View>
        </View>
    );
});

const scanStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(8,6,14,0.65)',
        zIndex: 999,
    },
    card: {
        width: width * 0.78,
        backgroundColor: 'rgba(18,14,30,0.96)',
        borderRadius: 20,
        paddingVertical: 24,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    iconWrap: {
        width: 72,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    ring: {
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 1,
        borderColor: 'rgba(138,56,246,0.45)',
    },
    core: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: T.violet,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    title: {
        fontSize: 14,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.2,
    },
    subtitle: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '500',
        color: T.ink3,
        textAlign: 'center',
    },
});
