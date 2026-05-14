/**
 * SafeRoutePolyline.tsx — Electric Violet Safe Path
 * ─────────────────────────────────────────────────────────────────────────
 * Renders the safe route polyline that bypasses Red Zones.
 * Color: Electric Violet (#8A38F6) — SRS Safe Path token.
 * Width: 5 — prominent on tactical map.
 *
 * Usage:
 *   <MapView>
 *     <SafeRoutePolyline coordinates={DEMO_SAFE_ROUTE} />
 *   </MapView>
 */

import React, { memo } from 'react';
import { Polyline } from 'react-native-maps';

interface Coordinate {
    latitude: number;
    longitude: number;
}

interface Props {
    coordinates: Coordinate[];
}

const SafeRoutePolyline = memo(function SafeRoutePolyline({ coordinates }: Props) {
    if (coordinates.length < 2) return null;

    return (
        <Polyline
            coordinates={coordinates}
            strokeColor="#8A38F6"
            strokeWidth={5}
            lineDashPattern={[0]}
            lineJoin="round"
            lineCap="round"
            zIndex={20}
        />
    );
});

export default SafeRoutePolyline;
