import { apiSuccess, parseBody, parseParams, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { removeManagerHolding, upsertManagerHolding } from "@/lib/db/queries/libraries";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { holdingInputSchema, libraryIdParamSchema, removeHoldingSchema } from "@/lib/validation/schemas/library.schema";

type RouteContext = { params: Promise<{ libraryId: string }> };

/** A library's manager records a book in its collection, with copies and status (TB-023). */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("library-write", user.id), ...RATE_LIMITS.WRITE });
    const { libraryId } = await parseParams(context.params, libraryIdParamSchema);
    const input = await parseBody(request, holdingInputSchema);
    return apiSuccess(await upsertManagerHolding(libraryId, user.id, input));
});

export const DELETE = withApiHandler(async (request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("library-write", user.id), ...RATE_LIMITS.WRITE });
    const { libraryId } = await parseParams(context.params, libraryIdParamSchema);
    const { bookId } = await parseBody(request, removeHoldingSchema);
    return apiSuccess(await removeManagerHolding(libraryId, user.id, bookId));
});
