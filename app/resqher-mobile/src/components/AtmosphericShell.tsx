/**
 * AtmosphericShell.tsx — Global Atmospheric Environment Wrapper
 * ─────────────────────────────────────────────────────────────────────────
 * Deep Midnight Violet (#120B29) → Dark Indigo (#090514) gradient.
 * NO pure black — the entire app lives inside one deep violet environment.
 * Top-left violet radial glow simulates a tactical light source.
 *
 * Usage: <AtmosphericShell>{children}</AtmosphericShell>
 */

import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { S } from '../constants/theme';
import { G } from '../constants/gradients';

type Props = {
    children: React.ReactNode;
};

export default function AtmosphericShell({ children }: Props) {
    const { width, height } = useWindowDimensions();

    // Glow orb: 45% of screen width for generous atmospheric wash
    const orbSize = width * 0.45;

    return (
        <View style={st.root}>
            {/* ── Base gradient: Deep Midnight Violet → Dark Indigo ── */}
            <LinearGradient
                colors={G.atmosphericBg.colors}
                start={G.atmosphericBg.start}
                end={G.atmosphericBg.end}
                style={StyleSheet.absoluteFill}
            />

            {/* ── Radial light-leak: violet glow, top-left ──
                 Origin: X -10%, Y -5% — soft bleed from top-left corner
                 pointerEvents: 'none' — never blocks taps
                 zIndex: -1 — always behind content */}
            <View
                pointerEvents="none"
                style={[
                    st.lightLeak,
                    {
                        top: -(height * 0.05),
                        left: -(width * 0.10),
                        width: orbSize,
                        height: orbSize,
                        borderRadius: orbSize / 2,
                    },
                ]}
            />

            {/* ── Content layer ── */}
            <View style={st.content}>
                {children}
            </View>
        </View>
    );
}

const st = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#090514', // Fallback: Dark Indigo (matches gradient end)
    },
    // Radial glow orb — simulated via background + iOS shadow spread
    lightLeak: {
        position: 'absolute',
        backgroundColor: 'rgba(138,56,246,0.06)',
        zIndex: -1,
        ...Platform.select({
            ios: {
                shadowColor: '#8A38F6',
                shadowOpacity: 0.40,
                shadowRadius: S.s8 * 2, // 128pt atmospheric spread
                shadowOffset: { width: 0, height: 0 },
            },
            android: {
                elevation: 0,
            },
        }),
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
});
