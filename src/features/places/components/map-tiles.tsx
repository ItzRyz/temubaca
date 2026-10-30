"use client";

import { createContext, useContext, type ReactNode } from "react";

import { mapTiles, type MapTiles } from "../places";

const MapTilesContext = createContext<MapTiles>(mapTiles("OSM"));

/** Gives the maps below the tile provider chosen in Pengaturan; without it they use OpenStreetMap. */
export function MapTilesProvider({ tiles, children }: { tiles: MapTiles; children: ReactNode }) {
    return <MapTilesContext.Provider value={tiles}>{children}</MapTilesContext.Provider>;
}

export function useMapTiles() {
    return useContext(MapTilesContext);
}
