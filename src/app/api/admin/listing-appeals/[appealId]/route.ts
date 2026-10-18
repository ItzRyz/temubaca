import { z } from "zod";

import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { reviewListingAppeal } from "@/lib/db/queries/listing-appeals";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ appealId: string }> };

const decisionSchema = z.object({
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().min(5, "Tulis alasan keputusan minimal 5 karakter.").max(500, "Alasan maksimal 500 karakter."),
}).strict();

/** Accept (listing shown again, recorded in verifications) or reject an appeal; the note goes to the owner. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { appealId } = await parseParams(context.params, z.object({ appealId: uuidSchema }));
    const input = await parseBody(request, decisionSchema);
    return apiSuccess(await reviewListingAppeal(appealId, admin.id, input));
});
