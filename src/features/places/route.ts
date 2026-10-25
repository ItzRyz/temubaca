/**
 * Route rules shared by the route handler, the map, and tests (TB-064, DEC-07). No server-only imports.
 */

export const ROUTE_MODES = ["drive", "walk"] as const;
export type RouteMode = (typeof ROUTE_MODES)[number];

export const routeModeLabels: Record<RouteMode, string> = { drive: "Mobil", walk: "Jalan kaki" };

/** What a route request ends in. Anything but ROUTE still offers the Google Maps link. */
export type RouteOutcome = "ROUTE" | "OUT_OF_COVERAGE" | "SNAP_TOO_FAR" | "NO_PATH" | "UNAVAILABLE";

export const routeOutcomeMessages: Record<Exclude<RouteOutcome, "ROUTE">, string> = {
    OUT_OF_COVERAGE: "Rute TemuBaca baru mencakup Jakarta dan Tangerang. Buka Google Maps untuk petunjuk arah.",
    SNAP_TOO_FAR: "Lokasimu atau tempat ini terlalu jauh dari jalan yang terpetakan. Buka Google Maps untuk petunjuk arah.",
    NO_PATH: "Rute tidak ditemukan untuk moda ini. Coba moda lain atau buka Google Maps.",
    UNAVAILABLE: "Rute sedang tidak tersedia. Buka Google Maps untuk petunjuk arah.",
};

/** ML Service routing codes (BACKEND_PETA_RUTE.md section 5.3) to the state the map shows. */
export function routeOutcomeOf(code: string | undefined): Exclude<RouteOutcome, "ROUTE"> {
    if (code === "OUT_OF_COVERAGE" || code === "SNAP_TOO_FAR" || code === "NO_PATH") return code;
    // Timeouts, an unconfigured or unloaded graph, a bad token, or anything unexpected.
    return "UNAVAILABLE";
}
