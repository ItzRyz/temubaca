import { apiSuccess, NotFoundError, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { setListingVisibility } from "@/lib/db/queries/catalog-admin";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { listingIdParamSchema } from "@/lib/validation/common";
import { listingVisibilitySchema } from "@/lib/validation/schemas/book.schema";

type RouteContext = { params: Promise<{ listingId: string }> };

/** Hide a listing from public pages (reason required) or restore it. Recorded in `verifications`. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { listingId } = await parseParams(context.params, listingIdParamSchema);
    const input = await parseBody(request, listingVisibilitySchema);

    const result = await setListingVisibility({ listingId, adminId: admin.id, hidden: input.hidden, reason: input.reason });
    if (result.status === "not_found") throw new NotFoundError("Listing tidak ditemukan.");
    return apiSuccess({ id: listingId, hidden: input.hidden, changed: result.status === "updated" });
});
