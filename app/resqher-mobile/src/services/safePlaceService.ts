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

export function mapConfirmedSafePlaces(places: SafePlace[]): SafePlace[] {
  return places.filter((place) => String(place.status || '').toUpperCase() === 'CONFIRMED');
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
    status: String(place.status || 'CONFIRMED'),
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
