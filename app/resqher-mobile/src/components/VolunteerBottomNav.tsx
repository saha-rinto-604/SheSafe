import React, { memo, useCallback, useRef } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { T, R } from '../constants/theme';

const { width } = Dimensions.get('window');

export const VOLUNTEER_NAV_BAR_HEIGHT = 58;
export const VOLUNTEER_NAV_BOTTOM_OFFSET = 14;
export const VOLUNTEER_NAV_SCREEN_PADDING = 112;

export type VolunteerNavTabId = 'Home' | 'Messages' | 'Incidents' | 'Activity';

type NavTabConfig = {
    id: VolunteerNavTabId;
    label: string;
    iconActive: string;
    iconOutline: string;
    iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
};

const NAV_TABS: NavTabConfig[] = [
    { id: 'Home', label: 'Home', iconActive: 'home', iconOutline: 'home-outline', iconFamily: 'Ionicons' },
    { id: 'Messages', label: 'Messages', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline', iconFamily: 'Ionicons' },
    { id: 'Incidents', label: 'Incidents', iconActive: 'clipboard-clock', iconOutline: 'clipboard-clock-outline', iconFamily: 'MaterialCommunityIcons' },
    { id: 'Activity', label: 'Activity', iconActive: 'time', iconOutline: 'time-outline', iconFamily: 'Ionicons' },
];

const ACTIVE_COLOR = T.violet;
const INACTIVE_COLOR = T.navIconInactive;

const PremiumBar = memo(function PremiumBar({
    style, contentStyle, children,
}: { style?: ViewStyle | ViewStyle[]; contentStyle?: ViewStyle; children: React.ReactNode }) {
    return (
        <View style={[pb.bar, style]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={pb.tint} pointerEvents="none" />
            <View style={[pb.content, contentStyle]}>{children}</View>
        </View>
    );
});

const pb = StyleSheet.create({
    bar: { backgroundColor: 'rgba(30,21,58,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
    tint: { ...StyleSheet.absoluteFillObject, backgroundColor: T.surfaceOverlay },
    content: { flexDirection: 'row', alignItems: 'center' },
});

const NavTab = memo(function NavTab({
    tab, isActive, onPress,
}: { tab: NavTabConfig; isActive: boolean; onPress: () => void }) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePress = useCallback(() => {
        Animated.sequence([
            Animated.timing(scale, { toValue: 0.82, duration: 70, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 14 }),
        ]).start();
        onPress();
    }, [onPress, scale]);

    const Icon = tab.iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;

    return (
        <TouchableOpacity
            style={s.navTab}
            onPress={handlePress}
            activeOpacity={1}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
        >
            <Animated.View style={[s.navTabInner, { transform: [{ scale }] }]}>
                <View style={[s.navIconBox, isActive && s.navIconBoxActive]}>
                    <Icon
                        name={(isActive ? tab.iconActive : tab.iconOutline) as any}
                        size={20}
                        color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
                    />
                </View>
                <View style={[s.navUnderline, { backgroundColor: isActive ? ACTIVE_COLOR : 'transparent' }]} />
            </Animated.View>
        </TouchableOpacity>
    );
});

export default function VolunteerBottomNav({ activeTab }: { activeTab: VolunteerNavTabId }) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const navBottom = Math.max(insets.bottom, 0) + VOLUNTEER_NAV_BOTTOM_OFFSET;

    return (
        <View style={[s.navWrap, { bottom: navBottom }]} pointerEvents="box-none">
            <PremiumBar style={s.navBar} contentStyle={s.navBarContent}>
                {NAV_TABS.map(tab => (
                    <NavTab
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === activeTab}
                        onPress={() => {
                            if (tab.id === 'Home') {
                                router.push('/(tabs)/users/volunteer');
                            } else if (tab.id === 'Messages') {
                                router.push('/(tabs)/users/volunteer/messages');
                            } else if (tab.id === 'Incidents') {
                                router.push('/(tabs)/users/volunteer/incidents');
                            } else if (tab.id === 'Activity') {
                                router.push('/(tabs)/users/volunteer/activity');
                            }
                        }}
                    />
                ))}
            </PremiumBar>
        </View>
    );
}

const s = StyleSheet.create({
    navWrap: {
        position: 'absolute', left: 0, right: 0,
        alignItems: 'center', zIndex: 200,
    },
    navBar: {
        width: width * 0.88, borderRadius: R.pill,
        ...Platform.select({
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    navBarContent: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8, paddingVertical: 8,
    },
    navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    navTabInner: { alignItems: 'center', gap: 0 },
    navUnderline: { width: 16, height: 3, borderRadius: 1.5, marginTop: 5 },
    navIconBox: {
        width: 36, height: 36, borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    navIconBoxActive: {
        backgroundColor: 'rgba(138,56,246,0.12)',
        borderColor: `${T.violet}40`,
    },
});
