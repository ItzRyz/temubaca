import "server-only";

import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
    actionBlocker,
    AUTO_REJECTION_REASON,
    dueDateFrom,
    loanDayChoices,
    loanState,
    maxLoanDaysFromRules,
    meetingPointsOf,
    type LoanAction,
    type LoanRole,
    type LoanSnapshot,
    type LoanState,
} from "@/features/borrowing/lifecycle";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import type { BorrowingActionInput, BorrowRequestActionInput, CreateBorrowRequestInput } from "@/lib/validation/schemas/borrowing.schema";

import { db } from "../client";
import {
    adminAuditLogs,
    bookListings,
    books,
    borrowEvents,
    borrowings,
    borrowRequests,
    userProfiles,
} from "../schema";

const requesterProfile = alias(userProfiles, "requester_profile");
const ownerProfile = alias(userProfiles, "owner_profile");
const reporterProfile = alias(userProfiles, "reporter_profile");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type EventType = (typeof borrowEvents.$inferInsert)["type"];

function isUniqueViolation(error: unknown) {
    const code = (error as { code?: string; cause?: { code?: string } })?.code
        ?? (error as { cause?: { code?: string } })?.cause?.code;
    return code === "23505";
}

async function logEvent(tx: Tx, requestId: string, actorId: string | null, type: EventType, note?: string | null) {
    await tx.insert(borrowEvents).values({ requestId, actorId, type, note: note ?? null });
}

function assertAllowed(loan: LoanSnapshot, role: LoanRole, action: LoanAction, now: Date) {
    const blocker = actionBlocker(loan, role, action, now);
    if (blocker) throw new ConflictError(blocker);
}

export async function createBorrowRequest(requesterId: string, input: CreateBorrowRequestInput) {
    return db.transaction(async (tx) => {
        const [listing] = await tx
            .select({
                id: bookListings.id,
                ownerId: bookListings.ownerId,
                availability: bookListings.availability,
                hiddenAt: bookListings.hiddenAt,
                publicLocation: bookListings.publicLocation,
                borrowingRules: bookListings.borrowingRules,
                ownerSuspendedAt: userProfiles.suspendedAt,
                ownerDeletionRequestedAt: userProfiles.deletionRequestedAt,
            })
            .from(bookListings)
            .innerJoin(userProfiles, eq(userProfiles.id, bookListings.ownerId))
            .where(eq(bookListings.id, input.listingId))
            .for("update", { of: bookListings });

        if (!listing || listing.hiddenAt || listing.ownerSuspendedAt || listing.ownerDeletionRequestedAt) throw new NotFoundError("Salinan buku tidak ditemukan.");
        if (listing.ownerId === requesterId) throw new ForbiddenError("Anda tidak dapat meminjam buku milik sendiri.");
        if (listing.availability !== "AVAILABLE") throw new ConflictError("Salinan ini sedang tidak ditawarkan.");

        const maxDays = maxLoanDaysFromRules(listing.borrowingRules);
        if (!loanDayChoices(maxDays).includes(input.loanDays)) {
            throw new ConflictError(`Lama pinjam maksimal ${maxDays} hari sesuai aturan pemilik.`);
        }
        const points = meetingPointsOf(listing.publicLocation);
        if (points.length > 0 && (!input.meetingPoint || !points.includes(input.meetingPoint))) {
            throw new ConflictError("Pilih salah satu titik temu publik dari pemilik.");
        }

        try {
            const [request] = await tx
                .insert(borrowRequests)
                .values({
                    listingId: listing.id,
                    requesterId,
                    note: input.note ?? null,
                    meetingPoint: points.length > 0 ? input.meetingPoint! : null,
                    loanDays: input.loanDays,
                    preferredTime: input.preferredTime ?? null,
                })
                .returning({ id: borrowRequests.id });
            await logEvent(tx, request.id, requesterId, "REQUESTED");
            return request;
        } catch (error) {
            if (isUniqueViolation(error)) throw new ConflictError("Anda sudah punya permintaan aktif untuk salinan ini.");
            throw error;
        }
    });
}

/** Locks the request, its listing, and its borrowing (if any) and works out the caller's role. */
async function lockLoan(tx: Tx, where: { requestId: string } | { borrowingId: string }, userId: string) {
    const [row] = await tx
        .select({
            request: borrowRequests,
            listingId: bookListings.id,
            ownerId: bookListings.ownerId,
            availability: bookListings.availability,
            borrowing: borrowings,
        })
        .from(borrowRequests)
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
        .where("requestId" in where ? eq(borrowRequests.id, where.requestId) : eq(borrowings.id, where.borrowingId))
        .for("update", { of: [borrowRequests, bookListings] });

    if (!row) throw new NotFoundError("Pinjaman tidak ditemukan.");
    const role: LoanRole | null = row.ownerId === userId ? "owner" : row.request.requesterId === userId ? "requester" : null;
    if (!role) throw new NotFoundError("Pinjaman tidak ditemukan.");
    if (row.borrowing) {
        // Row locks on the outer side of a left join are not allowed, so take the borrowing lock separately.
        await tx.select({ id: borrowings.id }).from(borrowings).where(eq(borrowings.id, row.borrowing.id)).for("update");
    }
    return { ...row, role };
}

function snapshotOf(request: typeof borrowRequests.$inferSelect, borrowing: typeof borrowings.$inferSelect | null): LoanSnapshot {
    return {
        requestStatus: request.status,
        borrowingStatus: borrowing?.status ?? null,
        dueAt: borrowing?.dueAt ?? null,
        ownerHandoverAt: request.ownerHandoverAt,
        requesterHandoverAt: request.requesterHandoverAt,
        ownerReturnAt: borrowing?.ownerReturnAt ?? null,
        requesterReturnAt: borrowing?.requesterReturnAt ?? null,
        lastReminderAt: borrowing?.lastReminderAt ?? null,
    };
}

export async function actOnBorrowRequest(requestId: string, userId: string, input: BorrowRequestActionInput) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const { request, role, listingId, availability, borrowing } = await lockLoan(tx, { requestId }, userId);
        assertAllowed(snapshotOf(request, borrowing), role, input.action, now);

        switch (input.action) {
            case "approve": {
                if (availability !== "AVAILABLE") throw new ConflictError("Tawarkan salinan ini lagi sebelum menerima permintaan.");
                await tx.update(borrowRequests).set({ status: "APPROVED", respondedAt: now, updatedAt: now }).where(eq(borrowRequests.id, request.id));
                await tx.update(bookListings).set({ availability: "RESERVED", updatedAt: now }).where(eq(bookListings.id, listingId));
                await logEvent(tx, request.id, userId, "APPROVED");
                const others = await tx
                    .update(borrowRequests)
                    .set({ status: "REJECTED", rejectionReason: AUTO_REJECTION_REASON, respondedAt: now, updatedAt: now })
                    .where(and(eq(borrowRequests.listingId, listingId), eq(borrowRequests.status, "PENDING"), ne(borrowRequests.id, request.id)))
                    .returning({ id: borrowRequests.id });
                for (const other of others) await logEvent(tx, other.id, userId, "REJECTED", "Otomatis: permintaan lain untuk salinan ini diterima.");
                return { status: "APPROVED" as const };
            }
            case "reject": {
                await tx
                    .update(borrowRequests)
                    .set({ status: "REJECTED", rejectionReason: input.reason, responseNote: input.note ?? null, respondedAt: now, updatedAt: now })
                    .where(eq(borrowRequests.id, request.id));
                if (input.markUnavailable && availability === "AVAILABLE") {
                    await tx.update(bookListings).set({ availability: "UNAVAILABLE", updatedAt: now }).where(eq(bookListings.id, listingId));
                }
                await logEvent(tx, request.id, userId, "REJECTED", input.reason);
                return { status: "REJECTED" as const };
            }
            case "cancel": {
                const wasApproved = request.status === "APPROVED";
                await tx
                    .update(borrowRequests)
                    .set({ status: "CANCELLED", cancelledById: userId, updatedAt: now })
                    .where(eq(borrowRequests.id, request.id));
                if (wasApproved) await tx.update(bookListings).set({ availability: "AVAILABLE", updatedAt: now }).where(eq(bookListings.id, listingId));
                await logEvent(tx, request.id, userId, "CANCELLED", role === "owner" ? "Dibatalkan pemilik." : "Dibatalkan peminjam.");
                return { status: "CANCELLED" as const };
            }
            case "confirm_handover": {
                const ownerAt = role === "owner" ? now : request.ownerHandoverAt;
                const requesterAt = role === "requester" ? now : request.requesterHandoverAt;
                await logEvent(tx, request.id, userId, "HANDOVER_CONFIRMED", role === "owner" ? "Pemilik" : "Peminjam");
                if (!ownerAt || !requesterAt) {
                    await tx.update(borrowRequests).set({ ownerHandoverAt: ownerAt, requesterHandoverAt: requesterAt, updatedAt: now }).where(eq(borrowRequests.id, request.id));
                    return { status: "AWAITING_HANDOVER" as const };
                }
                await tx
                    .update(borrowRequests)
                    .set({ status: "COMPLETED", ownerHandoverAt: ownerAt, requesterHandoverAt: requesterAt, updatedAt: now })
                    .where(eq(borrowRequests.id, request.id));
                await tx.insert(borrowings).values({ requestId: request.id, status: "ACTIVE", handedOverAt: now, dueAt: dueDateFrom(now, request.loanDays) });
                await logEvent(tx, request.id, null, "BORROWING_STARTED");
                return { status: "ACTIVE" as const };
            }
            default:
                throw new ConflictError("Tindakan ini bukan untuk permintaan pinjam.");
        }
    });
}

export async function actOnBorrowing(borrowingId: string, userId: string, input: BorrowingActionInput) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const { request, role, listingId, borrowing } = await lockLoan(tx, { borrowingId }, userId);
        if (!borrowing) throw new NotFoundError("Pinjaman tidak ditemukan.");
        assertAllowed(snapshotOf(request, borrowing), role, input.action, now);

        switch (input.action) {
            case "confirm_return": {
                const ownerAt = role === "owner" ? now : borrowing.ownerReturnAt;
                const requesterAt = role === "requester" ? now : borrowing.requesterReturnAt;
                await logEvent(tx, request.id, userId, "RETURN_CONFIRMED", role === "owner" ? "Pemilik" : "Peminjam");
                if (!ownerAt || !requesterAt) {
                    await tx.update(borrowings).set({ ownerReturnAt: ownerAt, requesterReturnAt: requesterAt, updatedAt: now }).where(eq(borrowings.id, borrowing.id));
                    return { status: loanState({ ...snapshotOf(request, borrowing) }, now) };
                }
                await tx
                    .update(borrowings)
                    .set({ status: "RETURNED", ownerReturnAt: ownerAt, requesterReturnAt: requesterAt, returnedAt: now, updatedAt: now })
                    .where(eq(borrowings.id, borrowing.id));
                await tx.update(bookListings).set({ availability: "AVAILABLE", updatedAt: now }).where(eq(bookListings.id, listingId));
                await logEvent(tx, request.id, null, "RETURNED");
                return { status: "RETURNED" as const };
            }
            case "remind": {
                await tx.update(borrowings).set({ lastReminderAt: now, updatedAt: now }).where(eq(borrowings.id, borrowing.id));
                await logEvent(tx, request.id, userId, "REMINDER_SENT");
                return { status: "OVERDUE" as const };
            }
            case "report_problem": {
                await tx
                    .update(borrowings)
                    .set({ status: "DISPUTED", disputedAt: now, disputedById: userId, disputeReason: input.reason, disputeDetails: input.details, updatedAt: now })
                    .where(eq(borrowings.id, borrowing.id));
                await logEvent(tx, request.id, userId, "DISPUTE_OPENED", input.reason);
                return { status: "DISPUTED" as const };
            }
        }
    });
}

export async function resolveBorrowingDispute(borrowingId: string, adminId: string, input: { outcome: "RETURNED" | "LOST"; note: string }) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
            .select({ borrowing: borrowings, listingId: borrowRequests.listingId })
            .from(borrowings)
            .innerJoin(borrowRequests, eq(borrowRequests.id, borrowings.requestId))
            .where(eq(borrowings.id, borrowingId))
            .for("update", { of: borrowings });
        if (!row) throw new NotFoundError("Pinjaman tidak ditemukan.");
        if (row.borrowing.status !== "DISPUTED") throw new ConflictError("Sengketa ini sudah diputuskan.");

        await tx
            .update(borrowings)
            .set({
                status: input.outcome,
                returnedAt: input.outcome === "RETURNED" ? now : null,
                resolvedAt: now,
                resolvedById: adminId,
                resolutionNote: input.note,
                updatedAt: now,
            })
            .where(eq(borrowings.id, borrowingId));
        // A returned copy can be offered again; a lost one stays off the catalog until the owner decides.
        await tx
            .update(bookListings)
            .set({ availability: input.outcome === "RETURNED" ? "AVAILABLE" : "UNAVAILABLE", updatedAt: now })
            .where(eq(bookListings.id, row.listingId));
        await logEvent(tx, row.borrowing.requestId, adminId, "DISPUTE_RESOLVED", input.outcome === "RETURNED" ? "Dinyatakan dikembalikan" : "Dinyatakan hilang");
        await tx.insert(adminAuditLogs).values({
            actorId: adminId,
            action: "BORROWING_DISPUTE_RESOLVED",
            targetType: "BORROWING",
            targetId: borrowingId,
            note: input.note,
            metadata: { outcome: input.outcome },
        });
        return { status: input.outcome };
    });
}

export type LoanItem = {
    requestId: string;
    borrowingId: string | null;
    role: LoanRole;
    state: LoanState;
    snapshot: LoanSnapshot;
    listingId: string;
    book: { id: string; title: string; authors: string[]; coverUrl: string | null };
    otherParty: { id: string; displayName: string };
    meetingPoint: string | null;
    loanDays: number;
    preferredTime: string | null;
    note: string | null;
    rejectionReason: string | null;
    responseNote: string | null;
    requestedAt: Date;
    respondedAt: Date | null;
    updatedAt: Date;
    handedOverAt: Date | null;
    dueAt: Date | null;
    returnedAt: Date | null;
    disputeReason: string | null;
    disputedAt: Date | null;
    resolutionNote: string | null;
    cancelledByOther: boolean;
};

/** Every loan the user takes part in, as owner ("Dipinjamkan ke kawan") or borrower ("Saya pinjam"). */
export async function listLoansForUser(userId: string, now = new Date()): Promise<LoanItem[]> {
    const rows = await db
        .select({
            request: borrowRequests,
            borrowing: borrowings,
            listingId: bookListings.id,
            ownerId: bookListings.ownerId,
            book: { id: books.id, title: books.title, authors: books.authors, coverUrl: books.coverUrl },
            requesterName: requesterProfile.displayName,
            ownerName: ownerProfile.displayName,
        })
        .from(borrowRequests)
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .innerJoin(books, eq(books.id, bookListings.bookId))
        .innerJoin(requesterProfile, eq(requesterProfile.id, borrowRequests.requesterId))
        .innerJoin(ownerProfile, eq(ownerProfile.id, bookListings.ownerId))
        .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
        .where(or(eq(borrowRequests.requesterId, userId), eq(bookListings.ownerId, userId)))
        .orderBy(desc(borrowRequests.updatedAt))
        .limit(200);

    return rows.map(({ request, borrowing, listingId, ownerId, book, requesterName, ownerName }) => {
        const role: LoanRole = ownerId === userId ? "owner" : "requester";
        const snapshot = snapshotOf(request, borrowing);
        return {
            requestId: request.id,
            borrowingId: borrowing?.id ?? null,
            role,
            state: loanState(snapshot, now),
            snapshot,
            listingId,
            book,
            otherParty: role === "owner" ? { id: request.requesterId, displayName: requesterName } : { id: ownerId, displayName: ownerName },
            meetingPoint: request.meetingPoint,
            loanDays: request.loanDays,
            preferredTime: request.preferredTime,
            note: request.note,
            rejectionReason: request.rejectionReason,
            responseNote: request.responseNote,
            requestedAt: request.requestedAt,
            respondedAt: request.respondedAt,
            updatedAt: borrowing?.updatedAt && borrowing.updatedAt > request.updatedAt ? borrowing.updatedAt : request.updatedAt,
            handedOverAt: borrowing?.handedOverAt ?? null,
            dueAt: borrowing?.dueAt ?? null,
            returnedAt: borrowing?.returnedAt ?? null,
            disputeReason: borrowing?.disputeReason ?? null,
            disputedAt: borrowing?.disputedAt ?? null,
            resolutionNote: borrowing?.resolutionNote ?? null,
            cancelledByOther: request.status === "CANCELLED" && request.cancelledById !== null && request.cancelledById !== userId,
        };
    });
}

/** The reader's open (waiting or accepted) requests among the given listings, for the book detail page. */
export async function findOpenRequestsForListings(userId: string, listingIds: string[]) {
    if (listingIds.length === 0) return new Map<string, { id: string; status: string }>();
    const rows = await db
        .select({ id: borrowRequests.id, listingId: borrowRequests.listingId, status: borrowRequests.status })
        .from(borrowRequests)
        .where(and(eq(borrowRequests.requesterId, userId), inArray(borrowRequests.listingId, listingIds), inArray(borrowRequests.status, ["PENDING", "APPROVED"])));
    return new Map(rows.map((row) => [row.listingId, { id: row.id, status: row.status }]));
}

/** Open disputes first, then the most recently settled ones. */
export async function listBorrowingDisputes(limit = 50) {
    return db
        .select({
            borrowingId: borrowings.id,
            requestId: borrowRequests.id,
            status: borrowings.status,
            reason: borrowings.disputeReason,
            details: borrowings.disputeDetails,
            disputedAt: borrowings.disputedAt,
            resolvedAt: borrowings.resolvedAt,
            resolutionNote: borrowings.resolutionNote,
            handedOverAt: borrowings.handedOverAt,
            dueAt: borrowings.dueAt,
            meetingPoint: borrowRequests.meetingPoint,
            book: { id: books.id, title: books.title, authors: books.authors },
            listingId: bookListings.id,
            requesterName: requesterProfile.displayName,
            ownerName: ownerProfile.displayName,
            reporterName: reporterProfile.displayName,
            reportedByOwner: sql<boolean>`${borrowings.disputedById} = ${bookListings.ownerId}`,
        })
        .from(borrowings)
        .innerJoin(borrowRequests, eq(borrowRequests.id, borrowings.requestId))
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .innerJoin(books, eq(books.id, bookListings.bookId))
        .innerJoin(requesterProfile, eq(requesterProfile.id, borrowRequests.requesterId))
        .innerJoin(ownerProfile, eq(ownerProfile.id, bookListings.ownerId))
        .leftJoin(reporterProfile, eq(reporterProfile.id, borrowings.disputedById))
        .where(sql`${borrowings.disputedAt} is not null`)
        .orderBy(sql`${borrowings.status} = 'DISPUTED' desc`, desc(borrowings.disputedAt))
        .limit(limit);
}

export async function countOpenBorrowingDisputes() {
    const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(borrowings).where(eq(borrowings.status, "DISPUTED"));
    return row?.total ?? 0;
}

export function listBorrowEvents(requestId: string) {
    return db.select().from(borrowEvents).where(eq(borrowEvents.requestId, requestId)).orderBy(borrowEvents.createdAt);
}

