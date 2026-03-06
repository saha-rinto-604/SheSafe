import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    StatusBar,
    Image,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, R, S } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/AuthContext';

type MenuItem = {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    danger?: boolean;
};

type MenuSection = {
    title: string;
    items: MenuItem[];
};

// ── Profile data ─────────────────────────────────────────────────────────────
// Replace placeholder values with real fields from AuthContext / API once the
// backend /me endpoint is wired up. Only this object needs to change — the
// card UI below is already data-driven.
type ProfileInfo = {
    fullName: string;
    phone: string;
    role: string;
};

const PLACEHOLDER_PROFILE: ProfileInfo = {
    fullName: 'Your Name',
    phone: '+880 1XXX-XXXXXX',
    role: 'Standard User',
};

const MENU_SECTIONS: MenuSection[] = [
    {
        title: 'Safety',
        items: [
            { icon: 'phone-call', label: 'Emergency Contacts' },
            { icon: 'shield', label: 'Safety Settings' },
        ],
    },
    {
        title: 'Account',
        items: [
            { icon: 'check-circle', label: 'Volunteer Verification' },
            { icon: 'clock', label: 'Incident History' },
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

    // Swap PLACEHOLDER_PROFILE for real data from AuthContext / fetch once backend is ready
    const [profile] = useState<ProfileInfo>(PLACEHOLDER_PROFILE);

    const onPressItem = async (item: MenuItem) => {
        if (item.danger) {
            Alert.alert('Logout', 'Are you sure you want to logout?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        router.replace('/(auth)/login');
                    },
                },
            ]);
            return;
        }

        Alert.alert(item.label, 'This section will be available soon.');
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={20} color={T.ink2} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Profile</Text>
                <View style={s.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false}>

                {/* ── Top Profile Info Card ─────────────────────────────────── */}
                <View style={s.profileCard}>
                    <View style={s.profileAvatarWrap}>
                        <Image
                            source={require('../../../assets/images/icon.png')}
                            style={s.profileAvatar}
                        />
                    </View>
                    <View style={s.profileInfo}>
                        <Text style={s.profileName} numberOfLines={1}>{profile.fullName}</Text>
                        <Text style={s.profilePhone} numberOfLines={1}>{profile.phone}</Text>
                        <View style={s.roleBadge}>
                            <Text style={s.roleBadgeText}>{profile.role}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={s.editBtn}
                        onPress={() => Alert.alert('Edit Profile', 'This section will be available soon.')}
                        accessibilityLabel="Edit profile"
                        accessibilityRole="button"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="edit-2" size={16} color={T.violet} />
                    </TouchableOpacity>
                </View>

                {/* ── Grouped Menu Sections ─────────────────────────────────── */}
                {MENU_SECTIONS.map((section) => (
                    <View key={section.title} style={s.sectionWrap}>
                        <Text style={s.sectionHeader}>{section.title}</Text>
                        {section.items.map((item) => (
                            <TouchableOpacity
                                key={item.label}
                                style={s.row}
                                onPress={() => void onPressItem(item)}
                                activeOpacity={0.75}
                            >
                                <View style={s.iconBox}>
                                    <Feather name={item.icon} size={18} color={T.violet} />
                                </View>
                                <Text style={s.rowLabel}>{item.label}</Text>
                                <Feather name="chevron-right" size={15} color={T.ink4} />
                            </TouchableOpacity>
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
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: T.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.lineMid,
        backgroundColor: T.surfaceGlass,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.lineMid,
        backgroundColor: T.surfaceCard,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: T.ink,
        marginHorizontal: 10,
    },
    headerSpacer: {
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
        backgroundColor: T.surfaceCard,
        borderWidth: 1,
        borderColor: T.lineMid,
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
        backgroundColor: T.surfaceCard,
        borderWidth: 1,
        borderColor: T.lineMid,
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
    iconBoxDanger: {
        backgroundColor: `${T.danger}18`,
    },
    rowLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: T.ink,
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
        color: T.ink4,
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
});
