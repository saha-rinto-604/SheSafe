export type Volunteer = {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distanceStr: string;
    rating: number;
    verified: boolean;
};

export type ZoneType = 'RED' | 'YELLOW';

/**
 * Helper to generate random coordinates within a given radius in meters.
 */
function getRandomCoordinate(centerLat: number, centerLng: number, radiusMeters: number) {
    const r = radiusMeters / 111300; // rough convert meters to coordinate degrees
    const u = Math.random();
    const v = Math.random();
    const w = r * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const x = w * Math.cos(t);
    const y = w * Math.sin(t);
    // Adjust longitude for latitude shrink
    const newLng = x / Math.cos((centerLat * Math.PI) / 180);
    return {
        latitude: centerLat + y,
        longitude: centerLng + newLng,
    };
}

const FIRST_NAMES = ['Ayesha', 'Fatima', 'Nadia', 'Kabir', 'Rafiq', 'Salma', 'Jamil', 'Tariq', 'Sadia', 'Imran'];
const LAST_NAMES = ['Rahman', 'Khan', 'Hossain', 'Ahmed', 'Islam', 'Chowdhury', 'Begum', 'Akter', 'Uddin'];

/**
 * Generates a random zone (Red or Yellow) and 3-7 random volunteers inside the zone.
 * @param centerLat latitude of the tap
 * @param centerLng longitude of the tap
 * @returns { zoneType: 'RED' | 'YELLOW', radius: number, volunteers: Volunteer[] }
 */
export function generateRandomZoneData(centerLat: number, centerLng: number) {
    const zoneType: ZoneType = Math.random() > 0.5 ? 'RED' : 'YELLOW';
    const radiusMeters = 250; // 500m diameter
    
    // Generate 3 to 7 volunteers
    const numVolunteers = Math.floor(Math.random() * 5) + 3;
    const volunteers: Volunteer[] = [];

    for (let i = 0; i < numVolunteers; i++) {
        const coords = getRandomCoordinate(centerLat, centerLng, radiusMeters - 20); // keep slightly inside
        
        // Mock distance string based on fraction of radius
        const distFromCenter = Math.floor(Math.random() * 200) + 50; 
        
        volunteers.push({
            id: `vol-${Date.now()}-${i}`,
            name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
            latitude: coords.latitude,
            longitude: coords.longitude,
            distanceStr: `${distFromCenter}m away`,
            rating: Number((4.0 + Math.random()).toFixed(1)),
            verified: Math.random() > 0.2, // 80% chance to be verified
        });
    }

    return {
        zoneType,
        radiusMeters,
        center: { latitude: centerLat, longitude: centerLng },
        volunteers
    };
}
