import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { setCuratedHolding } from "@/lib/db/queries/libraries";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { holdingInputSchema, libraryIdParamSchema, removeHoldingSchema } from "@/lib/validation/schemas/library.schema";

type RouteContext = { params: Promise<{ libraryId: string }> };

/** Admin curation of a library's collection (DEC-13 fallback source); recorded in the audit log. */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("libraries-write", admin.id), ...RATE_LIMITS.WRITE });
    const { libraryId } = await parseParams(context.params, libraryIdParamSchema);
    const input = await parseBody(request, holdingInputSchema);
    return apiSuccess(await setCuratedHolding(libraryId, admin.id, input.bookId, input));
});

export const DELETE = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("libraries-write", admin.id), ...RATE_LIMITS.WRITE });
    const { libraryId } = await parseParams(context.params, libraryIdParamSchema);
    const { bookId } = await parseBody(request, removeHoldingSchema);
    return apiSuccess(await setCuratedHolding(libraryId, admin.id, bookId, null));
});
