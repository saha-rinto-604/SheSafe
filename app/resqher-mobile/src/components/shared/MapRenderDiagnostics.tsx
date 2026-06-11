import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import type { MapViewProps } from 'react-native-maps';

type LatLngLike = {
  latitude?: number | null;
  longitude?: number | null;
} | null | undefined;

type OverlayState = Record<string, boolean | number | string | null | undefined>;

type Options = {
  screenName: string;
  location?: LatLngLike;
  hasKnownLocation?: boolean;
  regionSource?: string;
  overlayState?: OverlayState;
  timeoutMs?: number;
  onReady?: () => void;
  onLoaded?: () => void;
  onRetry?: () => void;
};

const DEFAULT_TIMEOUT_MS = 6500;
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

function hasUsableLocation(location: LatLngLike) {
  return (
    typeof location?.latitude === 'number'
    && Number.isFinite(location.latitude)
    && typeof location?.longitude === 'number'
    && Number.isFinite(location.longitude)
  );
}

export function useMapRenderDiagnostics({
  screenName,
  location,
  hasKnownLocation,
  regionSource = 'fallback',
  overlayState,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onReady,
  onLoaded,
  onRetry,
}: Options) {
  const [mapKey, setMapKey] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const locationAvailable = hasKnownLocation ?? hasUsableLocation(location);

  const onMapReady = useCallback(() => {
    if (isDev) console.log(`[${screenName}] onMapReady fired`);
    setMapReady(true);
    onReady?.();
  }, [onReady, screenName]);

  const onMapLoaded = useCallback<NonNullable<MapViewProps['onMapLoaded']>>((event) => {
    if (isDev) console.log(`[${screenName}] onMapLoaded fired`);
    setMapLoaded(true);
    onLoaded?.();
  }, [onLoaded, screenName]);

  const onMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
    if (isDev) {
      console.log(`[${screenName}] MapView layout`, { width, height });
    }
  }, [screenName]);

  const retryMap = useCallback(() => {
    if (isDev) console.log(`[${screenName}] retrying MapView renderer`);
    setMapReady(false);
    setMapLoaded(false);
    onRetry?.();
    setMapKey(key => key + 1);
  }, [onRetry, screenName]);

  useEffect(() => {
    if (mapLoaded || !locationAvailable) return undefined;
    const timer = setTimeout(() => {
      if (isDev) {
        console.log(`[${screenName}] MapView did not report onMapLoaded after ${timeoutMs}ms`, {
          layout,
          location,
          mapReady,
          regionSource,
          overlayState,
          rendererDebug:
            'Automatic style/renderer fallback is managed by MapViewCompat. In dev use globalThis.__SHESAFE_MAP_RENDERER_DEBUG__.setRenderer("default"|"LEGACY"|"LATEST") or setStyle("compatibleDark"|"currentDark"|"standard").',
        });
      }
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [layout, location, locationAvailable, mapKey, mapLoaded, mapReady, overlayState, regionSource, screenName, timeoutMs]);

  useEffect(() => {
    if (!isDev) return;
    console.log(`[${screenName}] rendering MapView`, {
      mapKey,
      mapReady,
      mapLoaded,
      regionSource,
      location,
      layout,
      overlayState,
    });
  }, [layout, location, mapKey, mapLoaded, mapReady, overlayState, regionSource, screenName]);

  return useMemo(() => ({
    mapKey,
    mapReady,
    mapLoaded,
    onMapReady,
    onMapLoaded,
    onMapLayout,
    retryMap,
  }), [mapKey, mapLoaded, mapReady, onMapLayout, onMapLoaded, onMapReady, retryMap]);
}
