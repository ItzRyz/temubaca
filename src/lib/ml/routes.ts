/**
 * ML Service routing contract (TB-064, BACKEND_PETA_RUTE.md sections 5.1-5.3) without env access,
 * so tests can drive it directly. App code imports `./client`, which supplies the URL and key.
 */
import { z } from "zod";

import { ROUTE_MODES, type RouteMode } from "@/features/places/route";

import { postToMlService, type MlServiceConfig } from "./request";

/** Routing walks a city graph, so it gets more time than recommendations (Lampiran A: 5 s). */
const ROUTE_TIMEOUT_MS = 5_000;

const routeSchema = z.object({
    mode: z.enum(ROUTE_MODES),
    distance_m: z.number().nonnegative(),
    duration_s_estimate: z.number().nonnegative(),
    geometry: z.object({
        type: z.literal("LineString"),
        coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
    }),
    via_streets: z.array(z.string()).max(3),
    snap: z.object({ origin_offset_m: z.number(), destination_offset_m: z.number() }),
    warnings: z.array(z.string()),
    graph_version: z.string(),
});

export type MlRoute = z.infer<typeof routeSchema>;
export type RoutePoint = { latitude: number; longitude: number };

/**
 * Road route between two points. Only the two coordinates and the mode leave the app; the reader's
 * point is used for this one request and never stored or logged (DEC-07, 25 Oct 2026).
 * Throws `MlServiceError`; routing failures carry the service's `code` (OUT_OF_COVERAGE, NO_PATH, ...).
 */
export async function requestRoute(
    input: { origin: RoutePoint; destination: RoutePoint; mode: RouteMode },
    config: MlServiceConfig,
): Promise<MlRoute> {
    const point = ({ latitude, longitude }: RoutePoint) => ({ lat: latitude, lng: longitude });
    return postToMlService(
        "/api/routing/route",
        { origin: point(input.origin), destination: point(input.destination), mode: input.mode },
        routeSchema,
        { timeoutMs: ROUTE_TIMEOUT_MS, ...config },
    );
}
