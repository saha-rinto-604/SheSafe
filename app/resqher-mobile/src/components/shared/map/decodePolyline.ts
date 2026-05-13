/**
 * decodePolyline.ts — Google encoded polyline decoder
 * ─────────────────────────────────────────────────────
 * Extracted verbatim from volunteer/index.tsx lines 330-362.
 * Algorithm is the standard Google polyline encoding spec.
 */

export type LatLng = { latitude: number; longitude: number };

export function decodePolyline(encoded: string): LatLng[] {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates: LatLng[] = [];

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += deltaLat;

        result = 0;
        shift = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += deltaLng;

        coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }

    return coordinates;
}
