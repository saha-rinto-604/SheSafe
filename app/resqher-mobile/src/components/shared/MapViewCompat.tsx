import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import RNMapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapViewProps,
} from 'react-native-maps';
import {
  compatibleDarkMapStyle,
  mapStyleModes,
  resolveMapStyle,
  type MapStyle,
  type MapStyleMode,
} from './map/mapStyles';

export type MapViewRef = React.ElementRef<typeof RNMapView>;
type GoogleRendererMode = 'default' | 'LEGACY' | 'LATEST';

type CompatMapViewProps = MapViewProps & {
  debugName?: string;
};

type FallbackAttempt = {
  rendererMode: GoogleRendererMode;
  styleMode: MapStyleMode;
};

type InnerMapViewProps = CompatMapViewProps & {
  configuredRendererMode: GoogleRendererMode;
  configuredStyleMode: MapStyleMode;
  currentCustomStyle?: MapStyle;
  forwardedRef: React.ForwardedRef<MapViewRef>;
  globalMapRenderVersion: number;
  hasCustomStyle: boolean;
};

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
const LOAD_TIMEOUT_MS = 6500;
const RENDERER_MODES: GoogleRendererMode[] = ['default', 'LEGACY', 'LATEST'];

let preferredRendererMode: GoogleRendererMode = 'default';
let preferredStyleMode: MapStyleMode = 'compatibleDark';
let mapRenderVersion = 0;
const mapRenderListeners = new Set<() => void>();

function normalizeRendererMode(value: unknown): GoogleRendererMode {
  if (value === 'LEGACY' || value === 'LATEST' || value === 'default') return value;
  return 'default';
}

function normalizeStyleMode(value: unknown): MapStyleMode {
  if (value === 'currentDark' || value === 'compatibleDark' || value === 'standard') return value;
  return 'compatibleDark';
}

function rendererProp(mode: GoogleRendererMode) {
  return mode === 'default' ? undefined : mode;
}

function notifyMapRenderListeners() {
  mapRenderVersion += 1;
  mapRenderListeners.forEach(listener => listener());
}

function setRendererMode(mode: GoogleRendererMode) {
  preferredRendererMode = normalizeRendererMode(mode);
  notifyMapRenderListeners();
  if (isDev) console.log('[MapViewCompat] renderer mode set', preferredRendererMode);
}

function setStyleMode(mode: MapStyleMode) {
  preferredStyleMode = normalizeStyleMode(mode);
  notifyMapRenderListeners();
  if (isDev) console.log('[MapViewCompat] style mode set', preferredStyleMode);
}

function setRenderMode(mode: Partial<{ rendererMode: GoogleRendererMode; styleMode: MapStyleMode }>) {
  if (mode.rendererMode) preferredRendererMode = normalizeRendererMode(mode.rendererMode);
  if (mode.styleMode) preferredStyleMode = normalizeStyleMode(mode.styleMode);
  notifyMapRenderListeners();
  if (isDev) {
    console.log('[MapViewCompat] map render mode set', {
      rendererMode: preferredRendererMode,
      styleMode: preferredStyleMode,
    });
  }
}

function cycleRendererMode() {
  const currentIndex = RENDERER_MODES.indexOf(preferredRendererMode);
  const nextMode = RENDERER_MODES[(currentIndex + 1) % RENDERER_MODES.length];
  setRendererMode(nextMode);
}

function cycleStyleMode() {
  const currentIndex = mapStyleModes.indexOf(preferredStyleMode);
  const nextMode = mapStyleModes[(currentIndex + 1) % mapStyleModes.length];
  setStyleMode(nextMode);
}

function remountMaps() {
  notifyMapRenderListeners();
  if (isDev) {
    console.log('[MapViewCompat] remount requested', {
      rendererMode: preferredRendererMode,
      styleMode: preferredStyleMode,
    });
  }
}

function useMapRenderSubscription() {
  const [version, setVersion] = useState(mapRenderVersion);

  useEffect(() => {
    const listener = () => setVersion(mapRenderVersion);
    mapRenderListeners.add(listener);
    return () => { mapRenderListeners.delete(listener); };
  }, []);

  return version;
}

function installDevRendererSwitch() {
  if (!isDev) return;
  const target = globalThis as typeof globalThis & {
    __SHESAFE_MAP_RENDERER_DEBUG__?: {
      rendererModes: GoogleRendererMode[];
      styleModes: MapStyleMode[];
      getRenderer: () => GoogleRendererMode;
      getStyle: () => MapStyleMode;
      setRenderer: (mode: GoogleRendererMode) => void;
      setStyle: (mode: MapStyleMode) => void;
      setMode: (mode: Partial<{ rendererMode: GoogleRendererMode; styleMode: MapStyleMode }>) => void;
      cycleRenderer: () => void;
      cycleStyle: () => void;
      remount: () => void;
    };
  };

  target.__SHESAFE_MAP_RENDERER_DEBUG__ = {
    rendererModes: RENDERER_MODES,
    styleModes: mapStyleModes,
    getRenderer: () => preferredRendererMode,
    getStyle: () => preferredStyleMode,
    setRenderer: setRendererMode,
    setStyle: setStyleMode,
    setMode: setRenderMode,
    cycleRenderer: cycleRendererMode,
    cycleStyle: cycleStyleMode,
    remount: remountMaps,
  };
}

function orderedRendererModes(startMode: GoogleRendererMode) {
  return [startMode, ...RENDERER_MODES.filter(mode => mode !== startMode)];
}

function orderedDarkStyleModes(startMode: MapStyleMode) {
  const safeStart = startMode === 'standard' ? 'compatibleDark' : startMode;
  return [safeStart, ...(['currentDark', 'compatibleDark'] as MapStyleMode[]).filter(mode => mode !== safeStart)];
}

function buildFallbackAttempts(
  rendererStartMode: GoogleRendererMode,
  styleStartMode: MapStyleMode,
  hasCustomStyle: boolean
): FallbackAttempt[] {
  const rendererModes = orderedRendererModes(rendererStartMode);

  if (!hasCustomStyle) {
    return rendererModes.map(rendererMode => ({ rendererMode, styleMode: 'standard' }));
  }

  const standardAttempts = rendererModes.map(rendererMode => ({ rendererMode, styleMode: 'standard' as const }));

  if (!isDev) {
    if (styleStartMode === 'standard') return standardAttempts;
    return [
      ...rendererModes.map(rendererMode => ({ rendererMode, styleMode: 'compatibleDark' as const })),
      ...standardAttempts,
    ];
  }

  const darkAttempts = orderedDarkStyleModes(styleStartMode).flatMap(styleMode =>
    rendererModes.map(rendererMode => ({ rendererMode, styleMode }))
  );

  return [...darkAttempts, ...standardAttempts];
}

function getCustomStyle(customMapStyle: MapViewProps['customMapStyle']): MapStyle | undefined {
  return Array.isArray(customMapStyle) ? customMapStyle : undefined;
}

const MapViewCompat = React.forwardRef<MapViewRef, CompatMapViewProps>(function MapViewCompat(props, ref) {
  const globalMapRenderVersion = useMapRenderSubscription();
  const currentCustomStyle = getCustomStyle(props.customMapStyle);
  const hasCustomStyle = !!currentCustomStyle?.length;
  const configuredRendererMode = normalizeRendererMode(props.googleRenderer ?? preferredRendererMode);
  const configuredStyleMode = hasCustomStyle ? preferredStyleMode : 'standard';
  const resetKey = [
    props.debugName ?? 'MapView',
    configuredRendererMode,
    configuredStyleMode,
    hasCustomStyle ? 'styled' : 'standard',
    globalMapRenderVersion,
  ].join('-');

  useEffect(() => {
    installDevRendererSwitch();
  }, []);

  return (
    <MapViewCompatInner
      key={resetKey}
      {...props}
      configuredRendererMode={configuredRendererMode}
      configuredStyleMode={configuredStyleMode}
      currentCustomStyle={currentCustomStyle}
      forwardedRef={ref}
      globalMapRenderVersion={globalMapRenderVersion}
      hasCustomStyle={hasCustomStyle}
    />
  );
});

function MapViewCompatInner({
  configuredRendererMode,
  configuredStyleMode,
  currentCustomStyle,
  debugName = 'MapView',
  forwardedRef,
  globalMapRenderVersion,
  hasCustomStyle,
  customMapStyle: _customMapStyle,
  googleRenderer,
  onLayout,
  onMapReady,
  onMapLoaded,
  provider,
  style,
  ...props
}: InnerMapViewProps) {
  const fallbackAttempts = useMemo(
    () => buildFallbackAttempts(configuredRendererMode, configuredStyleMode, hasCustomStyle),
    [configuredRendererMode, configuredStyleMode, hasCustomStyle]
  );
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [allAttemptsFailed, setAllAttemptsFailed] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const activeAttempt = useMemo(
    () => fallbackAttempts[Math.min(attemptIndex, fallbackAttempts.length - 1)] ?? {
      rendererMode: 'default' as const,
      styleMode: hasCustomStyle ? 'compatibleDark' as const : 'standard' as const,
    },
    [attemptIndex, fallbackAttempts, hasCustomStyle]
  );

  const { rendererMode: activeRendererMode, styleMode: activeStyleMode } = activeAttempt;
  const activeRendererProp = Platform.OS === 'android' ? rendererProp(activeRendererMode) : googleRenderer;
  const activeProvider = Platform.OS === 'android' ? provider ?? PROVIDER_GOOGLE : provider;
  const activeCustomMapStyle = hasCustomStyle
    ? resolveMapStyle(activeStyleMode, currentCustomStyle)
    : undefined;
  const mapIdentity = `map-${debugName}-${activeRendererMode}-${activeStyleMode}-${attemptIndex}-${globalMapRenderVersion}`;

  useEffect(() => {
    if (!isDev) return;
    console.log(`[MapViewCompat] ${debugName} mounted`, {
      platform: Platform.OS,
      rendererMode: activeRendererMode,
      googleRenderer: activeRendererProp ?? 'default',
      styleMode: activeStyleMode,
      retryCount: attemptIndex,
      mapKey: mapIdentity,
      layout,
    });
  }, [
    activeRendererMode,
    activeRendererProp,
    activeStyleMode,
    attemptIndex,
    debugName,
    layout,
    mapIdentity,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    if (!mapReady || mapLoaded || allAttemptsFailed) return undefined;

    const timer = setTimeout(() => {
      setMapReady(false);
      setMapLoaded(false);

      if (attemptIndex < fallbackAttempts.length - 1) {
        const nextAttempt = fallbackAttempts[attemptIndex + 1];
        if (isDev) {
          console.log(`[MapViewCompat] ${debugName} map fallback`, {
            from: activeAttempt,
            to: nextAttempt,
            retryCount: attemptIndex + 1,
            layout,
          });
        }
        setAttemptIndex(index => index + 1);
        return;
      }

      if (isDev) {
        console.log(`[MapViewCompat] ${debugName} all map fallback attempts failed`, {
          attempts: fallbackAttempts,
          layout,
        });
      }
      setAllAttemptsFailed(true);
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [
    activeAttempt,
    allAttemptsFailed,
    attemptIndex,
    debugName,
    fallbackAttempts,
    layout,
    mapLoaded,
    mapReady,
  ]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
    if (isDev) console.log(`[MapViewCompat] ${debugName} layout`, { width, height });
    onLayout?.(event);
  }

  function handleMapReady() {
    if (isDev) {
      console.log(`[MapViewCompat] ${debugName} onMapReady`, {
        rendererMode: activeRendererMode,
        googleRenderer: activeRendererProp ?? 'default',
        styleMode: activeStyleMode,
        mapKey: mapIdentity,
      });
    }
    setMapReady(true);
    onMapReady?.();
  }

  const handleMapLoaded: NonNullable<MapViewProps['onMapLoaded']> = (event) => {
    if (isDev) {
      console.log(`[MapViewCompat] ${debugName} onMapLoaded`, {
        rendererMode: activeRendererMode,
        googleRenderer: activeRendererProp ?? 'default',
        styleMode: activeStyleMode,
        mapKey: mapIdentity,
      });
    }

    if (Platform.OS === 'android') {
      preferredRendererMode = activeRendererMode;
      if (hasCustomStyle) preferredStyleMode = activeStyleMode;
      if (isDev) {
        console.log('[MapViewCompat] adopted working map render mode', {
          rendererMode: preferredRendererMode,
          styleMode: preferredStyleMode,
        });
      }
    }

    setMapLoaded(true);
    setAllAttemptsFailed(false);
    onMapLoaded?.(event);
  };

  function retryFromDefault() {
    preferredRendererMode = 'default';
    preferredStyleMode = hasCustomStyle ? 'compatibleDark' : 'standard';
    setAttemptIndex(0);
    setMapReady(false);
    setMapLoaded(false);
    setAllAttemptsFailed(false);
    notifyMapRenderListeners();
    if (isDev) {
      console.log(`[MapViewCompat] ${debugName} retrying map render`, {
        rendererMode: preferredRendererMode,
        styleMode: preferredStyleMode,
      });
    }
  }

  return (
    <View style={style} onLayout={handleLayout}>
      <RNMapView
        key={mapIdentity}
        ref={forwardedRef}
        {...props}
        provider={activeProvider}
        {...(activeRendererProp ? { googleRenderer: activeRendererProp } : {})}
        {...(activeCustomMapStyle ? { customMapStyle: activeCustomMapStyle } : {})}
        style={StyleSheet.absoluteFill}
        onMapReady={handleMapReady}
        onMapLoaded={handleMapLoaded}
      />

      {allAttemptsFailed && !mapLoaded ? (
        <View pointerEvents="box-none" style={styles.fallbackLayer}>
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackTitle}>Map is taking longer to draw</Text>
            <Text style={styles.fallbackText}>
              Your location is available. Try reloading the map surface.
            </Text>
            <Pressable style={styles.fallbackButton} onPress={retryFromDefault}>
              <Text style={styles.fallbackButtonText}>Retry map</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  fallbackCard: {
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10,10,18,0.92)',
    padding: 16,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  fallbackButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  fallbackButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default MapViewCompat;
export { Circle, Marker, Polyline, PROVIDER_GOOGLE, compatibleDarkMapStyle };
