import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

import { R, T } from '../src/constants/theme';
import AICopilotSheet, { type AICopilotRole } from './AICopilotSheet';

const COPILOT_ICON = require('../assets/images/aicopiloticon.png');
const BUTTON_SIZE = 56;
const EDGE_GAP = 18;
const TAP_SLOP = 8;
const FORM_ROUTE_PARTS = [
  '/edit-profile',
  '/profile-information',
  '/safety-settings',
  '/volunteer-verification',
];

type Props = {
  role?: AICopilotRole;
  incidentId?: string | number | null;
  bottom?: number;
  right?: number;
  hidden?: boolean;
  storageKey?: string;
  style?: StyleProp<ViewStyle>;
};

type Position = {
  x: number;
  y: number;
};

type DragState = {
  startX: number;
  startY: number;
  touchX: number;
  touchY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
};

export default function AICopilotFloatingButton({
  role = 'standard',
  incidentId,
  bottom = 90,
  right = 18,
  hidden = false,
  storageKey,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const resolvedStorageKey = useMemo(
    () => `shesafe_ai_copilot_position_${storageKey || role}`,
    [role, storageKey],
  );

  const clampPosition = useCallback((next: Position) => {
    const minX = EDGE_GAP;
    const maxX = Math.max(minX, width - BUTTON_SIZE - EDGE_GAP);
    const minY = Math.max(EDGE_GAP, insets.top + EDGE_GAP);
    const maxY = Math.max(
      minY,
      height - BUTTON_SIZE - Math.max(bottom + Math.max(insets.bottom, 0), EDGE_GAP),
    );

    return {
      x: Math.min(Math.max(next.x, minX), maxX),
      y: Math.min(Math.max(next.y, minY), maxY),
    };
  }, [bottom, height, insets.bottom, insets.top, width]);

  const defaultPosition = useMemo(() => clampPosition({
    x: width - right - BUTTON_SIZE,
    y: height - bottom - Math.max(insets.bottom, 0) - BUTTON_SIZE,
  }), [bottom, clampPosition, height, insets.bottom, right, width]);

  const currentPosition = position ? clampPosition(position) : defaultPosition;

  useEffect(() => {
    let mounted = true;

    SecureStore.getItemAsync(resolvedStorageKey)
      .then((raw) => {
        if (!mounted || !raw) return;
        const saved = JSON.parse(raw) as Position;
        if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          setPosition(clampPosition(saved));
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [clampPosition, resolvedStorageKey]);

  const shouldHideForForm = FORM_ROUTE_PARTS.some((routePart) => pathname.includes(routePart));

  if (hidden || shouldHideForForm) return null;

  const openSheet = () => {
    Haptics.selectionAsync().catch(() => undefined);
    setSheetVisible(true);
  };

  const persistPosition = (next: Position) => {
    SecureStore.setItemAsync(resolvedStorageKey, JSON.stringify(next)).catch(() => undefined);
  };

  const handleGrant = (event: GestureResponderEvent) => {
    dragRef.current = {
      startX: currentPosition.x,
      startY: currentPosition.y,
      touchX: event.nativeEvent.pageX,
      touchY: event.nativeEvent.pageY,
      currentX: currentPosition.x,
      currentY: currentPosition.y,
      moved: false,
    };
  };

  const handleMove = (event: GestureResponderEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = event.nativeEvent.pageX - drag.touchX;
    const dy = event.nativeEvent.pageY - drag.touchY;
    const moved = drag.moved || Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP;
    const nextPosition = clampPosition({ x: drag.startX + dx, y: drag.startY + dy });
    dragRef.current = {
      ...drag,
      moved,
      currentX: nextPosition.x,
      currentY: nextPosition.y,
    };

    if (moved) {
      setPosition(nextPosition);
    }
  };

  const handleRelease = () => {
    const drag = dragRef.current;
    dragRef.current = null;

    if (!drag?.moved) {
      openSheet();
      return;
    }

    const leftX = EDGE_GAP;
    const rightX = Math.max(leftX, width - BUTTON_SIZE - EDGE_GAP);
    const finalPosition = clampPosition({
      x: drag.currentX < width / 2 ? leftX : rightX,
      y: drag.currentY,
    });

    setPosition(finalPosition);
    persistPosition(finalPosition);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          st.button,
          {
            left: currentPosition.x,
            top: currentPosition.y,
          },
          style,
        ]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleGrant}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
        accessibilityRole="button"
        accessibilityLabel="Open SheSafe AI Safety Copilot"
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.13)', 'rgba(138,56,246,0.15)', 'rgba(30,21,58,0.82)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={st.gradient}
        >
          <Image source={COPILOT_ICON} style={st.icon} resizeMode="contain" />
        </LinearGradient>
      </View>

      <AICopilotSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        role={role}
        incidentId={incidentId}
      />
    </View>
  );
}

const st = StyleSheet.create({
  button: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: R.pill,
    padding: 3,
    overflow: 'hidden',
    backgroundColor: T.surfaceBulkyGlass,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    zIndex: 900,
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOpacity: 0.20,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 12,
      },
    }),
  },
  gradient: {
    flex: 1,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 42,
    height: 42,
  },
});
