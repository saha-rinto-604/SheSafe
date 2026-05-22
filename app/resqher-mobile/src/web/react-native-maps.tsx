import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type MapProps = { style?: any; children?: React.ReactNode };

const MapView = ({ style, children }: MapProps) => (
  <View style={[styles.map, style]}>
    <Text style={styles.text}>Map preview is unavailable on web.</Text>
    {children}
  </View>
);

const Marker = () => null;
const Polyline = () => null;
const Circle = () => null;
const PROVIDER_GOOGLE = undefined;

export default MapView;
export { Marker, Polyline, Circle, PROVIDER_GOOGLE };

const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0A0A0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
});
