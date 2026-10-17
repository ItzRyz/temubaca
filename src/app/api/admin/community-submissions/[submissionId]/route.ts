import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { reviewReverification } from "@/lib/db/queries/community-management";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation/common";
import { reverificationReviewSchema } from "@/lib/validation/schemas/community-management.schema";
import { z } from "zod";

type RouteContext = { params: Promise<{ submissionId: string }> };

/** Confirm or dismiss a re-verification request of a VERIFIED community; the status itself never drops. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { submissionId } = await parseParams(context.params, z.object({ submissionId: uuidSchema }));
    const input = await parseBody(request, reverificationReviewSchema);
    return apiSuccess(await reviewReverification(submissionId, admin.id, input));
});
