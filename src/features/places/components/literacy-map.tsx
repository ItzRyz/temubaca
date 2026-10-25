"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

import { INDONESIA_BOUNDS, INDONESIA_CENTER, placeTypeColors, placeTypeLabels, type PlaceType } from "../places";

/** OSM tile policy: keep the URL configurable so the provider can change without a code change. */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">kontributor OpenStreetMap</a>';

export type MapPlace = { id: string; type: PlaceType; name: string; latitude: number; longitude: number };

function FocusOn({ target }: { target: { latitude: number; longitude: number; zoom: number } | null }) {
    const map = useMap();
    useEffect(() => {
        if (target) map.flyTo([target.latitude, target.longitude], target.zoom, { duration: 0.6 });
    }, [map, target]);
    return null;
}

function FitRoute({ points }: { points: [number, number][] | null }) {
    const map = useMap();
    useEffect(() => {
        if (points) map.fitBounds(points, { padding: [32, 32] });
    }, [map, points]);
    return null;
}

/** Leaflet view of the places (DEC-07). Loaded in the browser only; the list next to it carries the same information. */
export default function LiteracyMap({ places, selectedId, focus, reader, route, onSelect }: {
    places: MapPlace[];
    selectedId: string | null;
    focus: { latitude: number; longitude: number; zoom: number } | null;
    reader: { latitude: number; longitude: number } | null;
    /** Route geometry in GeoJSON order, [longitude, latitude] (TB-064). */
    route: [number, number][] | null;
    onSelect: (id: string) => void;
}) {
    // Leaflet wants [latitude, longitude].
    const routePoints = useMemo(() => route?.map(([lng, lat]) => [lat, lng] as [number, number]) ?? null, [route]);
    return (
        <MapContainer
            center={[INDONESIA_CENTER.latitude, INDONESIA_CENTER.longitude]}
            zoom={5}
            minZoom={4}
            maxBounds={[[INDONESIA_BOUNDS.south - 3, INDONESIA_BOUNDS.west - 5], [INDONESIA_BOUNDS.north + 3, INDONESIA_BOUNDS.east + 5]]}
            scrollWheelZoom={false}
            className="size-full"
        >
            <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
            <FocusOn target={focus} />
            <FitRoute points={routePoints} />
            {routePoints && <Polyline positions={routePoints} pathOptions={{ color: "#1d4ed8", weight: 5, opacity: 0.85 }} />}
            {reader && (
                <CircleMarker center={[reader.latitude, reader.longitude]} radius={7} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}>
                    <Popup>Posisimu (hanya di perangkat ini)</Popup>
                </CircleMarker>
            )}
            {places.map((place) => (
                <CircleMarker
                    key={place.id}
                    center={[place.latitude, place.longitude]}
                    radius={place.id === selectedId ? 11 : 8}
                    pathOptions={{ color: "#ffffff", weight: 2, fillColor: placeTypeColors[place.type], fillOpacity: 0.95 }}
                    eventHandlers={{ click: () => onSelect(place.id) }}
                >
                    <Popup>
                        <strong>{place.name}</strong>
                        <br />
                        {placeTypeLabels[place.type]}
                    </Popup>
                </CircleMarker>
            ))}
        </MapContainer>
    );
}
