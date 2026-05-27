/**
 * RedZoneOverlay.tsx — 100m Danger Zone Markers
 * ─────────────────────────────────────────────────────────────────────────
 * Renders translucent red circles on a MapView for each active Red Zone.
 * Fill: rgba(255, 59, 48, 0.3) — matches SRS Danger Red Zone fill token.
 * Radius: 100m constant (SRS binary model).
 *
 * Usage:
 *   <MapView>
 *     <RedZoneOverlay zones={RED_ZONES} />
 *   </MapView>
 */

import React, { memo } from 'react';
import { Circle } from './shared/MapViewCompat';
import type { RedZone } from '../types/medical';

interface Props {
    zones: RedZone[];
}

const RedZoneOverlay = memo(function RedZoneOverlay({ zones }: Props) {
    return (
        <>
            {zones.map(zone => (
                <Circle
                    key={zone.id}
                    center={{ latitude: zone.latitude, longitude: zone.longitude }}
                    radius={zone.radiusMeters}
                    fillColor="rgba(255, 59, 48, 0.3)"
                    strokeColor="rgba(255, 59, 48, 0.6)"
                    strokeWidth={1.5}
                    zIndex={10}
                />
            ))}
        </>
    );
});

export default RedZoneOverlay;
