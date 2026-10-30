import { apiCreated, ForbiddenError, parseBody, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { LIBRARY_ACCESS_REQUESTS_OPEN } from "@/features/libraries/access";
import { createAccessRequest } from "@/lib/db/queries/libraries";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { createAccessRequestSchema } from "@/lib/validation/schemas/library.schema";

/** A reader asks a library for a book it holds (TB-023); the library must accept requests. Closed since 30 Okt 2026. */
export const POST = withApiHandler(async (request) => {
    if (!LIBRARY_ACCESS_REQUESTS_OPEN) throw new ForbiddenError("Pengajuan akses perpustakaan lewat TemuBaca tidak tersedia. Datang langsung ke perpustakaan atau periksa katalog resminya.");
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("library-access-write", user.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, createAccessRequestSchema);
    const created = await createAccessRequest(user.id, input);
    return apiCreated({ id: created.id, status: created.status });
});
