import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

export type RouteAudioType = 'safe' | 'partial' | 'unsafe';

const ROUTE_AUDIO_MESSAGES: Record<RouteAudioType, string> = {
  safe: 'Safety update: Safest route selected, avoiding all high risk areas.',
  partial: 'Safety update: No fully safe route was found. Showing the least risky route available.',
  unsafe: 'Safety alert: This route passes through a high risk area.',
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useRouteAudio(context = 'RouteAudio') {
  const playSeqRef = useRef(0);
  const routeAudioActiveRef = useRef(false);
  const routeAudioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const stopRouteAudio = useCallback(async () => {
    playSeqRef.current += 1;
    routeAudioActiveRef.current = false;
    if (routeAudioTimerRef.current) {
      clearTimeout(routeAudioTimerRef.current);
      routeAudioTimerRef.current = null;
    }
    try {
      await Speech.stop();
    } catch (error) {
      if (__DEV__) console.warn(`[${context}] Route audio stop failed:`, error);
    }
  }, [context]);

  const playRouteAudio = useCallback(async (type: RouteAudioType, messageOverride?: string) => {
    const message = messageOverride ?? ROUTE_AUDIO_MESSAGES[type];
    if (!message) return;

    const seq = ++playSeqRef.current;
    const finish = () => {
      if (seq === playSeqRef.current) routeAudioActiveRef.current = false;
      if (routeAudioTimerRef.current) {
        clearTimeout(routeAudioTimerRef.current);
        routeAudioTimerRef.current = null;
      }
    };

    try {
      routeAudioActiveRef.current = true;
      if (routeAudioTimerRef.current) clearTimeout(routeAudioTimerRef.current);
      await Speech.stop();
      await wait(90);

      if (!mountedRef.current || seq !== playSeqRef.current) {
        finish();
        return;
      }

      Speech.speak(message, {
        language: 'en',
        pitch: 1.0,
        rate: Platform.OS === 'android' ? 0.9 : 0.95,
        onDone: finish,
        onStopped: finish,
        onError: error => {
          finish();
          if (__DEV__) console.warn(`[${context}] Route audio playback failed:`, error);
        },
      });
      routeAudioTimerRef.current = setTimeout(finish, Math.max(3500, message.length * 90));
    } catch (error) {
      finish();
      if (__DEV__) console.warn(`[${context}] Route audio playback failed:`, error);
    }
  }, [context]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      playSeqRef.current += 1;
      routeAudioActiveRef.current = false;
      if (routeAudioTimerRef.current) clearTimeout(routeAudioTimerRef.current);
      void Speech.stop().catch(error => {
        if (__DEV__) console.warn(`[${context}] Route audio cleanup failed:`, error);
      });
    };
  }, [context]);

  return { playRouteAudio, stopRouteAudio, routeAudioActiveRef };
}
