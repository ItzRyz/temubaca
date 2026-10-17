import { apiSuccess, parseBody, parseParams, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { actOnBorrowing } from "@/lib/db/queries/borrowing";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { borrowingActionSchema, borrowingIdSchema } from "@/lib/validation/schemas/borrowing.schema";

type RouteContext = { params: Promise<{ borrowingId: string }> };

/** Confirm a return, send an overdue reminder, or report a problem (opens a dispute). */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("borrow-write", user.id), ...RATE_LIMITS.WRITE });
    const { borrowingId } = await parseParams(context.params, borrowingIdSchema);
    const input = await parseBody(request, borrowingActionSchema);
    const result = await actOnBorrowing(borrowingId, user.id, input);
    return apiSuccess({ id: borrowingId, ...result });
});
