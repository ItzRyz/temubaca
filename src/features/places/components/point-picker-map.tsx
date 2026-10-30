"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { INDONESIA_CENTER, isInsideIndonesia, roundCoordinate } from "../places";
import { useMapTiles } from "./map-tiles";

type Point = { latitude: number; longitude: number };

function ClickToPlace({ onPick }: { onPick: (point: Point) => void }) {
    useMapEvents({
        click: ({ latlng }) => {
            if (isInsideIndonesia(latlng.lat, latlng.lng)) onPick({ latitude: roundCoordinate(latlng.lat), longitude: roundCoordinate(latlng.lng) });
        },
    });
    return null;
}

function FollowPoint({ point }: { point: Point | null }) {
    const map = useMap();
    useEffect(() => {
        if (point && !map.getBounds().contains([point.latitude, point.longitude])) map.setView([point.latitude, point.longitude], Math.max(map.getZoom(), 15));
    }, [map, point]);
    return null;
}

/** Click the map to drop the pin; the numeric fields next to it are the accessible way to set it. */
export default function PointPickerMap({ point, onPick }: { point: Point | null; onPick: (point: Point) => void }) {
    const tiles = useMapTiles();
    return (
        <MapContainer
            center={point ? [point.latitude, point.longitude] : [INDONESIA_CENTER.latitude, INDONESIA_CENTER.longitude]}
            zoom={point ? 15 : 5}
            className="size-full"
        >
            <TileLayer url={tiles.url} attribution={tiles.attribution} maxZoom={19} />
            <ClickToPlace onPick={onPick} />
            <FollowPoint point={point} />
            {point && <CircleMarker center={[point.latitude, point.longitude]} radius={9} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#b4583f", fillOpacity: 1 }} />}
        </MapContainer>
    );
}
