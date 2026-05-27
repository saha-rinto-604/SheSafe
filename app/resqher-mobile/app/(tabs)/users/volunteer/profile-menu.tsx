import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    Alert,
    Modal,
    ScrollView,
    StatusBar,
    Image,
    Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { T, R, S } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/AuthContext';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { getUserProfile, displayName, UserProfile } from '../../../../src/services/profile';
import UserAvatar from '../../../../src/components/shared/UserAvatar';

type MenuItem = {
    label: string;
    subtitle?: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    danger?: boolean;
    isToggle?: boolean;
};

type MenuSection = {
    title: string;
    items: MenuItem[];
};

// ── Profile display data ─────────────────────────────────────────────────────
// Loaded from local profile service (SecureStore) on focus.
// Swap getUserProfile() for an API call once the backend /me endpoint is ready.

const MENU_SECTIONS: MenuSection[] = [
    {
        title: 'Safety',
        items: [
            { icon: 'phone-call', label: 'Emergency Contacts' },
            { icon: 'shield', label: 'Safety Settings' },
            { icon: 'clipboard', label: 'Incident History' },
            { icon: 'bell', label: 'Receive SOS Alerts', isToggle: true },
        ],
    },
    {
        title: 'Achievements',
        items: [
            {
                icon: 'award',
                label: 'Volunteer Certificate',
                subtitle: 'Preview and download your SheSafe achievement certificate',
            },
        ],
    },
    {
        title: 'Account',
        items: [
            { icon: 'lock', label: 'Privacy & Security' },
        ],
    },
    {
        title: 'App',
        items: [
            { icon: 'settings', label: 'Settings' },
            { icon: 'help-circle', label: 'Help & Support' },
        ],
    },
];

const LOGOUT_ITEM: MenuItem = { icon: 'log-out', label: 'Logout', danger: true };

export default function ProfileMenuScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { signOut } = useAuth();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [receiveSosAlerts, setReceiveSosAlerts] = useState(true);
    const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

    // Reload profile whenever this screen is focused
    useFocusEffect(
        useCallback(() => {
            getUserProfile().then(setProfile);
            import('./safety-settings').then(({ loadSafetySettings }) => {
                loadSafetySettings().then(s => setReceiveSosAlerts(s.receiveSosAlerts));
            });
        }, []),
    );

    const toggleSosAlerts = async (val: boolean) => {
        setReceiveSosAlerts(val);
        const { loadSafetySettings, SAFETY_SETTINGS_KEY } = await import('./safety-settings');
        const settings = await loadSafetySettings();
        settings.receiveSosAlerts = val;
        await SecureStore.setItemAsync(SAFETY_SETTINGS_KEY, JSON.stringify(settings));
    };

    const onPressItem = async (item: MenuItem) => {
        if (item.danger) {
            setLogoutConfirmVisible(true);
            return;
        }

        if (item.label === 'Volunteer Certificate') {
            router.push('/(tabs)/users/volunteer/certificate');
            return;
        }

        if (item.label === 'Emergency Contacts') {
            router.push('/(tabs)/users/volunteer/emergency-contacts');
            return;
        }

        if (item.label === 'Safety Settings') {
            router.push('/(tabs)/users/volunteer/safety-settings');
            return;
        }

        if (item.label === 'Privacy & Security') {
            router.push('/(tabs)/users/volunteer/privacy-security');
            return;
        }

        if (item.label === 'Incident History') {
            router.push('/(tabs)/users/volunteer/incidents');
            return;
        }

        Alert.alert(item.label, 'This section will be available soon.');
    };

    const closeLogoutConfirm = useCallback(() => {
        setLogoutConfirmVisible(false);
    }, []);

    const handleLogout = useCallback(async () => {
        setLogoutConfirmVisible(false);
        await signOut();
        router.replace('/(auth)/login');
    }, [router, signOut]);

    return (
        <AtmosphericShell>
            <View style={[s.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <Modal
                    visible={logoutConfirmVisible}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={closeLogoutConfirm}
                >
                    <View style={s.logoutConfirmOverlay}>
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.logoutConfirmScrim} pointerEvents="none" />
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeLogoutConfirm} />
                        <View style={s.logoutConfirmCard}>
                            <View style={s.logoutConfirmIconWrap}>
                                <Feather name="log-out" size={24} color={T.danger} />
                            </View>
                            <Text style={s.logoutConfirmTitle}>Logout</Text>
                            <Text style={s.logoutConfirmMessage}>Are you sure you want to logout?</Text>
                            <View style={s.logoutConfirmActions}>
                                <TouchableOpacity style={s.logoutConfirmSecondaryBtn} onPress={closeLogoutConfirm} activeOpacity={0.85}>
                                    <Text style={s.logoutConfirmSecondaryTxt}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.logoutConfirmPrimaryBtn} onPress={handleLogout} activeOpacity={0.9}>
                                    <LinearGradient
                                        colors={["#D92D20", "#F04444"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={s.logoutConfirmPrimaryFill}
                                    >
                                        <Text style={s.logoutConfirmPrimaryTxt}>Logout</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* ── Header — match Medical header style ── */}
                <View style={s.header}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => { void Haptics.selectionAsync(); router.back(); }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        activeOpacity={0.7}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <View style={s.headerTitleArea}>
                        <Text style={s.headerTitle}>Profile</Text>
                    </View>
                    <View style={s.headerRightSpacer} />
                </View>

                <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false}>

                {/* ── Top Profile Info Card ─────────────────────────────────── */}
                {/* Tap card body → Profile Information; tap edit icon → Edit Profile */}
                <Pressable
                    style={s.profileCard}
                    onPress={() => router.push('/(tabs)/users/volunteer/profile-information')}
                    accessibilityLabel="View profile information"
                    accessibilityRole="button"
                >
                    <View style={s.profileAvatarWrap}>
                        <UserAvatar 
                            uri={profile?.photoUri} 
                            size={58} 
                            style={s.profileAvatar} 
                            iconColor={T.violet}
                            backgroundColor={T.violetDim}
                        />
                    </View>
                    <View style={s.profileInfo}>
                        <Text style={s.profileName} numberOfLines={1}>
                            {profile ? displayName(profile) : 'Your Name'}
                        </Text>
                        <Text style={s.profilePhone} numberOfLines={1}>
                            {profile?.phone || '+880 1XXX-XXXXXX'}
                        </Text>
                        <View style={s.roleBadge}>
                            <Text style={s.roleBadgeText}>Volunteer</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={s.editBtn}
                        onPress={() => router.push('/(tabs)/users/volunteer/edit-profile')}
                        accessibilityLabel="Edit profile"
                        accessibilityRole="button"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="edit-2" size={16} color={T.violet} />
                    </TouchableOpacity>
                </Pressable>

                {/* ── Grouped Menu Sections ─────────────────────────────────── */}
                {MENU_SECTIONS.map((section) => (
                    <View key={section.title} style={s.sectionWrap}>
                        <Text style={s.sectionHeader}>{section.title}</Text>
                        {section.items.map((item) => (
                            <React.Fragment key={item.label}>
                                {item.isToggle ? (
                                    <View style={[s.row, { paddingVertical: 8 }]}>
                                        <View style={s.iconBox}>
                                            <Feather name={item.icon} size={18} color={T.violet} />
                                        </View>
                                        <Text style={s.rowLabel}>{item.label}</Text>
                                        <Switch
                                            value={receiveSosAlerts}
                                            onValueChange={toggleSosAlerts}
                                            trackColor={{ false: T.surfaceMid, true: `${T.violet}80` }}
                                            thumbColor={receiveSosAlerts ? T.violet : T.ink4}
                                            ios_backgroundColor={T.surfaceMid}
                                        />
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={s.row}
                                        onPress={() => void onPressItem(item)}
                                        activeOpacity={0.75}
                                    >
                                        <View style={s.iconBox}>
                                            <Feather name={item.icon} size={18} color={T.violet} />
                                        </View>
                                        <View style={s.rowText}>
                                            <Text style={[s.rowLabel, item.subtitle ? s.rowLabelStacked : null]}>
                                                {item.label}
                                            </Text>
                                            {item.subtitle ? (
                                                <Text style={s.rowSubtitle}>{item.subtitle}</Text>
                                            ) : null}
                                        </View>
                                        <Feather name="chevron-right" size={15} color={T.ink4} />
                                    </TouchableOpacity>
                                )}
                            </React.Fragment>
                        ))}
                    </View>
                ))}

                {/* ── Logout ─────────────────────────────────────────────────── */}
                <View style={s.logoutWrap}>
                    <TouchableOpacity
                        style={[s.row, s.rowLogout]}
                        onPress={() => void onPressItem(LOGOUT_ITEM)}
                        activeOpacity={0.75}
                    >
                        <View style={[s.iconBox, s.iconBoxDanger]}>
                            <Feather name="log-out" size={18} color={T.danger} />
                        </View>
                        <Text style={[s.rowLabel, s.rowLabelDanger]}>Logout</Text>
                    </TouchableOpacity>
                </View>
                </ScrollView>
            </View>
        </AtmosphericShell>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleArea: { flex: 1, alignItems: 'center' },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: -0.3,
    },
    headerRightSpacer: {
        width: 36,
        height: 36,
    },
    listWrap: {
        paddingHorizontal: 14,
        paddingTop: 16,
        paddingBottom: 24,
    },
    // ── Profile Info Card ────────────────────────────────────────────────────
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: R.lg,
        paddingHorizontal: S.s4,
        paddingVertical: 16,
        marginBottom: 20,
        gap: 14,
    },
    profileAvatarWrap: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderWidth: 2,
        borderColor: `${T.violet}50`,
        overflow: 'hidden',
        backgroundColor: T.violetDim,
    },
    profileAvatar: {
        width: '100%',
        height: '100%',
    },
    profileInfo: {
        flex: 1,
        gap: 3,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: -0.3,
    },
    profilePhone: {
        fontSize: 13,
        fontWeight: '500',
        color: T.ink3,
        letterSpacing: 0.1,
    },
    roleBadge: {
        alignSelf: 'flex-start',
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: R.xs,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
    },
    roleBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: T.violet,
        letterSpacing: 0.3,
    },
    verifiedBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: R.xs,
        backgroundColor: T.safeLight,
        borderWidth: 1,
        borderColor: `${T.success}35`,
    },
    verifiedBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: T.success,
        letterSpacing: 0.3,
    },
    editBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: S.s3,
        borderRadius: R.md,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 10,
    },
    iconBox: {
        width: 34,
        height: 34,
        borderRadius: R.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        backgroundColor: T.violetDim,
    },
    rowText: {
        flex: 1,
        paddingRight: 10,
    },
    iconBoxDanger: {
        backgroundColor: `${T.danger}18`,
    },
    rowLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: T.ink,
    },
    rowLabelStacked: {
        flex: 0,
    },
    rowSubtitle: {
        marginTop: 3,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500',
        color: T.ink3,
    },
    rowLabelDanger: {
        color: T.danger,
    },
    // ── Section groups ────────────────────────────────────────────────────
    sectionWrap: {
        marginBottom: 6,
    },
    sectionHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
    },
    logoutWrap: {
        marginTop: 10,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: T.lineMid,
    },
    rowLogout: {
        borderColor: `${T.danger}22`,
    },
    logoutConfirmOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        backgroundColor: 'rgba(4,6,12,0.45)',
    },
    logoutConfirmScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,8,18,0.52)',
    },
    logoutConfirmCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 28,
        paddingHorizontal: 22,
        paddingTop: 22,
        paddingBottom: 18,
        backgroundColor: 'rgba(24,16,40,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 18,
    },
    logoutConfirmIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(217,45,32,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(217,45,32,0.28)',
        marginBottom: 14,
    },
    logoutConfirmTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.3,
    },
    logoutConfirmMessage: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: T.ink2,
        fontWeight: '500',
    },
    logoutConfirmActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 22,
    },
    logoutConfirmSecondaryBtn: {
        flex: 1,
        minHeight: 48,
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoutConfirmSecondaryTxt: {
        color: T.ink3,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    logoutConfirmPrimaryBtn: {
        flex: 1,
        borderRadius: R.pill,
        overflow: 'hidden',
        minHeight: 48,
    },
    logoutConfirmPrimaryFill: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoutConfirmPrimaryTxt: {
        color: T.onPrimary,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
});
