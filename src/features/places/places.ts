/**
 * Peta Literasi rules shared by the server, the map, and tests (DEC-07). No server-only imports.
 */

export const PLACE_TYPES = ["LIBRARY", "COMMUNITY", "EVENT", "MEETING_POINT"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

/** Types the admin curates; community pins come from the community owner. */
export const CURATED_PLACE_TYPES = ["LIBRARY", "MEETING_POINT"] as const satisfies readonly PlaceType[];

export const placeTypeLabels: Record<PlaceType, string> = {
    LIBRARY: "Perpustakaan",
    COMMUNITY: "Komunitas",
    EVENT: "Acara",
    MEETING_POINT: "Titik temu publik",
};

/** Marker colours per type; the list and the popup also name the type, so colour is never the only cue. */
export const placeTypeColors: Record<PlaceType, string> = {
    LIBRARY: "#21523d",
    COMMUNITY: "#b4583f",
    EVENT: "#55607f",
    MEETING_POINT: "#a88445",
};

/** Matches the `places_coordinates_check` constraint: a generous box around Indonesia. */
export const INDONESIA_BOUNDS = { south: -11.5, north: 6.5, west: 94.5, east: 141.5 } as const;

/** Map view when there are no places to fit: all of Indonesia. */
export const INDONESIA_CENTER = { latitude: -2.5, longitude: 118 } as const;

export function isInsideIndonesia(latitude: number, longitude: number) {
    return latitude >= INDONESIA_BOUNDS.south && latitude <= INDONESIA_BOUNDS.north
        && longitude >= INDONESIA_BOUNDS.west && longitude <= INDONESIA_BOUNDS.east;
}

/** Six decimals (about 11 cm) is what the database keeps. */
export function roundCoordinate(value: number) {
    return Math.round(value * 1e6) / 1e6;
}

/**
 * Google Maps URL that shows the point (Maps URLs, `api=1`; the comma is encoded as `%2C`).
 * https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsUrl(latitude: number, longitude: number) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`;
}

/** Straight-line distance in metres (haversine). Computed in the browser only; the reader's position never leaves it. */
export function distanceMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = radians(to.latitude - from.latitude);
    const dLng = radians(to.longitude - from.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

/** "850 m" under 1 km, then kilometres with one decimal under 10 km. */
export function formatDistance(meters: number) {
    if (meters < 1000) return `${Math.max(100, Math.round(meters / 100) * 100)} m`;
    const km = meters / 1000;
    return `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
}
