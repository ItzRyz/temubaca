import {
    apiSuccess,
    parseBody,
    parseParams,
    requireApiRateLimit,
    withApiHandler,
} from "@/lib/api";
import { updateBookListing } from "@/lib/db/queries/books";
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
