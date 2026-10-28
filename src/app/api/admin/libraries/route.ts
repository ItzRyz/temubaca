import { apiSuccess, parseBody, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { createLibraryFromPlace } from "@/lib/db/queries/libraries";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { createLibrarySchema } from "@/lib/validation/schemas/library.schema";

/** Turn a library on the Peta Literasi into a TemuBaca library; recorded in the audit log. */
export const POST = withApiHandler(async (request) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("libraries-write", admin.id), ...RATE_LIMITS.WRITE });
    const { placeId } = await parseBody(request, createLibrarySchema);
    return apiSuccess(await createLibraryFromPlace(placeId, admin.id), 201);
});
