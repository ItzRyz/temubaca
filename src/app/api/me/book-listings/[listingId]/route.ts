import {
    apiSuccess,
    ConflictError,
    NotFoundError,
    parseBody,
    parseParams,
    requireApiRateLimit,
    withApiHandler,
} from "@/lib/api";
import { listingDeletionBlockerMessage } from "@/features/book-listings/listing-deletion";
import { deleteBookListing, updateBookListing } from "@/lib/db/queries/books";
import { requireBookListingOwner } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { bookListingIdSchema, updateBookListingSchema } from "@/lib/validation/schemas/book.schema";

type RouteContext = {
    params: Promise<{ listingId: string }>;
};

export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const { listingId } = await parseParams(context.params, bookListingIdSchema);
    const user = await requireBookListingOwner(listingId);
    await requireApiRateLimit({
        key: createUserRateLimitKey("book-listing-write", user.id),
        ...RATE_LIMITS.WRITE,
    });
    const input = await parseBody(request, updateBookListingSchema);
    const listing = await updateBookListing(listingId, user.id, input);

    return apiSuccess(listing);
});

export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { listingId } = await parseParams(context.params, bookListingIdSchema);
    const user = await requireBookListingOwner(listingId);
    await requireApiRateLimit({
        key: createUserRateLimitKey("book-listing-write", user.id),
        ...RATE_LIMITS.WRITE,
    });
    const result = await deleteBookListing(listingId, user.id);

    if (result.status === "not_found") {
        throw new NotFoundError("Listing tidak ditemukan.");
    }
    if (result.status === "blocked") {
        throw new ConflictError(listingDeletionBlockerMessage[result.reason]);
    }

    return apiSuccess({ id: result.id });
});
