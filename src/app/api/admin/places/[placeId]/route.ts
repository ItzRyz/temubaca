import { apiSuccess, NotFoundError, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { setPlaceHidden, updateCuratedPlace } from "@/lib/db/queries/places";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { curatedPlaceSchema, placeIdParamSchema, placeVisibilitySchema } from "@/lib/validation/schemas/place.schema";

type RouteContext = { params: Promise<{ placeId: string }> };

/** Edit a curated library or meeting point. */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("places-write", admin.id), ...RATE_LIMITS.WRITE });
    const { placeId } = await parseParams(context.params, placeIdParamSchema);
    const input = await parseBody(request, curatedPlaceSchema);
    const place = await updateCuratedPlace(placeId, input, admin.id);
    if (!place) throw new NotFoundError("Tempat tidak ditemukan.");
    return apiSuccess(place);
});

/** Hide or restore any place on the map, community pins included. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("places-write", admin.id), ...RATE_LIMITS.WRITE });
    const { placeId } = await parseParams(context.params, placeIdParamSchema);
    const input = await parseBody(request, placeVisibilitySchema);
    const place = await setPlaceHidden(placeId, input.action === "hide" ? { reason: input.reason } : null, admin.id);
    if (!place) throw new NotFoundError("Tempat tidak ditemukan.");
    return apiSuccess(place);
});
