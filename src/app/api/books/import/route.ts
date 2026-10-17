import { apiSuccess, ConflictError, NotFoundError, parseBody, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { importExternalBook } from "@/features/catalog/external-search";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { externalBookImportSchema } from "@/lib/validation/schemas/book.schema";

/** Add an Open Library / Google Books record to the local catalog (signed-in readers only). */
export const POST = withApiHandler(async (request) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("book-import", user.id), limit: 10, windowSeconds: 60 });
    const input = await parseBody(request, externalBookImportSchema);

    const result = await importExternalBook(input.provider, input.providerId, user.id);
    if (result.status === "not_found") throw new NotFoundError("Buku tidak ditemukan di provider.");
    if (result.status === "failed") throw new ConflictError("Provider katalog sedang tidak dapat dihubungi. Coba lagi nanti.", { reason: result.reason });
    return apiSuccess({ bookId: result.bookId, imported: result.status === "imported" }, result.status === "imported" ? 201 : 200);
});
