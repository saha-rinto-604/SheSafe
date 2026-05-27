import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from '../constants/theme';

type Props = {
  size?: number;
  center?: boolean;
  showSubtitle?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function SheSafeLogo({ size = 34, center = false, showSubtitle = false, style }: Props) {
  const lineHeight = Math.round(size * 1.14);

  return (
    <View style={[styles.wrap, center && styles.center, style]}>
      <Text
        style={[
          styles.logo,
          {
            fontSize: size,
            lineHeight,
          },
        ]}
        maxFontSizeMultiplier={1.1}
      >
        <Text style={styles.she}>She</Text>
        <Text style={styles.safe}>Safe</Text>
      </Text>
      {showSubtitle && <Text style={styles.subtitle}>Emergency Assistance Platform</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  center: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  logo: {
    fontWeight: '900',
    letterSpacing: 0,
    includeFontPadding: false,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'sans-serif-medium' },
      web: { fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' } as any,
    }),
  },
  she: {
    color: T.violetLight,
  },
  safe: {
    color: T.ink,
  },
  subtitle: {
    marginTop: 3,
    color: T.ink4,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
  },
});
