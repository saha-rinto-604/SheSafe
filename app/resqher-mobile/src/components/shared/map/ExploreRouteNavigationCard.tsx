import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { T, R, S } from '../../../constants/theme';

export type ExploreRouteStep = {
  instruction: string;
  distance: string;
  maneuver?: string;
};

export function getExploreManeuverIcon(maneuver?: string): string {
  if (!maneuver) return 'arrow-up';
  const m = maneuver.toLowerCase();
  if (m.includes('uturn')) return 'return-up-back';
  if (m.includes('left')) return 'arrow-back';
  if (m.includes('right')) return 'arrow-forward';
  if (m.includes('merge')) return 'git-merge';
  if (m.includes('roundabout')) return 'sync';
  if (m.includes('fork')) return 'git-branch';
  return 'arrow-up';
}

type Props = {
  bottom: number;
  loading?: boolean;
  step?: ExploreRouteStep | null;
  currentStepIndex: number;
  stepCount: number;
  isLive: boolean;
  isReviewMode: boolean;
  goLiveDisabled?: boolean;
  fallbackInstruction: string;
  fallbackDistance: string;
  routeError?: string | null;
  warningText?: string | null;
  warningColor?: string;
  footerLeadingAction?: React.ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  onGoLive: () => void;
  onToggleReview: () => void;
  onExitLive: () => void;
};

export default function ExploreRouteNavigationCard({
  bottom,
  loading = false,
  step,
  currentStepIndex,
  stepCount,
  isLive,
  isReviewMode,
  goLiveDisabled = false,
  fallbackInstruction,
  fallbackDistance,
  routeError,
  warningText,
  warningColor = '#E25B3A',
  footerLeadingAction,
  onPrevious,
  onNext,
  onGoLive,
  onToggleReview,
  onExitLive,
}: Props) {
  const instruction = step?.instruction || fallbackInstruction;
  const distance = step?.distance || fallbackDistance;

  return (
    <View style={[ns.cardWrap, { bottom }]}>
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={ns.cardTint} pointerEvents="none" />
      {loading ? (
        <View style={ns.loadingBody}>
          <ActivityIndicator color={T.violet} />
        </View>
      ) : (
        <>
          {!!warningText && (
            <View style={ns.warningBadge}>
              <Ionicons name="warning" size={12} color={warningColor} style={{ marginRight: 4 }} />
              <Text style={[ns.warningBadgeText, { color: warningColor }]}>{warningText}</Text>
            </View>
          )}
          <View style={ns.cardBody}>
            <View style={ns.iconWrap}>
              <Ionicons
                name={getExploreManeuverIcon(step?.maneuver) as any}
                size={22}
                color={T.violet}
              />
            </View>
            <View style={ns.textWrap}>
              <Text style={ns.instrText} numberOfLines={2}>{instruction}</Text>
              <Text style={ns.distText}>{distance}</Text>
              {!!routeError && <Text style={ns.routeError}>{routeError}</Text>}
            </View>
          </View>
          <View style={ns.cardFooter}>
            <Text style={ns.stepCounter}>
              {stepCount > 0 ? `Step ${currentStepIndex + 1} of ${stepCount}` : 'Live route tracking'}
            </Text>
            {!isLive ? (
              <View style={ns.footerButtons}>
                {footerLeadingAction}
                {currentStepIndex > 0 && (
                  <TouchableOpacity style={ns.navBtn} onPress={onPrevious} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={16} color={T.ink2} />
                  </TouchableOpacity>
                )}
                {currentStepIndex < stepCount - 1 && (
                  <TouchableOpacity style={ns.navBtn} onPress={onNext} activeOpacity={0.7}>
                    <Ionicons name="chevron-forward" size={16} color={T.ink2} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[ns.goLiveBtn, goLiveDisabled && ns.disabledBtn]}
                  disabled={goLiveDisabled}
                  onPress={onGoLive}
                  activeOpacity={0.7}
                >
                  <Ionicons name="navigate" size={12} color={T.onPrimary} style={{ marginRight: 4 }} />
                  <Text style={ns.goLiveBtnText}>GO LIVE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ns.goLiveBtn, ns.reviewBtn]}
                  onPress={onToggleReview}
                  activeOpacity={0.7}
                >
                  <Ionicons name="list" size={14} color={T.violet} style={{ marginRight: 4 }} />
                  <Text style={[ns.goLiveBtnText, { color: T.violet }]}>{isReviewMode ? 'CLOSE' : 'REVIEW'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={ns.endLiveBtn} onPress={onExitLive} activeOpacity={0.7}>
                <Text style={ns.endLiveBtnText}>Exit Live Mode</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const ns = StyleSheet.create({
  cardWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: R.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 260,
    ...Platform.select({
      ios: { shadowColor: '#8A38F6', shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 10 },
    }),
  },
  cardTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,10,18,0.88)' },
  loadingBody: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingTop: S.s4, paddingBottom: S.s2, gap: S.s3 },
  iconWrap: { width: 44, height: 44, borderRadius: R.sm, backgroundColor: T.violetDim, borderWidth: 1, borderColor: `${T.violet}35`, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  instrText: { fontSize: 14, fontWeight: '700', color: T.ink, letterSpacing: 0, lineHeight: 20 },
  distText: { fontSize: 12, fontWeight: '600', color: T.ink3, marginTop: 2 },
  routeError: { fontSize: 11, color: T.gold, fontWeight: '700', marginTop: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.s4, paddingBottom: S.s3, paddingTop: S.s2 },
  stepCounter: { fontSize: 11, fontWeight: '600', color: T.ink4, letterSpacing: 0.4 },
  footerButtons: { flexDirection: 'row', gap: 8, alignItems: 'center', flexShrink: 1 },
  navBtn: { width: 32, height: 32, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 32, borderRadius: R.pill, backgroundColor: T.violet, borderWidth: 1, borderColor: `${T.violet}70` },
  reviewBtn: { backgroundColor: 'rgba(138,56,246,0.15)', borderColor: 'rgba(138,56,246,0.3)' },
  disabledBtn: { opacity: 0.52 },
  goLiveBtnText: { fontSize: 11, fontWeight: '700', color: T.onPrimary, letterSpacing: 0.2 },
  endLiveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  endLiveBtnText: { fontSize: 11, fontWeight: '700', color: T.onPrimary, letterSpacing: 0.2 },
  warningBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s4, paddingTop: S.s2, paddingBottom: 2 },
  warningBadgeText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
});
