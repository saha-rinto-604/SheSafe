import React from 'react';
import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

const LOGO_SOURCE = require('../../assets/images/SheSafe_logo.png');

export default function SheSafeMark({ size = 64, style }: Props) {
  return (
    <Image
      source={LOGO_SOURCE}
      style={[styles.logo, { width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    borderRadius: 999,
  },
});
