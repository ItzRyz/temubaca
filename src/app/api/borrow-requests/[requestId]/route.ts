import { apiSuccess, parseBody, parseParams, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { actOnBorrowRequest } from "@/lib/db/queries/borrowing";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { borrowRequestActionSchema, borrowRequestIdSchema } from "@/lib/validation/schemas/borrowing.schema";

type RouteContext = { params: Promise<{ requestId: string }> };

/** Accept, reject, cancel, or confirm the handover of a request; who may do what follows DEC-02. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("borrow-write", user.id), ...RATE_LIMITS.WRITE });
    const { requestId } = await parseParams(context.params, borrowRequestIdSchema);
    const input = await parseBody(request, borrowRequestActionSchema);
    const result = await actOnBorrowRequest(requestId, user.id, input);
    return apiSuccess({ id: requestId, ...result });
});
