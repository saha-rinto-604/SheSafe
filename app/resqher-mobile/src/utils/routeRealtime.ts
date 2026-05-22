import { haversineDistance, type LatLng } from './routeSafety';

export const OFF_ROUTE_THRESHOLD_M = 40;
export const REROUTE_DELAY_MS = 5_000;
export const REROUTE_THROTTLE_MS = 7_000;
export const ENDPOINT_MOVE_THRESHOLD_M = 20;

export type RouteProgress = {
  closestIndex: number;
  nearestDistanceM: number;
  completedRouteCoords: LatLng[];
  remainingRouteCoords: LatLng[];
};

export function getClosestRoutePoint(current: LatLng, routeCoords: LatLng[]): { index: number; distanceM: number } {
  let index = 0;
  let distanceM = Infinity;

  routeCoords.forEach((point, pointIndex) => {
    const distance = haversineDistance(current, point);
    if (distance < distanceM) {
      index = pointIndex;
      distanceM = distance;
    }
  });

  return { index, distanceM };
}

export function getForwardRouteProgress(current: LatLng, routeCoords: LatLng[]): RouteProgress {
  const { index, distanceM } = getClosestRoutePoint(current, routeCoords);
  return {
    closestIndex: index,
    nearestDistanceM: distanceM,
    completedRouteCoords: routeCoords.slice(0, index + 1),
    remainingRouteCoords: routeCoords.slice(index),
  };
}

export function getReverseRouteProgress(current: LatLng, routeCoords: LatLng[]): RouteProgress {
  const { index, distanceM } = getClosestRoutePoint(current, routeCoords);
  return {
    closestIndex: index,
    nearestDistanceM: distanceM,
    completedRouteCoords: routeCoords.slice(index),
    remainingRouteCoords: routeCoords.slice(0, index + 1),
  };
}

export function hasMovedMeaningfully(previous: LatLng | null | undefined, next: LatLng | null | undefined, thresholdM = ENDPOINT_MOVE_THRESHOLD_M) {
  if (!previous || !next) return false;
  return haversineDistance(previous, next) >= thresholdM;
}
