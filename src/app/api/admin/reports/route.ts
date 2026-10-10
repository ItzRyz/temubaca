import { apiSuccess, createPaginationMeta, NotFoundError, parseBody, parseQuery, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { listReports, updateReportsReview } from "@/lib/db/queries/reports";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { reportListQuerySchema, updateReportBatchSchema } from "@/lib/validation/schemas/report.schema";

export const GET = withApiHandler(async (request) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-read", admin.id), ...RATE_LIMITS.READ });
    const query = parseQuery(request, reportListQuerySchema);
    const result = await listReports({
        status: query.status,
        targetType: query.targetType,
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
    });
    return apiSuccess(result.items, 200, createPaginationMeta(query.page, query.limit, result.total));
});

/** Apply one decision to every report about the same item. */
export const PATCH = withApiHandler(async (request) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { reportIds, ...input } = await parseBody(request, updateReportBatchSchema);
    const updated = await updateReportsReview({ reportIds, reviewerId: admin.id, ...input });
    if (updated.length === 0) throw new NotFoundError("Report not found.");
    return apiSuccess({ updated: updated.length });
});
