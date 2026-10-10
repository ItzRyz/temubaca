import { eq } from "drizzle-orm";

import { apiCreated, BadRequestError, NotFoundError, parseBody, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { createReport } from "@/lib/db/queries/reports";
import { bookListings, books, communities, events, merchandiseListings, userProfiles } from "@/lib/db/schema";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { createReportSchema } from "@/lib/validation/schemas/report.schema";

export const POST = withApiHandler(async (request) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("report-write", user.id), ...RATE_LIMITS.REPORT });
    const input = await parseBody(request, createReportSchema);

    let exists = false;
    if (input.targetType === "BOOK") {
        exists = Boolean(await db.query.books.findFirst({ where: eq(books.id, input.targetId), columns: { id: true } }));
    } else if (input.targetType === "BOOK_LISTING") {
        exists = Boolean(await db.query.bookListings.findFirst({ where: eq(bookListings.id, input.targetId), columns: { id: true } }));
    } else if (input.targetType === "COMMUNITY") {
        exists = Boolean(await db.query.communities.findFirst({ where: eq(communities.id, input.targetId), columns: { id: true } }));
    } else if (input.targetType === "EVENT") {
        exists = Boolean(await db.query.events.findFirst({ where: eq(events.id, input.targetId), columns: { id: true } }));
    } else if (input.targetType === "MERCHANDISE_LISTING") {
        exists = Boolean(await db.query.merchandiseListings.findFirst({ where: eq(merchandiseListings.id, input.targetId), columns: { id: true } }));
    } else if (input.targetType === "USER") {
        if (input.targetId === user.id) throw new BadRequestError("Anda tidak dapat melaporkan akun sendiri.");
        exists = Boolean(await db.query.userProfiles.findFirst({ where: eq(userProfiles.id, input.targetId), columns: { id: true } }));
    } else {
        throw new BadRequestError("Jenis target ini tidak dapat dilaporkan.");
    }
    if (!exists) throw new NotFoundError("Konten yang dilaporkan tidak ditemukan.");

    const report = await createReport({ reporterId: user.id, ...input });
    return apiCreated({ id: report.id, status: report.status, createdAt: report.createdAt });
});
