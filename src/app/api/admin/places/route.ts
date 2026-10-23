import { apiSuccess, parseBody, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { createCuratedPlace } from "@/lib/db/queries/places";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { curatedPlaceSchema } from "@/lib/validation/schemas/place.schema";

/** Add a library or public meeting point to the Peta Literasi; recorded in the audit log. */
export const POST = withApiHandler(async (request) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("places-write", admin.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, curatedPlaceSchema);
    return apiSuccess(await createCuratedPlace(input, admin.id), 201);
});
