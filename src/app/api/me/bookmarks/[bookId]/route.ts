import {
    apiNoContent,
    apiSuccess,
    NotFoundError,
    parseParams,
    requireApiRateLimit,
    requireApiUser,
    withApiHandler,
} from "@/lib/api";
import { db } from "@/lib/db";
import { createBookmark, deleteBookmark } from "@/lib/db/queries/bookmarks";
import { books } from "@/lib/db/schema";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { bookmarkBookIdSchema } from "@/lib/validation/schemas/bookmark.schema";
import { eq } from "drizzle-orm";

type RouteContext = {
    params: Promise<{ bookId: string }>;
};

export const PUT = withApiHandler(async (_request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({
        key: createUserRateLimitKey("bookmark-write", user.id),
        ...RATE_LIMITS.WRITE,
    });
    const { bookId } = await parseParams(
        context.params,
        bookmarkBookIdSchema,
    );
    const book = await db.query.books.findFirst({
        where: eq(books.id, bookId),
        columns: { id: true },
    });

    if (!book) {
        throw new NotFoundError("Book not found.");
    }

    await createBookmark(user.id, bookId);

    return apiSuccess({ bookmarked: true });
});

export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({
        key: createUserRateLimitKey("bookmark-write", user.id),
        ...RATE_LIMITS.WRITE,
    });
    const { bookId } = await parseParams(
        context.params,
        bookmarkBookIdSchema,
    );

    await deleteBookmark(user.id, bookId);

    return apiNoContent();
});
