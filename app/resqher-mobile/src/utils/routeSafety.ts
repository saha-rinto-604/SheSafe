export type LatLng = {
  latitude: number;
  longitude: number;
};

export type RouteSafetyZone = LatLng & {
  id?: string | number;
  radius?: number;
  name?: string;
  incidentCount?: number;
  incident_count?: number;
  count?: number;
  total?: number;
  incidents?: unknown[];
};

export type RouteSafetyResult = {
  isUnsafe: boolean;
  redZoneName?: string;
  riskScore: number;
  redHits: number;
  yellowHits: number;
  sampledPoints: number;
};

export type RouteSafetyOptions = {
  ignoreStartingRedZoneUntilExit?: boolean;
};

const EARTH_RADIUS_M = 6_371_000;
const SEGMENT_SAMPLE_INTERVAL_M = 20;
const DEFAULT_ZONE_RADIUS_M = 500;
const RED_ZONE_PENALTY = 25;
const YELLOW_ZONE_PENALTY = 1;

export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function getZoneIncidentCount(zone: RouteSafetyZone): number {
  const count = Number(
    zone.incidentCount ??
    zone.incident_count ??
    zone.count ??
    zone.total ??
    zone.incidents?.length ??
    0
  );
  return Number.isFinite(count) ? count : 0;
}

function getZoneRadius(zone: RouteSafetyZone): number {
  const radius = Number(zone.radius ?? DEFAULT_ZONE_RADIUS_M);
  return Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_ZONE_RADIUS_M;
}

function pointInsideZone(point: LatLng, zone: RouteSafetyZone): boolean {
  return haversineDistance(point, zone) <= getZoneRadius(zone);
}

function getZoneKey(zone: RouteSafetyZone, index: number): string {
  return String(zone.id ?? `${index}:${zone.latitude}:${zone.longitude}:${getZoneIncidentCount(zone)}`);
}

type PreparedZone = {
  key: string;
  zone: RouteSafetyZone;
};

type StartingRedZoneState = {
  startingKeys: Set<string>;
  exitedKeys: Set<string>;
};

function evaluatePoint(
  point: LatLng,
  zones: PreparedZone[],
  result: RouteSafetyResult,
  startingRedZoneState?: StartingRedZoneState,
) {
  result.sampledPoints += 1;

  for (const { key, zone } of zones) {
    const incidentCount = getZoneIncidentCount(zone);
    if (incidentCount < 1) continue;

    const isInsideZone = pointInsideZone(point, zone);
    if (!isInsideZone) {
      if (startingRedZoneState?.startingKeys.has(key)) {
        startingRedZoneState.exitedKeys.add(key);
      }
      continue;
    }

    if (incidentCount >= 5) {
      const isStartingRedZone = startingRedZoneState?.startingKeys.has(key);
      const hasExitedStartingZone = startingRedZoneState?.exitedKeys.has(key);
      if (isStartingRedZone && !hasExitedStartingZone) continue;

      result.riskScore += RED_ZONE_PENALTY;
      result.redHits += 1;
      if (!result.isUnsafe) {
        result.isUnsafe = true;
        result.redZoneName = zone.name;
      }
    } else {
      result.riskScore += YELLOW_ZONE_PENALTY;
      result.yellowHits += 1;
    }
  }
}

export function evaluateRouteSafety(
  coordinates: LatLng[],
  zones: RouteSafetyZone[],
  options: RouteSafetyOptions = {},
): RouteSafetyResult {
  const result: RouteSafetyResult = {
    isUnsafe: false,
    riskScore: 0,
    redHits: 0,
    yellowHits: 0,
    sampledPoints: 0,
  };
  if (coordinates.length === 0 || zones.length === 0) return result;

  const usableZones = zones
    .map((zone, index) => ({ key: getZoneKey(zone, index), zone }))
    .filter(({ zone }) =>
      Number.isFinite(Number(zone.latitude)) &&
      Number.isFinite(Number(zone.longitude)) &&
      getZoneIncidentCount(zone) >= 1
    );
  if (usableZones.length === 0) return result;

  const startingRedZoneState: StartingRedZoneState | undefined = options.ignoreStartingRedZoneUntilExit
    ? {
      startingKeys: new Set(
        usableZones
          .filter(({ zone }) => getZoneIncidentCount(zone) >= 5 && pointInsideZone(coordinates[0], zone))
          .map(({ key }) => key)
      ),
      exitedKeys: new Set(),
    }
    : undefined;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    evaluatePoint(p1, usableZones, result, startingRedZoneState);

    const segmentDistance = haversineDistance(p1, p2);
    const steps = Math.ceil(segmentDistance / SEGMENT_SAMPLE_INTERVAL_M);
    for (let j = 1; j < steps; j += 1) {
      const fraction = j / steps;
      evaluatePoint({
        latitude: p1.latitude + (p2.latitude - p1.latitude) * fraction,
        longitude: p1.longitude + (p2.longitude - p1.longitude) * fraction,
      }, usableZones, result, startingRedZoneState);
    }
  }

  evaluatePoint(coordinates[coordinates.length - 1], usableZones, result, startingRedZoneState);
  return result;
}
