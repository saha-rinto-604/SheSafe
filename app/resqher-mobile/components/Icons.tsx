import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../src/constants/theme';

export function SafePlacePinIcon({ size = 20, color }: { size?: number; color?: string }) {
    return <Ionicons name="shield" size={size} color={color ?? T.violet} />;
}

export default {};
