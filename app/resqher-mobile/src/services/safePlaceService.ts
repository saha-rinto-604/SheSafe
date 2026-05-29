import { safePlaceService as incidentSafePlaceService, type SafePlace } from './incidentService';

export type { SafePlace };

export type SafePlaceDestination = {
  id: string;
  sourceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  source: 'safe_place';
  type: 'safe_place';
  category: 'safe_place';
  description: string | null;
  status: string;
  isSafePlace: true;
  markerColor: 'purple';
  raw: SafePlace;
};

function isConfirmedSafePlaceStatus(status?: string | null) {
  const normalized = String(status || '').trim().toUpperCase();
  return normalized === 'CONFIRMED' || normalized === 'APPROVED';
}

function normalizeSafePlaceStatus(status?: string | null) {
  return isConfirmedSafePlaceStatus(status) ? 'CONFIRMED' : String(status || '');
}

export function mapConfirmedSafePlaces(places: SafePlace[]): SafePlace[] {
  return places
    .filter((place) => isConfirmedSafePlaceStatus(place.status))
    .map((place) => ({
      ...place,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      status: normalizeSafePlaceStatus(place.status),
    }))
    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}

export function mapSafePlaceToDestination(place: SafePlace): SafePlaceDestination {
  return {
    id: `safe-place-${place.id}`,
    sourceId: String(place.id),
    name: place.name || 'Safe Place',
    address: place.address || place.description || 'Confirmed safe place',
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    source: 'safe_place',
    type: 'safe_place',
    category: 'safe_place',
    description: place.description || null,
    status: normalizeSafePlaceStatus(place.status) || 'CONFIRMED',
    isSafePlace: true,
    markerColor: 'purple',
    raw: place,
  };
}

export async function getConfirmedSafePlaces(): Promise<SafePlace[]> {
  const places = await incidentSafePlaceService.getSafePlaces();
  return mapConfirmedSafePlaces(places);
}

export const safePlacePublicService = {
  getConfirmedSafePlaces,
  mapSafePlaceToDestination,
  submitSafePlace: incidentSafePlaceService.submitSafePlace,
};

export default safePlacePublicService;
