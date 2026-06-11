import React, { useState, type ComponentProps } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, R, S } from '../src/constants/theme';
import AICopilotWorkspace, { type AICopilotMode } from './AICopilotWorkspace';

const COPILOT_ICON = require('../assets/images/aicopiloticon.png');

export type AICopilotRole = 'standard' | 'volunteer';

type Props = {
  visible: boolean;
  onClose: () => void;
  role?: AICopilotRole;
  incidentId?: string | number | null;
};

type FeatureItem = {
  title: string;
  description: string;
  icon: ComponentProps<typeof Feather>['name'];
  mode: AICopilotMode;
};

const EMERGENCY_FEATURES: FeatureItem[] = [
  {
    title: 'AI Incident Summary',
    description: 'Summarize an active or past incident using incident data and chat.',
    icon: 'file-text',
    mode: 'incident_summary',
  },
  {
    title: 'Area Safety Brief',
    description: 'Understand nearby red/yellow zone risk.',
    icon: 'shield',
    mode: 'area_safety',
  },
  {
    title: 'Route Safety Check',
    description: 'Check risky zones between your current location and destination.',
    icon: 'navigation',
    mode: 'route_risk',
  },
  {
    title: 'Volunteer Guidance',
    description: 'Safe response tips for active SOS situations.',
    icon: 'users',
    mode: 'volunteer_guidance',
  },
];

const MEDICAL_FEATURES: FeatureItem[] = [
  {
    title: 'First Aid Guide',
    description: 'Quick first-aid help for emergency situations.',
    icon: 'heart',
    mode: 'first_aid',
  },
];

function FeatureRow({ item, onPress }: { item: FeatureItem; onPress: (mode: AICopilotMode) => void }) {
  return (
    <TouchableOpacity style={st.featureRow} activeOpacity={0.78} onPress={() => onPress(item.mode)}>
      <View style={st.featureIcon}>
        <Feather name={item.icon} size={16} color={T.violetLight} />
      </View>
      <View style={st.featureCopy}>
        <Text style={st.featureTitle}>{item.title}</Text>
        <Text style={st.featureText}>{item.description}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={T.ink4} />
    </TouchableOpacity>
  );
}

function FeatureSection({ title, items, onFeaturePress }: { title: string; items: FeatureItem[]; onFeaturePress: (mode: AICopilotMode) => void }) {
  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>{title}</Text>
      <View style={st.sectionCard}>
        {items.map((item, index) => (
          <View key={item.title}>
            <FeatureRow item={item} onPress={onFeaturePress} />
            {index < items.length - 1 && <View style={st.divider} />}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AICopilotSheet({ visible, onClose, incidentId }: Props) {
  const insets = useSafeAreaInsets();
  const [workspaceMode, setWorkspaceMode] = useState<AICopilotMode | null>(null);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={st.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 10) + 12 }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.035)', 'rgba(30,21,58,0.92)', 'rgba(10,6,20,0.98)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={st.grabber} />

            <View style={st.header}>
              <View style={st.titleIconWrap}>
                <Image source={COPILOT_ICON} style={st.titleIcon} resizeMode="contain" />
              </View>
              <View style={st.titleCopy}>
                <Text style={st.title}>SheSafe AI Safety Copilot</Text>
                <Text style={st.subtitle}>
                  Smart emergency guidance, area risk awareness, volunteer support, and first-aid help.
                </Text>
              </View>
              <TouchableOpacity
                style={st.closeBtn}
                activeOpacity={0.78}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close AI Safety Copilot"
              >
                <Feather name="x" size={18} color={T.ink2} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={st.body}
              contentContainerStyle={st.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FeatureSection
                title="Emergency Safety"
                items={EMERGENCY_FEATURES}
                onFeaturePress={setWorkspaceMode}
              />
              <FeatureSection
                title="Medical Safety"
                items={MEDICAL_FEATURES}
                onFeaturePress={setWorkspaceMode}
              />

              <View style={st.footerNote}>
                <Feather name="shield" size={14} color={T.ink3} />
                <Text style={st.footerNoteText}>Guidance only · Use SOS if you feel unsafe</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {workspaceMode && (
        <AICopilotWorkspace
          visible={!!workspaceMode}
          mode={workspaceMode}
          incidentId={incidentId}
          onClose={() => setWorkspaceMode(null)}
        />
      )}
    </>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: T.surfaceBulky,
    ...Platform.select({
      ios: {
        shadowColor: '#8A38F6',
        shadowOpacity: 0.14,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -8 },
      },
      android: {
        elevation: 16,
      },
    }),
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s3,
    paddingHorizontal: S.s4,
    paddingBottom: S.s3,
  },
  titleIconWrap: {
    width: 50,
    height: 50,
    borderRadius: R.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  titleIcon: {
    width: 38,
    height: 38,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: 'rgba(245,245,247,0.64)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: R.hBtn,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: S.s4,
    paddingBottom: S.s2,
  },
  section: {
    marginTop: S.s3,
  },
  sectionTitle: {
    marginBottom: S.s2,
    fontSize: 11,
    fontWeight: '900',
    color: T.violetLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionCard: {
    borderRadius: R.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.052)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  featureRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s3,
    paddingHorizontal: S.s3,
    paddingVertical: 10,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,56,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.22)',
  },
  featureCopy: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: 0,
  },
  featureText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: T.ink3,
  },
  divider: {
    height: 1,
    marginLeft: 58,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  footerNote: {
    marginTop: S.s4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s2,
    alignSelf: 'center',
    borderRadius: R.pill,
    paddingHorizontal: S.s3,
    paddingVertical: S.s2,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  footerNoteText: {
    color: 'rgba(245,245,247,0.62)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
});
