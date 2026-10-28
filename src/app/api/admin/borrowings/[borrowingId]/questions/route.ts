import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { askDisputeParty } from "@/lib/db/queries/borrowing";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { askDisputePartySchema, borrowingIdSchema } from "@/lib/validation/schemas/borrowing.schema";

type RouteContext = { params: Promise<{ borrowingId: string }> };

/** Ask one or both parties of an open dispute; recorded in the loan history and shown to the asked party. */
export const POST = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { borrowingId } = await parseParams(context.params, borrowingIdSchema);
    const input = await parseBody(request, askDisputePartySchema);
    const result = await askDisputeParty(borrowingId, admin.id, input);
    return apiSuccess({ id: borrowingId, ...result });
});
