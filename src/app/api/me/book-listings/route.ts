import {
    apiCreated,
    apiSuccess,
    NotFoundError,
    parseBody,
    requireApiRateLimit,
    requireApiUser,
    withApiHandler,
} from "@/lib/api";
import { db } from "@/lib/db";
import {
    createBookListing,
    listUserBookListings,
} from "@/lib/db/queries/books";
import { books } from "@/lib/db/schema";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { createBookListingSchema } from "@/lib/validation/schemas/book.schema";
import { eq } from "drizzle-orm";

export const GET = withApiHandler(async () => {
    const user = await requireApiUser();
    await requireApiRateLimit({
        key: createUserRateLimitKey("book-listing-read", user.id),
        ...RATE_LIMITS.READ,
    });

    return apiSuccess(await listUserBookListings(user.id));
});

export const POST = withApiHandler(async (request) => {
    const user = await requireApiUser();
    await requireApiRateLimit({
        key: createUserRateLimitKey("book-listing-write", user.id),
        ...RATE_LIMITS.WRITE,
    });
    const input = await parseBody(request, createBookListingSchema);
    const book = await db.query.books.findFirst({
        where: eq(books.id, input.bookId),
        columns: { id: true },
    });

    if (!book) {
        throw new NotFoundError("Book not found.");
    }

    const listing = await createBookListing({
        ...input,
        ownerId: user.id,
    });

    return apiCreated(listing);
});
