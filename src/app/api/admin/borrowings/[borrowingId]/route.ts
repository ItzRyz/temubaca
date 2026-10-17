import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { resolveBorrowingDispute } from "@/lib/db/queries/borrowing";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { borrowingIdSchema, resolveBorrowingDisputeSchema } from "@/lib/validation/schemas/borrowing.schema";

type RouteContext = { params: Promise<{ borrowingId: string }> };

/** Settle a loan dispute as returned or lost; recorded in the loan history and `admin_audit_logs`. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { borrowingId } = await parseParams(context.params, borrowingIdSchema);
    const input = await parseBody(request, resolveBorrowingDisputeSchema);
    const result = await resolveBorrowingDispute(borrowingId, admin.id, input);
    return apiSuccess({ id: borrowingId, ...result });
});
