import type { ReactNode } from "react";

import { getSettings } from "@/lib/db/queries/settings";

import { mapTiles } from "../places";
import { MapTilesProvider } from "./map-tiles";

/** Server wrapper: maps inside use the tile provider chosen in Pengaturan → Peta & Lokasi. */
export async function MapTilesFromSettings({ children }: { children: ReactNode }) {
    const { settings } = await getSettings("map");
    return <MapTilesProvider tiles={mapTiles(settings.tileProvider)}>{children}</MapTilesProvider>;
}
