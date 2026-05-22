import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    ScrollView as RNScrollView,
    TouchableOpacity,
    Animated,
    LayoutAnimation,
    Platform,
    UIManager,
    Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';

type ActivityType = 'RESPONDED' | 'FOLLOW_UP' | 'TRAINING' | 'ALERT';
type ActivityStatus = 'COMPLETED' | 'ASSIGNED' | 'CANCELLED';

type ActivityItem = {
    id: string;
    type: ActivityType;
    volunteerName: string;
    userName: string;
    incidentNumber: number;
    timeLabel: string;
    points: number;
    status: ActivityStatus;
};

type LeaderRow = {
    id: string;
    name: string;
    points: number;
    missions: number;
    rating: number;
};

const ACTIVITY: ActivityItem[] = [
    {
        id: 'act-401',
        type: 'RESPONDED',
        volunteerName: 'Raihan Ahmed',
        userName: 'Sarah Akter',
        incidentNumber: 204,
        timeLabel: 'Today · 8:42 PM',
        points: 120,
        status: 'COMPLETED',
    },
    {
        id: 'act-402',
        type: 'FOLLOW_UP',
        volunteerName: 'Nafisa Khan',
        userName: 'Ayesha Rahman',
        incidentNumber: 175,
        timeLabel: 'Today · 6:10 PM',
        points: 40,
        status: 'COMPLETED',
    },
    {
        id: 'act-403',
        type: 'ALERT',
        volunteerName: 'Kabir Hossain',
        userName: 'Nadia Hossain',
        incidentNumber: 198,
        timeLabel: 'Yesterday · 9:16 PM',
        points: 0,
        status: 'CANCELLED',
    },
    {
        id: 'act-404',
        type: 'TRAINING',
        volunteerName: 'Tanvir Hasan',
        userName: 'Sabrina Islam',
        incidentNumber: 211,
        timeLabel: 'Yesterday · 4:00 PM',
        points: 25,
        status: 'COMPLETED',
    },
    {
        id: 'act-405',
        type: 'ALERT',
        volunteerName: 'Ayesha Rahman',
        userName: 'Fatima Rahman',
        incidentNumber: 209,
        timeLabel: 'Yesterday · 1:20 PM',
        points: 10,
        status: 'ASSIGNED',
    },
];

const MONTHS = ['Apr 2026', 'Mar 2026', 'Feb 2026'] as const;

const LEADERBOARD_BY_MONTH: Record<(typeof MONTHS)[number], LeaderRow[]> = {
    'Apr 2026': [
        { id: 'ldr-1', name: 'Ayesha Rahman', points: 1840, missions: 24, rating: 4.9 },
        { id: 'ldr-2', name: 'Tanvir Hasan', points: 1730, missions: 22, rating: 4.8 },
        { id: 'ldr-3', name: 'Nafisa Khan', points: 1685, missions: 21, rating: 4.8 },
        { id: 'ldr-4', name: 'Shanto Hossain', points: 1520, missions: 20, rating: 4.7 },
        { id: 'ldr-5', name: 'Kabir Alam', points: 1460, missions: 18, rating: 4.7 },
        { id: 'ldr-6', name: 'Raihan Ahmed', points: 1320, missions: 17, rating: 4.6 },
    ],
    'Mar 2026': [
        { id: 'ldr-2', name: 'Tanvir Hasan', points: 1965, missions: 26, rating: 4.9 },
        { id: 'ldr-5', name: 'Kabir Alam', points: 1780, missions: 23, rating: 4.8 },
        { id: 'ldr-4', name: 'Shanto Hossain', points: 1605, missions: 21, rating: 4.7 },
        { id: 'ldr-1', name: 'Ayesha Rahman', points: 1560, missions: 20, rating: 4.7 },
        { id: 'ldr-6', name: 'Raihan Ahmed', points: 1425, missions: 18, rating: 4.6 },
        { id: 'ldr-3', name: 'Nafisa Khan', points: 1380, missions: 17, rating: 4.6 },
    ],
    'Feb 2026': [
        { id: 'ldr-3', name: 'Nafisa Khan', points: 1710, missions: 22, rating: 4.8 },
        { id: 'ldr-1', name: 'Ayesha Rahman', points: 1665, missions: 21, rating: 4.8 },
        { id: 'ldr-6', name: 'Raihan Ahmed', points: 1540, missions: 20, rating: 4.7 },
        { id: 'ldr-4', name: 'Shanto Hossain', points: 1495, missions: 19, rating: 4.7 },
        { id: 'ldr-2', name: 'Tanvir Hasan', points: 1450, missions: 18, rating: 4.6 },
        { id: 'ldr-5', name: 'Kabir Alam', points: 1390, missions: 17, rating: 4.6 },
    ],
};

const CURRENT_USER_ID = 'ldr-4';

const DEFAULT_AVATAR = 'https://i.pravatar.cc/120?img=47&u=shesafe';

const MED = {
    muted: '#A09CB2',
    subtitle: '#C4C1D4',
    stroke: 'rgba(255,255,255,0.1)',
} as const;

const SEGMENTS = ['Activity', 'Leaderboard'] as const;

const statusTone = (status: ActivityStatus) => {
    switch (status) {
        case 'COMPLETED':
            return { fg: T.success, bg: T.safeLight, border: `${T.success}40` };
        case 'ASSIGNED':
            return { fg: T.violet, bg: T.violetDim, border: `${T.violet}40` };
        case 'CANCELLED':
            return { fg: T.danger, bg: T.dangerLight, border: T.dangerBorder };
    }
};

const podiumTone = (rank: number) => {
    switch (rank) {
        case 1:
            return { medal: '🥇', border: '#D9B564' };
        case 2:
            return { medal: '🥈', border: '#B9C0C9' };
        case 3:
            return { medal: '🥉', border: '#C38C5B' };
        default:
            return null;
    }
};


export default function VolunteerActivity() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Activity');
    const [selectedMonth, setSelectedMonth] = useState<(typeof MONTHS)[number]>('Apr 2026');
    const [segmentWidth, setSegmentWidth] = useState(0);
    const indicator = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    useEffect(() => {
        Animated.timing(indicator, {
            toValue: segment === 'Activity' ? 0 : 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [indicator, segment]);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ])
        ).start();
    }, [pulse]);

    const indicatorStyle = useMemo(() => {
        const translateX = indicator.interpolate({
            inputRange: [0, 1],
            outputRange: [0, segmentWidth],
        });
        return { transform: [{ translateX }] };
    }, [indicator, segmentWidth]);

    const activeLeaderboard = LEADERBOARD_BY_MONTH[selectedMonth];
    const currentUserIndex = activeLeaderboard.findIndex(row => row.id === CURRENT_USER_ID);
    const currentUser = currentUserIndex >= 0 ? activeLeaderboard[currentUserIndex] : undefined;
    const currentUserRank = currentUserIndex >= 0 ? currentUserIndex + 1 : undefined;
    const leaderboardRows = activeLeaderboard;

    const onSegmentPress = (next: (typeof SEGMENTS)[number]) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSegment(next);
    };

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.75}
                        accessibilityLabel="Go back to volunteer home"
                        accessibilityRole="button"
                    >
                        <Feather name="chevron-left" size={20} color={T.ink2} />
                    </TouchableOpacity>

                    <View style={s.headerTextWrap}>
                        <Text style={s.eyebrow}>Volunteer</Text>
                        <Text style={s.title}>Activity Center</Text>
                    </View>
                </View>

                <View
                    style={s.segmentWrap}
                    onLayout={event => setSegmentWidth(event.nativeEvent.layout.width / 2)}
                >
                    <Animated.View style={[s.segmentIndicator, indicatorStyle]} />
                    {SEGMENTS.map(label => (
                        <TouchableOpacity
                            key={label}
                            style={s.segmentBtn}
                            activeOpacity={0.7}
                            onPress={() => onSegmentPress(label)}
                        >
                            <Text style={[s.segmentText, segment === label && s.segmentTextActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {segment === 'Activity' ? (
                        <View>
                            <View style={s.sectionHeader}>
                                <Text style={s.sectionTitle}>Recent Actions</Text>
                                <Text style={s.sectionMeta}>{ACTIVITY.length} updates</Text>
                            </View>

                            {ACTIVITY.map((item, index) => {
                                const tone = statusTone(item.status);
                                const isLast = index === ACTIVITY.length - 1;
                                return (
                                    <View key={item.id} style={s.activityRow}>
                                        <View style={s.timelineCol}>
                                            <Animated.View
                                                style={[
                                                    s.timelineDot,
                                                    {
                                                        backgroundColor: tone.fg, opacity: pulse.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [0.7, 1],
                                                        })
                                                    },
                                                ]}
                                            />
                                            {!isLast && <View style={s.timelineLine} />}
                                        </View>
                                        <View style={s.activityCard}>
                                            <View style={s.activityTop}>
                                                <View style={s.profileWrap}>
                                                    <Image source={{ uri: DEFAULT_AVATAR }} style={s.profileAvatar} />
                                                </View>
                                                <View style={[s.statusIcon, { borderColor: tone.border, backgroundColor: tone.bg }]}
                                                >
                                                    <Feather name="arrow-right" size={14} color={tone.fg} />
                                                </View>
                                                <View style={s.profileWrapRight}>
                                                    <Image source={{ uri: DEFAULT_AVATAR }} style={s.profileAvatar} />
                                                </View>
                                                <View style={[s.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                                                    <Text style={[s.statusText, { color: tone.fg }]}>{item.status}</Text>
                                                </View>
                                            </View>
                                            <View style={s.activityInfo}>
                                                <Text style={s.activityTitle}>
                                                    Volunteer {item.volunteerName} assisted {item.userName} · Incident #{item.incidentNumber}
                                                </Text>
                                            </View>
                                            <View style={s.activityFooter}>
                                                <Text style={s.activityTime}>{item.timeLabel}</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View>
                            <View style={s.sectionHeader}>
                                <Text style={s.sectionTitle}>Top Responders</Text>
                                <Text style={s.sectionMeta}>Leaderboard</Text>
                            </View>

                            <RNScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={s.monthRow}
                            >
                                {MONTHS.map(month => {
                                    const isActive = month === selectedMonth;
                                    return (
                                        <TouchableOpacity
                                            key={month}
                                            style={[s.monthChip, isActive && s.monthChipActive]}
                                            onPress={() => setSelectedMonth(month)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[s.monthText, isActive && s.monthTextActive]}>{month}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </RNScrollView>

                            {currentUser && (
                                <Animated.View style={[s.currentUserCard, {
                                    opacity: pulse.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.88, 1],
                                    })
                                }]}>
                                    <View style={s.currentUserAvatarWrap}>
                                        <Image source={{ uri: DEFAULT_AVATAR }} style={s.currentUserAvatar} />
                                    </View>
                                    <View style={s.currentUserBody}>
                                        <Text style={s.currentUserTitle}>Your Rank</Text>
                                        <View style={s.currentUserNameRow}>
                                            <Text style={s.currentUserName}>{currentUser.name}</Text>
                                            <View style={s.currentUserStatsInline}>
                                                <Text style={s.currentUserRank}>#{currentUserRank}</Text>
                                                <Text style={s.currentUserPoints}>{currentUser.points} pts</Text>
                                            </View>
                                        </View>
                                        <Text style={s.currentUserMeta}>
                                            Overall rating {currentUser.rating.toFixed(1)} · {currentUser.missions} people helped
                                        </Text>
                                    </View>
                                </Animated.View>
                            )}

                            {leaderboardRows.map((row, index) => {
                                const rank = index + 1;
                                const isTop3 = rank <= 3;
                                const isCurrentUser = row.id === CURRENT_USER_ID;
                                const podium = isTop3 ? podiumTone(rank) : null;
                                return (
                                    <View
                                        key={row.id}
                                        style={[
                                            s.leaderRow,
                                            isTop3 && s.leaderRowTop,
                                            isTop3 && podium && { borderLeftColor: podium.border },
                                            isCurrentUser && s.leaderRowCurrent,
                                        ]}
                                    >
                                        <View style={[s.rankBadge, isTop3 && s.rankBadgeTop, isCurrentUser && s.rankBadgeCurrent]}>
                                            {isTop3 && podium ? (
                                                <View style={s.rankBadgePodium}>
                                                    <Text style={s.rankMedal}>{podium.medal}</Text>
                                                    <Text style={[s.rankText, s.rankTextTop]}>{rank}</Text>
                                                </View>
                                            ) : (
                                                <Text style={s.rankText}>{rank}</Text>
                                            )}
                                        </View>
                                        <View style={s.leaderMain}>
                                            <Text style={s.leaderName}>{row.name}</Text>
                                            <Text style={s.leaderMeta}>
                                                Overall rating {row.rating.toFixed(1)} · {row.missions} people helped
                                            </Text>
                                        </View>
                                        <Text style={s.leaderPoints}>{row.points} pts</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            </View>
        </AtmosphericShell>
    );
}

const s = StyleSheet.create({
    root: { flex: 1 },

    header: {
        paddingHorizontal: 20,
        paddingBottom: 18,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: MED.stroke,
        backgroundColor: 'transparent',
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.lineMid,
        backgroundColor: T.surfaceCard,
        marginRight: 12,
    },
    headerTextWrap: {
        flex: 1,
    },
    eyebrow: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink4,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: -0.3,
        marginTop: 6,
    },

    segmentWrap: {
        marginHorizontal: 20,
        marginBottom: 18,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.pill,
        borderWidth: 1,
        borderColor: T.lineMid,
        flexDirection: 'row',
        position: 'relative',
        overflow: 'hidden',
    },
    segmentIndicator: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        width: '50%',
        borderRadius: R.pill,
        backgroundColor: T.surfaceBulkyActive,
        borderWidth: 1,
        borderColor: `${T.violet}55`,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink4,
    },
    segmentTextActive: { color: T.ink },

    scroll: { paddingHorizontal: 20 },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: MED.muted,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    sectionMeta: {
        fontSize: 11,
        fontWeight: '600',
        color: T.ink4,
    },
    monthRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
        paddingRight: 12,
    },
    monthChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: R.pill,
        borderWidth: 1,
        borderColor: MED.stroke,
        backgroundColor: T.surfaceBulky,
    },
    monthChipActive: {
        backgroundColor: T.violet,
        borderColor: T.violet,
    },
    monthText: {
        fontSize: 12,
        fontWeight: '600',
        color: MED.muted,
    },
    monthTextActive: { color: T.onPrimary },

    activityRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    timelineCol: { width: 18, alignItems: 'center' },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 12,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: T.lineMid,
        marginTop: 6,
    },
    activityCard: {
        flex: 1,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        padding: 14,
    },
    activityTop: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    statusIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityInfo: {
        marginTop: 12,
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    profileWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${T.violet}40`,
        backgroundColor: T.violetDim,
        overflow: 'hidden',
    },
    profileWrapRight: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${T.accent}40`,
        backgroundColor: T.accentLight,
        overflow: 'hidden',
    },
    profileAvatar: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    activityTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: R.pill,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    activityFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    activityTime: {
        fontSize: 11,
        color: T.ink4,
    },

    leaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        backgroundColor: T.surfaceBulky,
        marginBottom: 12,
    },
    leaderRowTop: {
        backgroundColor: T.surfaceBulkyActive,
        borderColor: `${T.accent}55`,
        borderLeftWidth: 3,
    },
    leaderRowCurrent: {
        borderColor: `${T.violet}70`,
        backgroundColor: T.surfaceBulkyActive,
    },
    currentUserCard: {
        backgroundColor: T.surfaceBulkyActive,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: `${T.violet}55`,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        shadowColor: T.violet,
        shadowOpacity: 0.25,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    currentUserAvatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: `${T.violet}55`,
        backgroundColor: T.violetDim,
        overflow: 'hidden',
    },
    currentUserAvatar: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    currentUserBody: {
        flex: 1,
    },
    currentUserTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink4,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    currentUserRank: {
        fontSize: 13,
        fontWeight: '800',
        color: T.ink,
    },
    currentUserName: {
        fontSize: 16,
        fontWeight: '700',
        color: T.ink,
        flexShrink: 1,
        marginRight: 12,
    },
    currentUserNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    currentUserStatsInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'flex-end',
    },
    currentUserPoints: {
        fontSize: 16,
        fontWeight: '800',
        color: T.accent,
    },
    currentUserMeta: {
        fontSize: 12,
        color: T.ink4,
        marginTop: 8,
    },
    rankBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.surfaceMid,
    },
    rankBadgeTop: {
        backgroundColor: T.accentLight,
        borderWidth: 1,
        borderColor: `${T.accent}55`,
    },
    rankBadgeCurrent: {
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}55`,
    },
    rankText: {
        fontSize: 12,
        fontWeight: '700',
        color: T.ink3,
    },
    rankTextTop: { color: T.accent },
    rankBadgePodium: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankMedal: {
        fontSize: 14,
        marginBottom: 2,
    },
    leaderMain: { flex: 1 },
    leaderName: {
        fontSize: 14,
        fontWeight: '700',
        color: T.ink,
    },
    leaderMeta: {
        fontSize: 12,
        color: T.ink4,
        marginTop: 4,
    },
    leaderPoints: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink2,
        minWidth: 72,
        textAlign: 'right',
    },
});
