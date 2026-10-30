import { z } from "zod";

import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { decideCommunityContent } from "@/lib/db/queries/community-content";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ type: string; id: string }> };

const paramsSchema = z.object({ type: z.enum(["event", "merchandise"]), id: uuidSchema });
const decisionSchema = z.discriminatedUnion("decision", [
    z.object({ decision: z.literal("APPROVE") }).strict(),
    z.object({ decision: z.literal("REJECT"), note: z.string().trim().min(5, "Tulis alasan penolakan minimal 5 karakter.").max(300, "Alasan maksimal 300 karakter.") }).strict(),
]);

/** Approve or refuse an event or merchandise item waiting for review (settings, 30 Okt 2026). */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const { type, id } = await parseParams(context.params, paramsSchema);
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, decisionSchema);
    const result = await decideCommunityContent(type, id, admin.id, input.decision === "APPROVE" ? { approve: true } : { approve: false, note: input.note });
    return apiSuccess(result);
});
