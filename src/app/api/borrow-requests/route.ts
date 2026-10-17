import { apiCreated, parseBody, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { createBorrowRequest } from "@/lib/db/queries/borrowing";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { createBorrowRequestSchema } from "@/lib/validation/schemas/borrowing.schema";

/** Figma "Ajukan Pinjam" (299:2608); the listing rules are checked inside the transaction. */
export const POST = withApiHandler(async (request) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("borrow-write", user.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, createBorrowRequestSchema);
    const created = await createBorrowRequest(user.id, input);
    return apiCreated({ id: created.id, status: "PENDING" });
});
