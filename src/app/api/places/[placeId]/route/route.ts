import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { NotFoundError } from "@/lib/api/errors";
import { clientIp } from "@/features/catalog/client-ip";
import { googleMapsUrl } from "@/features/places/places";
import { routeOutcomeMessages, routeOutcomeOf } from "@/features/places/route";
import { findPublicPlace } from "@/lib/db/queries/places";
import { isMlServiceConfigured, MlServiceError, routeBetween } from "@/lib/ml/client";
import { createIpRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { placeIdParamSchema, routeRequestSchema } from "@/lib/validation/schemas/place.schema";

type RouteContext = { params: Promise<{ placeId: string }> };

/**
 * A road route from the reader's point to a public place on the Peta Literasi (TB-064, DEC-07).
 * The reader's point arrives in the body only when they ask for a route, goes to the ML Service for
 * this one request, and is never stored or logged. A route that cannot be made is a normal outcome,
 * not an error, and every answer carries the Google Maps link.
 */
export const POST = withApiHandler(async (request, context: RouteContext) => {
    await requireApiRateLimit({ key: createIpRateLimitKey("route", await clientIp()), ...RATE_LIMITS.ROUTE });
    const { placeId } = await parseParams(context.params, placeIdParamSchema);
    const { origin, mode } = await parseBody(request, routeRequestSchema);

    const place = await findPublicPlace(placeId);
    if (!place) throw new NotFoundError("Tempat tidak ditemukan di peta.");
    const externalUrl = googleMapsUrl(place.latitude, place.longitude);

    if (!isMlServiceConfigured()) {
        return apiSuccess({ outcome: "UNAVAILABLE" as const, message: routeOutcomeMessages.UNAVAILABLE, externalUrl });
    }

    try {
        const route = await routeBetween({ origin, destination: { latitude: place.latitude, longitude: place.longitude }, mode });
        return apiSuccess({
            outcome: "ROUTE" as const,
            externalUrl,
            route: {
                mode: route.mode,
                distanceM: route.distance_m,
                durationS: route.duration_s_estimate,
                // GeoJSON order, [longitude, latitude].
                coordinates: route.geometry.coordinates,
                viaStreets: route.via_streets,
                warnings: route.warnings,
                graphVersion: route.graph_version,
            },
        });
    } catch (error) {
        const mlError = error instanceof MlServiceError ? error : null;
        const outcome = routeOutcomeOf(mlError?.code);
        if (outcome === "UNAVAILABLE") {
            // The failure kind and code only, never the points.
            console.error("[ML_SERVICE_ERROR]", { kind: mlError?.kind ?? "unknown", code: mlError?.code });
        }
        return apiSuccess({ outcome, message: routeOutcomeMessages[outcome], externalUrl });
    }
});
