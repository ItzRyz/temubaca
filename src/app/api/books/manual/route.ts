import { apiSuccess, parseBody, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { createManualBook } from "@/features/catalog/manual-book";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { manualBookSchema } from "@/lib/validation/schemas/book.schema";

/** Add a book that is not in any catalog provider; duplicates by ISBN or title + author are reused. */
export const POST = withApiHandler(async (request) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("book-manual", user.id), limit: 5, windowSeconds: 60 });
    const input = await parseBody(request, manualBookSchema);
    const result = await createManualBook(input);
    return apiSuccess(result, result.created ? 201 : 200);
});
