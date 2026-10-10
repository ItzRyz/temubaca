import { apiSuccess, NotFoundError, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { updateReportReview } from "@/lib/db/queries/reports";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { reportIdParamSchema } from "@/lib/validation/schemas/report.schema";
import { updateReportSchema } from "@/lib/validation/schemas/report.schema";

type RouteContext = { params: Promise<{ reportId: string }> };

export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { reportId } = await parseParams(context.params, reportIdParamSchema);
    const input = await parseBody(request, updateReportSchema);
    const report = await updateReportReview({ reportId, reviewerId: admin.id, ...input });
    if (!report) throw new NotFoundError("Report not found.");
    return apiSuccess(report);
});
