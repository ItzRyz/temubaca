import { apiSuccess, ConflictError, parseBody, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { syncOneSearchForBook } from "@/features/libraries/sync-onesearch";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { oneSearchSyncSchema } from "@/lib/validation/schemas/library.schema";

/** Ask OneSearch now for one book's libraries; refused while ONESEARCH_ENABLED is off (Perpusnas permission). */
export const POST = withApiHandler(async (request) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("libraries-write", admin.id), ...RATE_LIMITS.WRITE });
    const { bookId } = await parseBody(request, oneSearchSyncSchema);
    const result = await syncOneSearchForBook(bookId, { force: true });
    if (result.status === "disabled") throw new ConflictError("Integrasi OneSearch belum diaktifkan; tunggu izin tertulis Perpusnas.");
    return apiSuccess(result);
});
