import { apiSuccess, NotFoundError, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { syncBook } from "@/features/catalog/sync-book";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { bookIdParamSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ bookId: string }> };

/**
 * Re-fetch one catalog record from its provider and complete it from the other provider.
 * Kept to a few calls per minute per admin: Open Library asks for about one request per second.
 */
export const POST = withApiHandler(async (_request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("catalog-sync", admin.id), limit: 6, windowSeconds: 60 });
    const { bookId } = await parseParams(context.params, bookIdParamSchema);

    const result = await syncBook(bookId, admin.id);
    if (result.status === "not_found") throw new NotFoundError("Rekaman buku tidak ditemukan.");
    return apiSuccess(result);
});
