import React from 'react';
import { View } from 'react-native';

export const PROVIDER_GOOGLE = 'google';

export type MapViewRef = any;

const MapViewCompat = React.forwardRef<any, any>(function MapViewCompat(props, ref) {
  return <View ref={ref} {...props} />;
});

export default MapViewCompat;

export const Marker: React.ComponentType<any> = function Marker() {
  return null;
};

export const Polyline: React.ComponentType<any> = function Polyline() {
  return null;
};

export const Circle: React.ComponentType<any> = function Circle() {
  return null;
};
