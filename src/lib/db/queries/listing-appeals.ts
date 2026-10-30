import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { ConflictError, NotFoundError } from "@/lib/api/errors";

import { db } from "../client";
import { bookListings, books, listingAppeals, userProfiles, verifications } from "../schema";
import { managesListing } from "./listing-access";

export type AppealFile = { path: string; name: string; type: string; size: number };

function isUniqueViolation(error: unknown) {
    const code = (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
    return code === "23505";
}

/** Owner appeal; only for their own listing while an admin keeps it hidden. */
export async function createListingAppeal(ownerId: string, listingId: string, input: { reason: string; details: string }, file: AppealFile | null) {
    return db.transaction(async (tx) => {
        const [listing] = await tx.select({ ownerId: bookListings.ownerId, communityId: bookListings.communityId, hiddenAt: bookListings.hiddenAt })
            .from(bookListings).where(eq(bookListings.id, listingId)).for("update");
        // A community's copy may be appealed by any of its managers.
        if (!listing || !(await managesListing(tx, ownerId, listing))) throw new NotFoundError("Listing tidak ditemukan.");
        if (!listing.hiddenAt) throw new ConflictError("Listing ini tidak sedang disembunyikan.");
        try {
            const [appeal] = await tx.insert(listingAppeals).values({
                listingId,
                ownerId,
                reason: input.reason,
                details: input.details,
                filePath: file?.path ?? null,
                fileName: file?.name ?? null,
                fileType: file?.type ?? null,
                fileSize: file?.size ?? null,
            }).returning({ id: listingAppeals.id });
            return appeal;
        } catch (error) {
            if (isUniqueViolation(error)) throw new ConflictError("Banding untuk listing ini masih ditinjau.");
            throw error;
        }
    });
}

/**
 * Admin decision. Accepting restores the listing and records an APPROVED verification in the same
 * transaction; rejecting keeps it hidden. Either way the note is shown to the owner.
 */
export async function reviewListingAppeal(appealId: string, adminId: string, input: { decision: "APPROVE" | "REJECT"; note: string }) {
    return db.transaction(async (tx) => {
        const [appeal] = await tx.select({ id: listingAppeals.id, status: listingAppeals.status, listingId: listingAppeals.listingId })
            .from(listingAppeals).where(eq(listingAppeals.id, appealId)).for("update");
        if (!appeal) throw new NotFoundError("Banding tidak ditemukan.");
        if (appeal.status !== "PENDING") throw new ConflictError("Banding ini sudah diputuskan.");
        const now = new Date();
        await tx.update(listingAppeals)
            .set({ status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewerId: adminId, reviewNote: input.note, reviewedAt: now })
            .where(eq(listingAppeals.id, appealId));
        if (input.decision === "APPROVE") {
            await tx.update(bookListings).set({ hiddenAt: null, hiddenReason: null, hiddenById: null, updatedAt: now }).where(eq(bookListings.id, appeal.listingId));
            await tx.insert(verifications).values({
                targetType: "BOOK_LISTING",
                targetId: appeal.listingId,
                status: "APPROVED",
                reviewerId: adminId,
                note: `Banding diterima: ${input.note}`,
                reviewedAt: now,
                createdAt: now,
                updatedAt: now,
            });
        }
        return { id: appealId, listingId: appeal.listingId, decision: input.decision };
    });
}

/** Latest appeal per listing for the owner's Buku Saya rows. */
export async function latestAppealsForListings(listingIds: string[]) {
    if (listingIds.length === 0) return new Map<string, typeof listingAppeals.$inferSelect>();
    const rows = await db.select().from(listingAppeals).where(inArray(listingAppeals.listingId, listingIds)).orderBy(desc(listingAppeals.createdAt));
    const latest = new Map<string, typeof listingAppeals.$inferSelect>();
    for (const row of rows) if (!latest.has(row.listingId)) latest.set(row.listingId, row);
    return latest;
}

export function listAppealsForListing(listingId: string) {
    return db.select({
        id: listingAppeals.id,
        reason: listingAppeals.reason,
        details: listingAppeals.details,
        fileName: listingAppeals.fileName,
        fileSize: listingAppeals.fileSize,
        status: listingAppeals.status,
        reviewNote: listingAppeals.reviewNote,
        createdAt: listingAppeals.createdAt,
        reviewedAt: listingAppeals.reviewedAt,
    }).from(listingAppeals).where(eq(listingAppeals.listingId, listingId)).orderBy(desc(listingAppeals.createdAt)).limit(10);
}

/** Open appeals, oldest first, for the admin queue. */
export function listPendingAppeals(limit = 50) {
    return db.select({ id: listingAppeals.id, listingId: listingAppeals.listingId, title: books.title, ownerName: userProfiles.displayName, createdAt: listingAppeals.createdAt })
        .from(listingAppeals)
        .innerJoin(bookListings, eq(bookListings.id, listingAppeals.listingId))
        .innerJoin(books, eq(books.id, bookListings.bookId))
        .leftJoin(userProfiles, eq(userProfiles.id, listingAppeals.ownerId))
        .where(eq(listingAppeals.status, "PENDING"))
        .orderBy(asc(listingAppeals.createdAt))
        .limit(limit);
}

export async function findAppealFile(appealId: string) {
    const [row] = await db.select({ filePath: listingAppeals.filePath, fileName: listingAppeals.fileName, ownerId: bookListings.ownerId, communityId: bookListings.communityId })
        .from(listingAppeals).innerJoin(bookListings, eq(bookListings.id, listingAppeals.listingId))
        .where(and(eq(listingAppeals.id, appealId)));
    return row ?? null;
}

export async function countPendingAppeals() {
    const [row] = await db.select({ total: count() }).from(listingAppeals).where(eq(listingAppeals.status, "PENDING"));
    return row?.total ?? 0;
}
