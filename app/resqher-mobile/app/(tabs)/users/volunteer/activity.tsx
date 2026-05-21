import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    Animated,
    LayoutAnimation,
    Platform,
    UIManager,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import {
    incidentService,
    type VolunteerActivityLog,
    type VolunteerLeaderboardRow,
} from '../../../../src/services/incidentService';

const MED = {
    muted: '#A09CB2',
    stroke: 'rgba(255,255,255,0.1)',
} as const;

const SEGMENTS = ['Activity', 'Leaderboard'] as const;

const statusTone = (status: string) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'RESOLVED') {
        return { fg: T.success, bg: T.safeLight, border: `${T.success}40`, label: 'Resolved' };
    }
    if (normalized === 'CANCELLED') {
        return { fg: T.danger, bg: T.dangerLight, border: T.dangerBorder, label: 'Cancelled' };
    }
    return { fg: T.violet, bg: T.violetDim, border: `${T.violet}40`, label: 'Active' };
};

const formatTime = (value?: string | null) => {
    if (!value) return 'Recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const ratingLabel = (row: VolunteerLeaderboardRow) => {
    if (!row.ratingCount) return 'No ratings yet';
    return `Overall rating ${row.averageRating.toFixed(1)} · ${row.ratingCount} review${row.ratingCount === 1 ? '' : 's'}`;
};

export default function VolunteerActivity() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Activity');
    const [segmentWidth, setSegmentWidth] = useState(0);
    const [activities, setActivities] = useState<VolunteerActivityLog[]>([]);
    const [leaderboard, setLeaderboard] = useState<VolunteerLeaderboardRow[]>([]);
    const [currentUser, setCurrentUser] = useState<VolunteerLeaderboardRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const indicator = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;

    const loadData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
        if (mode === 'initial') setLoading(true);
        if (mode === 'refresh') setRefreshing(true);
        try {
            const [activityRows, leaderboardData] = await Promise.all([
                incidentService.getVolunteerActivity(),
                incidentService.getVolunteerLeaderboard(),
            ]);
            setActivities(activityRows);
            setLeaderboard(leaderboardData.rankings);
            setCurrentUser(leaderboardData.me);
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Unable to load volunteer activity.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        loadData();
    }, [loadData]);

    useEffect(() => {
        Animated.timing(indicator, {
            toValue: segment === 'Activity' ? 0 : 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [indicator, segment]);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    const indicatorStyle = useMemo(() => {
        const translateX = indicator.interpolate({
            inputRange: [0, 1],
            outputRange: [0, segmentWidth],
        });
        return { transform: [{ translateX }] };
    }, [indicator, segmentWidth]);

    const onSegmentPress = (next: (typeof SEGMENTS)[number]) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSegment(next);
    };

    const retry = () => loadData('initial');

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
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadData('refresh')}
                            tintColor={T.violet}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View style={s.stateCard}>
                            <ActivityIndicator color={T.violet} />
                            <Text style={s.stateTitle}>Loading real activity</Text>
                            <Text style={s.stateText}>Fetching your assisted incidents and responder ranking.</Text>
                        </View>
                    ) : error ? (
                        <View style={s.stateCard}>
                            <Feather name="alert-circle" size={24} color={T.danger} />
                            <Text style={s.stateTitle}>Could not load activity</Text>
                            <Text style={s.stateText}>{error}</Text>
                            <TouchableOpacity style={s.retryBtn} onPress={retry} activeOpacity={0.8}>
                                <Text style={s.retryText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : segment === 'Activity' ? (
                        <View>
                            <View style={s.sectionHeader}>
                                <Text style={s.sectionTitle}>Recent Actions</Text>
                                <Text style={s.sectionMeta}>{activities.length} updates</Text>
                            </View>

                            {!activities.length ? (
                                <View style={s.stateCard}>
                                    <Feather name="clock" size={24} color={T.ink4} />
                                    <Text style={s.stateTitle}>No activity yet</Text>
                                    <Text style={s.stateText}>Assisted incidents will appear here after you accept an SOS.</Text>
                                </View>
                            ) : activities.map((item, index) => {
                                const tone = statusTone(item.status);
                                const isLast = index === activities.length - 1;
                                const happenedAt = item.resolvedAt || item.cancelledAt || item.updatedAt || item.createdAt;
                                return (
                                    <View key={item.id} style={s.activityRow}>
                                        <View style={s.timelineCol}>
                                            <Animated.View
                                                style={[
                                                    s.timelineDot,
                                                    {
                                                        backgroundColor: tone.fg,
                                                        opacity: pulse.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [0.7, 1],
                                                        }),
                                                    },
                                                ]}
                                            />
                                            {!isLast && <View style={s.timelineLine} />}
                                        </View>
                                        <View style={s.activityCard}>
                                            <View style={s.activityTop}>
                                                <UserAvatar uri={item.volunteer.photoUri} size={40} style={s.profileAvatar} />
                                                <View style={[s.statusIcon, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                                                    <Feather name="arrow-right" size={14} color={tone.fg} />
                                                </View>
                                                <UserAvatar
                                                    uri={item.victim.photoUri}
                                                    size={40}
                                                    style={[s.profileAvatar, { borderColor: `${T.accent}40` }]}
                                                    iconColor={T.accent}
                                                    backgroundColor={T.accentLight}
                                                />
                                                <View style={[s.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                                                    <Text style={[s.statusText, { color: tone.fg }]}>{tone.label}</Text>
                                                </View>
                                            </View>
                                            <View style={s.activityInfo}>
                                                <Text style={s.activityTitle}>
                                                    {item.volunteer.name} assisted {item.victim.name} in Incident #{item.incidentId}
                                                </Text>
                                            </View>
                                            <View style={s.activityFooter}>
                                                <Text style={s.activityTime}>{formatTime(happenedAt)}</Text>
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
                                <Text style={s.sectionMeta}>All time</Text>
                            </View>

                            {currentUser && (
                                <Animated.View style={[s.currentUserCard, {
                                    opacity: pulse.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.88, 1],
                                    }),
                                }]}>
                                    <UserAvatar uri={currentUser.photoUri} size={44} style={s.currentUserAvatar} />
                                    <View style={s.currentUserBody}>
                                        <Text style={s.currentUserTitle}>Your Rank</Text>
                                        <View style={s.currentUserNameRow}>
                                            <Text style={s.currentUserName}>{currentUser.name}</Text>
                                            <View style={s.currentUserStatsInline}>
                                                <Text style={s.currentUserRank}>#{currentUser.rank}</Text>
                                                <Text style={s.currentUserPoints}>{currentUser.points} pts</Text>
                                            </View>
                                        </View>
                                        <Text style={s.currentUserMeta}>
                                            {ratingLabel(currentUser)} · {currentUser.assistedIncidentCount} helped · {currentUser.resolvedIncidentCount} resolved
                                        </Text>
                                    </View>
                                </Animated.View>
                            )}

                            {!leaderboard.length ? (
                                <View style={s.stateCard}>
                                    <Feather name="award" size={24} color={T.ink4} />
                                    <Text style={s.stateTitle}>No rankings yet</Text>
                                    <Text style={s.stateText}>Resolved assisted incidents will build the leaderboard.</Text>
                                </View>
                            ) : leaderboard.map((row) => {
                                const isTop3 = row.rank <= 3;
                                const isCurrentUser = currentUser?.id === row.id;
                                return (
                                    <View
                                        key={row.id}
                                        style={[
                                            s.leaderRow,
                                            isTop3 && s.leaderRowTop,
                                            isCurrentUser && s.leaderRowCurrent,
                                        ]}
                                    >
                                        <View style={[s.rankBadge, isTop3 && s.rankBadgeTop, isCurrentUser && s.rankBadgeCurrent]}>
                                            <Text style={[s.rankText, isTop3 && s.rankTextTop]}>{row.rank}</Text>
                                        </View>
                                        <UserAvatar uri={row.photoUri} size={38} style={s.leaderAvatar} />
                                        <View style={s.leaderMain}>
                                            <Text style={s.leaderName}>{row.name}</Text>
                                            <Text style={s.leaderMeta}>
                                                {ratingLabel(row)} · {row.assistedIncidentCount} helped
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
    headerTextWrap: { flex: 1 },
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

    stateCard: {
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        backgroundColor: T.surfaceBulky,
        padding: 18,
        alignItems: 'center',
        gap: 8,
    },
    stateTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: T.ink,
    },
    stateText: {
        fontSize: 12,
        color: T.ink4,
        textAlign: 'center',
        lineHeight: 18,
    },
    retryBtn: {
        marginTop: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: R.pill,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}55`,
    },
    retryText: { color: T.violet, fontWeight: '800', fontSize: 12 },

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
    profileAvatar: {
        borderWidth: 1,
        borderColor: `${T.violet}40`,
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
    activityTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: T.ink,
    },
    statusPill: {
        marginLeft: 'auto',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: R.pill,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
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
    currentUserAvatar: {
        borderWidth: 1,
        borderColor: `${T.violet}55`,
    },
    currentUserBody: { flex: 1 },
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
        lineHeight: 17,
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
    leaderAvatar: {
        borderWidth: 1,
        borderColor: T.lineMid,
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
        lineHeight: 16,
    },
    leaderPoints: {
        fontSize: 13,
        fontWeight: '800',
        color: T.accent,
    },
});
