import React from 'react';
import { View } from 'react-native';

export const PROVIDER_GOOGLE = 'google';

export type MapViewRef = any;

const MapViewCompatWeb = React.forwardRef<any, any>(function MapViewCompatWeb(props, ref) {
  return <View ref={ref} {...props} />;
});

export default MapViewCompatWeb;

export const Marker: React.ComponentType<any> = function Marker() {
  return null;
};

export const Polyline: React.ComponentType<any> = function Polyline() {
  return null;
};

export const Circle: React.ComponentType<any> = function Circle() {
  return null;
};
