import type { MapViewProps } from 'react-native-maps';

export type MapStyleMode = 'currentDark' | 'compatibleDark' | 'standard';
export type MapStyle = NonNullable<MapViewProps['customMapStyle']>;

export const mapStyleModes: MapStyleMode[] = ['currentDark', 'compatibleDark', 'standard'];

export const currentDarkMapStyle: MapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0A0A0C' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7A8D' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0C' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a0d' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1C2333' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0A0A0C' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5a6a7a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e2530' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2C3E58' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1f2a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8090a8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07070A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a4060' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0a0f1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1f2a' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#4a5a70' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#6a7a90' }] },
];

export const compatibleDarkMapStyle: MapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#07111F' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A8B0C0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#07111F' }, { weight: 2 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1A2638' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#8F98A8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#B5BDCB' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0A1220' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#07111F' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0D1828' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#768295' }] },
  { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', elementType: 'geometry', stylers: [{ color: '#10223A' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0D2A22' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#7FA494' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2D405A' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1A2638' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9AA5B5' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#07111F' }, { weight: 2 }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#334B68' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#1B2A3F' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#415B78' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#22324A' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#C4CBD6' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#26384F' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#8390A2' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#152238' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#7D88A0' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#061426' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6E8AA8' }] },
];

export const standardFallbackStyle: MapStyle = [];

export function resolveMapStyle(mode: MapStyleMode, currentStyle?: MapStyle): MapStyle {
  if (mode === 'standard') return standardFallbackStyle;
  if (mode === 'currentDark') return currentStyle?.length ? currentStyle : currentDarkMapStyle;
  return compatibleDarkMapStyle;
}
