import { apiSuccess, createPaginationMeta, parseQuery, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { listReports } from "@/lib/db/queries/reports";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { reportListQuerySchema } from "@/lib/validation/schemas/report.schema";

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
