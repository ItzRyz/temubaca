import { apiSuccess, ConflictError, NotFoundError, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { InvalidReviewTransitionError, reviewCommunity } from "@/lib/db/queries/verifications";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { communityIdParamSchema } from "@/lib/validation/common";
import { communityReviewSchema } from "@/lib/validation/schemas/verification.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/** Approve, reject, suspend, or reinstate a community. Every decision is recorded in `verifications`. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { communityId } = await parseParams(context.params, communityIdParamSchema);
    const input = await parseBody(request, communityReviewSchema);

    try {
        const result = await reviewCommunity({ communityId, reviewerId: admin.id, decision: input.decision, note: input.note });
        if (!result) throw new NotFoundError("Komunitas tidak ditemukan.");
        return apiSuccess(result);
    } catch (error) {
        if (error instanceof InvalidReviewTransitionError) {
            throw new ConflictError("Status komunitas sudah berubah. Muat ulang halaman lalu coba lagi.");
        }
        throw error;
    }
});
