import React, { memo, useCallback, useRef } from 'react';
import { Animated, Dimensions, Keyboard, Platform, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle as SvgCircle, G as SvgG, Line } from 'react-native-svg';
import { T, R } from '../constants/theme';

const { width } = Dimensions.get('window');

export const VOLUNTEER_NAV_BAR_HEIGHT = 58;
export const VOLUNTEER_NAV_BOTTOM_OFFSET = 14;
export const VOLUNTEER_NAV_SCREEN_PADDING = 112;

export type VolunteerNavTabId = 'Home' | 'Messages' | 'Activity' | 'Medical';

type NavTabConfig = {
    id: VolunteerNavTabId;
    label: string;
    iconActive: string;
    iconOutline: string;
    iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
    isCustomSvg?: boolean;
    route: string;
};

const NAV_TABS: NavTabConfig[] = [
    { id: 'Home', label: 'Home', iconActive: 'home', iconOutline: 'home-outline', iconFamily: 'Ionicons', route: '/(tabs)/users/volunteer' },
    { id: 'Messages', label: 'Messages', iconActive: 'chatbubble-ellipses', iconOutline: 'chatbubble-ellipses-outline', iconFamily: 'Ionicons', route: '/(tabs)/users/volunteer/messages' },
    { id: 'Activity', label: 'Activity', iconActive: 'time', iconOutline: 'time-outline', iconFamily: 'Ionicons', isCustomSvg: true, route: '/(tabs)/users/volunteer/activity' },
    { id: 'Medical', label: 'Medical', iconActive: 'medkit', iconOutline: 'medkit-outline', iconFamily: 'Ionicons', route: '/(tabs)/users/volunteer/medical' },
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

const LeaderboardIcon = ({ color }: { color: string }) => (
    <Svg viewBox="0 0 48 48" width={24} height={24}>
        <SvgG stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <SvgCircle cx="24" cy="9" r="6" />
            <Path d="M 17 40 L 8 40 C 4 40 4 36 4 27 C 4 17 12 16 24 16 C 36 16 44 17 44 27 C 44 36 44 40 40 40 L 31 40" />
            <Line x1="16" y1="23" x2="32" y2="23" />
            <Path d="M 16 23 C 16 35 20 37 24 37 C 28 37 32 35 32 23" />
            <Path d="M 19 23 C 19 32 21 34 24 34 C 27 34 29 32 29 23" />
            <Path d="M 16 26 C 11 26 11 32 16 32" />
            <Path d="M 32 26 C 37 26 37 32 32 32" />
            <Path d="M 22 37 C 22 41 18 41 18 41 L 18 45 L 30 45 L 30 41 C 30 41 26 41 26 37" />
            <Line x1="15" y1="45" x2="33" y2="45" />
            <SvgCircle cx="10" cy="36" r="3.5" />
            <Path d="M 10 34 L 10 36 L 12 36" />
            <SvgCircle cx="35" cy="33" r="1" fill={color} stroke="none" />
            <SvgCircle cx="35" cy="36.5" r="1" fill={color} stroke="none" />
            <SvgCircle cx="35" cy="40" r="1" fill={color} stroke="none" />
            <Line x1="38" y1="33" x2="42" y2="33" />
            <Line x1="38" y1="36.5" x2="42" y2="36.5" />
            <Line x1="38" y1="40" x2="42" y2="40" />
        </SvgG>
    </Svg>
);

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
                    {tab.isCustomSvg ? (
                        <LeaderboardIcon color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR} />
                    ) : (
                        <Icon
                            name={(isActive ? tab.iconActive : tab.iconOutline) as any}
                            size={20}
                            color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
                        />
                    )}
                </View>
                <View style={[s.navUnderline, { backgroundColor: isActive ? ACTIVE_COLOR : 'transparent' }]} />
            </Animated.View>
        </TouchableOpacity>
    );
});

export default function VolunteerNavbar({ activeTab, onActiveTabPress }: { activeTab: VolunteerNavTabId; onActiveTabPress?: () => void }) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const navBottom = Math.max(insets.bottom, 0) + VOLUNTEER_NAV_BOTTOM_OFFSET;
    const navigationGuardRef = useRef(false);

    const navigateSafely = useCallback((path: string, tabId: VolunteerNavTabId) => {
        if (tabId === activeTab) {
            onActiveTabPress?.();
            return;
        }
        if (navigationGuardRef.current) return;
        navigationGuardRef.current = true;
        Keyboard.dismiss();
        router.push(path as any);
        setTimeout(() => { navigationGuardRef.current = false; }, 800);
    }, [activeTab, onActiveTabPress, router]);

    return (
        <View style={[s.navWrap, { bottom: navBottom }]} pointerEvents="box-none">
            <PremiumBar style={s.navBar} contentStyle={s.navBarContent}>
                {NAV_TABS.map(tab => (
                    <NavTab
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === activeTab}
                        onPress={() => navigateSafely(tab.route, tab.id)}
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
