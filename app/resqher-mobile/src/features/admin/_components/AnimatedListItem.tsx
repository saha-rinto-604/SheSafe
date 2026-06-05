import React, { useEffect, useState } from 'react';
import { Animated, Platform, ViewStyle, StyleProp } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  isRemoving?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedListItem({ children, index, isRemoving = false, style }: AnimatedListItemProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(20));
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    // Entrance Animation
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: index * 50,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    ]).start();
  }, [index, opacity, translateY]);

  useEffect(() => {
    if (isRemoving) {
      // Exit Animation
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(scale, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [isRemoving, opacity, scale]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }, { scale }] }, style]}>
      {children}
    </Animated.View>
  );
}
