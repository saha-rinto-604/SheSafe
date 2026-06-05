/**
 * MedicalDashboard.tsx — SheSafe Medical Hub Launchpad
 * ─────────────────────────────────────────────────────────────────────────
 * 2-column Bulky Glass category grid with Sheba-style shift filter.
 * NO navbar — this is a Launchpad. Back button returns to SOS/Explore.
 * Floating Gradient Pill "Find" button (absolute-positioned, 30px from bottom).
 *
 * Design: Atmospheric Shell + Bulky Glass material.
 * Header: 1px rgba(255,255,255,0.1) stroke — matches SOS screen exactly.
 * Physics: Powered by React Native Reanimated for AAA-tier fluidity.
 */

import React, { useState, useCallback, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, StatusBar,
    Dimensions, Platform, ScrollView,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    withSpring,
    FadeInUp,
    FadeOutUp,
    LinearTransition,
} from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { T, R, S } from '../../../../src/constants/theme';
import { CATEGORIES } from '../../../../src/data/medicalMockData';
import type { MedicalCategory, ShiftFilter, CategoryItem } from '../../../../src/types/medical';

const { width } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — Medical Module
// ═══════════════════════════════════════════════════════════════════════════════
const D = {
    cardFill: T.surfaceBulky,           // #1E153A
    cardFillActive: T.surfaceBulkyActive,    // #251B48
    hairline: 'rgba(255, 255, 255, 0.1)',
    hairlineActive: 'rgba(255, 255, 255, 0.1)',
    /** Global 1px stroke — matches SOS screen standard */
    stroke: 'rgba(255,255,255,0.1)',
    title: '#FFFFFF',
    subtitle: '#C4C1D4',
    muted: '#A09CB2',
    cardRadius: 16,
    cardPadding: 20,
} as const;

// ── Shift filter definitions ────────────────────────────────────────────────
const SHIFTS: { id: ShiftFilter; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'morning', label: 'Morning Shift', icon: 'sunny-outline' },
    { id: 'evening', label: 'Evening Shift', icon: 'moon-outline' },
    { id: 'now', label: 'Available Now', icon: 'pulse-outline' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CategoryCard — 2-column grid item
// ═══════════════════════════════════════════════════════════════════════════════
const CategoryCard = memo(function CategoryCard({
    item, isSelected, onPress,
}: { item: CategoryItem; isSelected: boolean; onPress: () => void }) {
    const scale = useSharedValue(1);

    // Modern Reanimated Gesture Scale
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Snappy scale-down then spring back up organically
        scale.set(withSequence(
            withTiming(0.94, { duration: 70 }),
            withSpring(1, { damping: 12, stiffness: 280 })
        ));
        onPress();
    }, [onPress, scale]);

    return (
        <TouchableOpacity
            style={st.categoryCardWrap}
            onPress={handlePress}
            activeOpacity={0.9}
        >
            <Animated.View style={[
                st.categoryCard,
                isSelected && st.categoryCardActive,
                animatedStyle,
            ]}>
                {/* Icon Circle */}
                <View style={[st.categoryIconWrap, isSelected && st.categoryIconWrapActive]}>
                    <Ionicons
                        name={item.icon as any}
                        size={26}
                        color={isSelected ? T.violet : D.subtitle}
                    />
                </View>
                {/* Label */}
                <Text style={[st.categoryLabel, isSelected && st.categoryLabelActive]}>
                    {item.label}
                </Text>
                <Text style={st.categoryDesc} numberOfLines={1}>
                    {item.description}
                </Text>
                {/* Selection indicator */}
                {isSelected && <View style={st.categoryDot} />}
            </Animated.View>
        </TouchableOpacity>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MedicalDashboard — Launchpad (No Navbar)
// ═══════════════════════════════════════════════════════════════════════════════
export default function MedicalDashboard() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [selectedCategory, setSelectedCategory] = useState<MedicalCategory>('specialists');
    const [selectedShift, setSelectedShift] = useState<ShiftFilter>('now');

    const medicalCategories = CATEGORIES.filter(cat =>
        cat.id === 'specialists' || cat.id === 'hospital' || cat.id === 'pharmacy' || cat.id === 'ambulance'
    );

    const handleFind = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
            pathname: '/(tabs)/users/standard-user/MedicalMapView',
            params: { category: selectedCategory, shift: selectedShift },
        } as any);
    }, [selectedCategory, selectedShift, router]);

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <ScrollView
                    style={st.scroll}
                    contentContainerStyle={[st.scrollContent, { paddingBottom: 140 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Header — SOS-matching 1px white stroke ── */}
                    <View style={st.header}>
                        <TouchableOpacity
                            onPress={() => { Haptics.selectionAsync(); router.back(); }}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={st.headerBtn}
                            activeOpacity={0.7}
                        >
                            <Feather name="chevron-left" size={22} color={D.title} />
                        </TouchableOpacity>
                        <View style={st.headerTitleArea}>
                            <Text style={st.headerTitle}>Medical</Text>
                            <Text style={st.headerSubtitle}>Safe Medical Navigation</Text>
                        </View>
                        <TouchableOpacity
                            style={st.headerBtn}
                            activeOpacity={0.7}
                            onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/users/standard-user/notifications'); }}
                        >
                            <Feather name="bell" size={18} color={D.subtitle} />
                        </TouchableOpacity>
                    </View>

                    {/* ── Shift Filter ── */}
                    {selectedCategory === 'specialists' && (
                        <Animated.View
                            entering={FadeInUp.duration(250).springify().damping(18)}
                            exiting={FadeOutUp.duration(200)}
                            style={st.filterSection}
                        >
                            <Text style={st.sectionLabel}>WORKLOAD / SHIFT</Text>
                            <View style={st.filterRow}>
                                {SHIFTS.map(shift => (
                                    <TouchableOpacity
                                        key={shift.id}
                                        style={[
                                            st.filterPill,
                                            selectedShift === shift.id && st.filterPillActive,
                                        ]}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setSelectedShift(shift.id);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name={shift.icon as any}
                                            size={14}
                                            color={selectedShift === shift.id ? T.violet : D.muted}
                                        />
                                        <Text style={[
                                            st.filterPillText,
                                            selectedShift === shift.id && st.filterPillTextActive,
                                        ]}>
                                            {shift.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Animated.View>
                    )}

                    {/* ── Category Grid ── */}
                    {/* The Layout prop automatically interpolates structural position changes via Native Springs */}
                    <Animated.View
                        layout={LinearTransition.springify().damping(16).stiffness(140)}
                        style={st.gridSection}
                    >
                        <Text style={st.sectionLabel}>SELECT CATEGORY</Text>
                        <View style={st.grid}>
                            {medicalCategories.map(cat => (
                                <CategoryCard
                                    key={cat.id}
                                    item={cat}
                                    isSelected={selectedCategory === cat.id}
                                    onPress={() => setSelectedCategory(cat.id)}
                                />
                            ))}
                        </View>
                    </Animated.View>
                </ScrollView>

                {/* ── Floating Gradient Pill — Find Button ── */}
                <View style={[st.findFABWrap, { bottom: Math.max(insets.bottom + 20, 32) }]}>
                    <TouchableOpacity
                        style={st.findFAB}
                        onPress={handleFind}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['rgba(138, 56, 246, 0.8)', 'rgba(138, 56, 246, 0.4)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={st.findFABGradient}
                        >
                            <Ionicons name="search" size={18} color={T.onPrimary} />
                            <Text style={st.findFABText}>Find</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </AtmosphericShell>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const st = StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: S.s4, paddingTop: 12 },

    // ── Header — 1px white translucent stroke (SOS standard) ────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: S.s3,
        paddingBottom: S.s4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerBtn: {
        width: 36, height: 36, borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitleArea: { flex: 1, alignItems: 'center' },
    headerTitle: {
        fontSize: 20, fontWeight: '700', color: D.title,
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 12, fontWeight: '500', color: D.muted,
        marginTop: 2,
    },

    // ── Shift Filter ────────────────────────────────────────────────────────
    filterSection: { marginBottom: S.s5, marginTop: 12 },
    sectionLabel: {
        fontSize: 11, fontWeight: '700', color: T.ink3,
        letterSpacing: 0.8, textTransform: 'uppercase',
        marginBottom: S.s3,
    },
    filterRow: {
        flexDirection: 'row', gap: S.s2,
    },
    filterPill: {
        flex: 1,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6,
        paddingVertical: S.s3,
        borderRadius: D.cardRadius,
        backgroundColor: D.cardFill,
        borderWidth: 1, borderColor: D.hairline,
    },
    filterPillActive: {
        backgroundColor: T.violetDim,
        borderColor: D.hairlineActive,
    },
    filterPillText: {
        fontSize: 11, fontWeight: '600', color: D.muted,
    },
    filterPillTextActive: {
        color: T.violet,
    },

    // ── Category Grid ───────────────────────────────────────────────────────
    gridSection: { marginBottom: S.s5 },
    grid: {
        flexDirection: 'row', flexWrap: 'wrap',
        gap: S.s3,
    },
    categoryCardWrap: {
        width: (width - S.s4 * 2 - S.s3) / 2, // 2-column with gap
    },
    categoryCard: {
        backgroundColor: D.cardFill,
        borderRadius: D.cardRadius,
        borderWidth: 1, borderColor: D.hairline,
        padding: D.cardPadding,
        alignItems: 'center',
        gap: S.s3,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 2 },
        }),
    },
    categoryCardActive: {
        backgroundColor: D.cardFillActive,
        borderColor: D.hairlineActive,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 6 },
        }),
    },
    categoryIconWrap: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: D.hairline,
        alignItems: 'center', justifyContent: 'center',
    },
    categoryIconWrapActive: {
        backgroundColor: T.violetDim,
        borderColor: D.hairlineActive,
    },
    categoryLabel: {
        fontSize: 14, fontWeight: '700', color: D.subtitle,
        letterSpacing: 0.1,
    },
    categoryLabelActive: {
        color: D.title,
    },
    categoryDesc: {
        fontSize: 11, fontWeight: '400', color: D.muted,
        textAlign: 'center',
    },
    categoryDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: T.violet,
        position: 'absolute', top: 10, right: 10,
    },

    // ── Floating Gradient Pill — Find Button ────────────────────────────────
    findFABWrap: {
        position: 'absolute', left: 0, right: 0,
        alignItems: 'center', zIndex: 300,
    },
    findFAB: {
        width: '50%',
        borderRadius: R.pill,
        overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 6, shadowColor: '#8A38F6' },
        }),
    },
    findFABGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: S.s2,
        paddingVertical: 14,
        borderRadius: R.pill,
    },
    findFABText: {
        fontSize: 16, fontWeight: '800', color: T.onPrimary,
        letterSpacing: 0.4,
    },
});
