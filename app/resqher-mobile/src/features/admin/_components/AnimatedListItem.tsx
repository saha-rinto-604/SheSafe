import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  isRemoving?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedListItem({ children, index, isRemoving = false, style }: AnimatedListItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance Animation
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  useEffect(() => {
    if (isRemoving) {
      // Exit Animation
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isRemoving]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }, { scale }] }, style]}>
      {children}
    </Animated.View>
  );
}
