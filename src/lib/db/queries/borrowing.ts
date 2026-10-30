import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
    actionBlocker,
    AUTO_REJECTION_REASON,
    dueDateFrom,
    guaranteeFromRules,
    loanDayChoices,
    LOAN_UPDATE_EVENTS,
    loanGroup,
    loanState,
    maxLoanDaysFromRules,
    meetingPointsOf,
    type DisputeConsequence,
    type LoanAction,
    type LoanRole,
    type LoanSnapshot,
    type LoanState,
} from "@/features/borrowing/lifecycle";
import { accountActionBlocker } from "@/features/admin-users/account-rules";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import type { AskDisputePartyInput, BorrowingActionInput, BorrowRequestActionInput, CreateBorrowRequestInput, ResolveBorrowingDisputeInput } from "@/lib/validation/schemas/borrowing.schema";

import { db } from "../client";
import {
    borrowerReviews,
    adminAuditLogs,
    places,
    bookListings,
    books,
    borrowEvents,
    borrowings,
    borrowRequests,
    userProfiles,
    communities,
} from "../schema";
import { setUserSuspensionIn } from "./admin-users";
import { managedCommunityIdsSql, managesListing } from "./listing-access";
import { meetingTimeFrom } from "@/features/borrowing/meeting-time";
import { meetingPlaceNames } from "./places";

const requesterProfile = alias(userProfiles, "requester_profile");
const ownerProfile = alias(userProfiles, "owner_profile");
const reporterProfile = alias(userProfiles, "reporter_profile");

const blockDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

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

/** A dispute decision may block new requests for a while (28 Okt 2026); it covers copies from readers and libraries alike. */
export async function assertNotBorrowBlocked(tx: Pick<Tx, "select">, userId: string) {
    const [user] = await tx.select({ borrowBlockedUntil: userProfiles.borrowBlockedUntil }).from(userProfiles).where(eq(userProfiles.id, userId));
    if (user?.borrowBlockedUntil && user.borrowBlockedUntil > new Date()) {
        throw new ForbiddenError(`Anda belum dapat mengajukan pinjam sampai ${blockDate.format(user.borrowBlockedUntil)} karena keputusan sengketa sebelumnya.`);
    }
}

export async function createBorrowRequest(requesterId: string, input: CreateBorrowRequestInput) {
    return db.transaction(async (tx) => {
        await assertNotBorrowBlocked(tx, requesterId);
        const [listing] = await tx
            .select({
                id: bookListings.id,
                ownerId: bookListings.ownerId,
                availability: bookListings.availability,
                hiddenAt: bookListings.hiddenAt,
                publicLocation: bookListings.publicLocation,
                meetingPlaceIds: bookListings.meetingPlaceIds,
                borrowingRules: bookListings.borrowingRules,
                communityId: bookListings.communityId,
                communityStatus: communities.status,
                ownerSuspendedAt: userProfiles.suspendedAt,
                ownerDeletionRequestedAt: userProfiles.deletionRequestedAt,
            })
            .from(bookListings)
            .innerJoin(userProfiles, eq(userProfiles.id, bookListings.ownerId))
            .leftJoin(communities, eq(communities.id, bookListings.communityId))
            .where(eq(bookListings.id, input.listingId))
            .for("update", { of: bookListings });

        // A personal copy hides with its suspended or leaving owner; a community's copy with its community's verification.
        const hidden = !listing || listing.hiddenAt || (listing.communityId
            ? listing.communityStatus !== "VERIFIED"
            : listing.ownerSuspendedAt || listing.ownerDeletionRequestedAt);
        if (!listing || hidden) throw new NotFoundError("Salinan buku tidak ditemukan.");
        if (await managesListing(tx, requesterId, listing)) {
            throw new ForbiddenError(listing.communityId ? "Pengurus tidak dapat meminjam dari koleksi komunitasnya sendiri." : "Anda tidak dapat meminjam buku milik sendiri.");
        }
        if (listing.availability !== "AVAILABLE") throw new ConflictError("Salinan ini sedang tidak ditawarkan.");

        const maxDays = maxLoanDaysFromRules(listing.borrowingRules);
        if (!loanDayChoices(maxDays).includes(input.loanDays)) {
            throw new ConflictError(`Lama pinjam maksimal ${maxDays} hari sesuai aturan pemilik.`);
        }
        const points = meetingPointsOf(listing.publicLocation);
        if (points.length > 0 && (!input.meetingPoint || !points.includes(input.meetingPoint))) {
            throw new ConflictError("Pilih salah satu titik temu publik dari pemilik.");
        }
        // The chosen point's Peta Literasi place, if the owner picked it from the map (TB-027).
        const meetingPlaces = await meetingPlaceNames(listing.meetingPlaceIds, tx);
        const meetingPlaceId = [...meetingPlaces].find(([, name]) => name === input.meetingPoint)?.[0] ?? null;

        try {
            const [request] = await tx
                .insert(borrowRequests)
                .values({
                    listingId: listing.id,
                    requesterId,
                    note: input.note ?? null,
                    meetingPoint: points.length > 0 ? input.meetingPoint! : null,
                    meetingPlaceId,
                    loanDays: input.loanDays,
                    preferredTime: input.preferredTime ?? null,
                    preferredAt: (() => {
                        const result = meetingTimeFrom(input.preferredDate, input.preferredClock);
                        return "at" in result ? result.at : null;
                    })(),
                    guarantee: guaranteeFromRules(listing.borrowingRules),
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
            communityId: bookListings.communityId,
            availability: bookListings.availability,
            borrowing: borrowings,
        })
        .from(borrowRequests)
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
        .where("requestId" in where ? eq(borrowRequests.id, where.requestId) : eq(borrowings.id, where.borrowingId))
        .for("update", { of: [borrowRequests, bookListings] });

    if (!row) throw new NotFoundError("Pinjaman tidak ditemukan.");
    // For a community's copy, any of its managers acts as the owner (30 Okt 2026).
    const role: LoanRole | null = await managesListing(tx, userId, row) ? "owner" : row.request.requesterId === userId ? "requester" : null;
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
        extensionStatus: borrowing?.extensionStatus ?? null,
        ownerReplyRequestedAt: borrowing?.ownerReplyRequestedAt ?? null,
        requesterReplyRequestedAt: borrowing?.requesterReplyRequestedAt ?? null,
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
        const { request, role, listingId, communityId, borrowing } = await lockLoan(tx, { borrowingId }, userId);
        if (!borrowing) throw new NotFoundError("Pinjaman tidak ditemukan.");
        assertAllowed(snapshotOf(request, borrowing), role, input.action, now);

        switch (input.action) {
            case "confirm_return": {
                const ownerAt = role === "owner" ? now : borrowing.ownerReturnAt;
                const requesterAt = role === "requester" ? now : borrowing.requesterReturnAt;
                await logEvent(tx, request.id, userId, "RETURN_CONFIRMED", role === "owner" ? "Pemilik" : "Peminjam");
                // In the same transaction as the confirmation: both are saved, or neither.
                if (input.review) {
                    if (role !== "owner") throw new ForbiddenError("Hanya pemilik buku yang dapat memberi ulasan untuk peminjam.");
                    const [review] = await tx.insert(borrowerReviews)
                        .values({ borrowingId: borrowing.id, requesterId: request.requesterId, reviewerId: userId, communityId, rating: input.review.rating, comment: input.review.comment ?? null })
                        .onConflictDoNothing({ target: borrowerReviews.borrowingId })
                        .returning({ id: borrowerReviews.id });
                    if (!review) throw new ConflictError("Ulasan untuk pinjaman ini sudah ada.");
                }
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
            case "add_dispute_info": {
                // Answering clears the admin's question to this party.
                await tx
                    .update(borrowings)
                    .set(role === "owner" ? { ownerReplyRequestedAt: null, updatedAt: now } : { requesterReplyRequestedAt: null, updatedAt: now })
                    .where(eq(borrowings.id, borrowing.id));
                await logEvent(tx, request.id, userId, "DISPUTE_INFO_ADDED", input.details);
                return { status: "DISPUTED" as const };
            }
            case "request_extension": {
                await tx
                    .update(borrowings)
                    .set({ extensionStatus: "PENDING", extensionDays: input.days, extensionNote: input.note ?? null, extensionRequestedAt: now, updatedAt: now })
                    .where(eq(borrowings.id, borrowing.id));
                await logEvent(tx, request.id, userId, "EXTENSION_REQUESTED", `${input.days} hari`);
                return { status: loanState(snapshotOf(request, borrowing), now), extensionStatus: "PENDING" as const };
            }
            case "approve_extension": {
                // The extra days count from the old due date, also when it has already passed.
                const days = borrowing.extensionDays ?? 0;
                const dueAt = new Date((borrowing.dueAt ?? now).getTime() + days * 24 * 60 * 60 * 1000);
                await tx
                    .update(borrowings)
                    .set({ extensionStatus: "APPROVED", extensionRespondedAt: now, dueAt, updatedAt: now })
                    .where(eq(borrowings.id, borrowing.id));
                await logEvent(tx, request.id, userId, "EXTENSION_APPROVED", `${days} hari`);
                return { status: loanState({ ...snapshotOf(request, borrowing), dueAt }, now), extensionStatus: "APPROVED" as const, dueAt };
            }
            case "reject_extension": {
                await tx
                    .update(borrowings)
                    .set({ extensionStatus: "REJECTED", extensionRespondedAt: now, extensionResponseNote: input.note ?? null, updatedAt: now })
                    .where(eq(borrowings.id, borrowing.id));
                await logEvent(tx, request.id, userId, "EXTENSION_REJECTED", input.note);
                return { status: loanState(snapshotOf(request, borrowing), now), extensionStatus: "REJECTED" as const };
            }
        }
    });
}

/** An admin asks one or both parties of an open dispute; the asked party sees it under "Perlu Tindakan". */
export async function askDisputeParty(borrowingId: string, adminId: string, input: AskDisputePartyInput) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
            .select({ borrowing: borrowings })
            .from(borrowings)
            .where(eq(borrowings.id, borrowingId))
            .for("update");
        if (!row) throw new NotFoundError("Pinjaman tidak ditemukan.");
        if (row.borrowing.status !== "DISPUTED") throw new ConflictError("Sengketa ini sudah diputuskan.");
        await tx
            .update(borrowings)
            .set({
                ...(input.party !== "REQUESTER" ? { ownerReplyRequestedAt: now } : {}),
                ...(input.party !== "OWNER" ? { requesterReplyRequestedAt: now } : {}),
                updatedAt: now,
            })
            .where(eq(borrowings.id, borrowingId));
        const to = { OWNER: "Untuk pemilik", REQUESTER: "Untuk peminjam", BOTH: "Untuk kedua pihak" }[input.party];
        await logEvent(tx, row.borrowing.requestId, adminId, "DISPUTE_INFO_REQUESTED", `${to}: ${input.question}`);
        return { status: "DISPUTED" as const };
    });
}

/** Admin-side events, never a community manager's handling. */
const ADMIN_EVENTS = ["DISPUTE_INFO_REQUESTED", "DISPUTE_RESOLVED"] as const;

/**
 * The manager who last handled a loan of a community's copy (owner's decision 30 Okt 2026): a dispute's
 * owner-side consequence falls on them. Null when no manager acted, e.g. the request is still unanswered.
 */
async function communityHandlerOf(tx: Pick<Tx, "select">, requestId: string, requesterId: string) {
    const [event] = await tx.select({ actorId: borrowEvents.actorId }).from(borrowEvents)
        .where(and(eq(borrowEvents.requestId, requestId), isNotNull(borrowEvents.actorId), ne(borrowEvents.actorId, requesterId), notInArray(borrowEvents.type, [...ADMIN_EVENTS])))
        .orderBy(desc(borrowEvents.createdAt))
        .limit(1);
    return event?.actorId ?? null;
}

export async function resolveBorrowingDispute(borrowingId: string, adminId: string, input: ResolveBorrowingDisputeInput) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
            .select({ borrowing: borrowings, requestId: borrowRequests.id, listingId: borrowRequests.listingId, ownerId: bookListings.ownerId, communityId: bookListings.communityId, requesterId: borrowRequests.requesterId })
            .from(borrowings)
            .innerJoin(borrowRequests, eq(borrowRequests.id, borrowings.requestId))
            .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
            .where(eq(borrowings.id, borrowingId))
            .for("update", { of: borrowings });
        if (!row) throw new NotFoundError("Pinjaman tidak ditemukan.");
        if (row.borrowing.status !== "DISPUTED") throw new ConflictError("Sengketa ini sudah diputuskan.");

        const { consequence } = input;
        const partyId = consequence.type === "NONE" ? null
            : consequence.party === "REQUESTER" ? row.requesterId
                : row.communityId ? await communityHandlerOf(tx, row.requestId, row.requesterId) ?? row.ownerId : row.ownerId;
        const days = consequence.type === "BORROW_BLOCK" ? consequence.days : null;
        if (partyId && consequence.type === "SUSPENSION") {
            const [party] = await tx.select({ role: userProfiles.role }).from(userProfiles).where(eq(userProfiles.id, partyId));
            const blocker = accountActionBlocker("suspend", { actorId: adminId, targetId: partyId, targetRole: party?.role ?? "MEMBER" });
            if (blocker === "self") throw new ConflictError("Anda tidak dapat menangguhkan akun sendiri.");
            if (blocker === "admin_target") throw new ConflictError("Pihak ini admin. Turunkan perannya dulu, atau pilih konsekuensi lain.");
            await setUserSuspensionIn(tx, { targetId: partyId, actorId: adminId, suspended: true, reason: `Keputusan sengketa pinjam: ${input.note}` });
        }
        if (partyId && days) {
            // A longer block already in place is kept.
            const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
            await tx.update(userProfiles)
                .set({ borrowBlockedUntil: sql`greatest(${userProfiles.borrowBlockedUntil}, ${until.toISOString()}::timestamptz)`, updatedAt: now })
                .where(eq(userProfiles.id, partyId));
        }

        await tx
            .update(borrowings)
            .set({
                status: input.outcome,
                returnedAt: input.outcome === "RETURNED" ? now : null,
                resolvedAt: now,
                resolvedById: adminId,
                resolutionNote: input.note,
                ownerReplyRequestedAt: null,
                requesterReplyRequestedAt: null,
                consequence: consequence.type,
                consequenceUserId: partyId,
                consequenceDays: days,
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
            metadata: { outcome: input.outcome, consequence: consequence.type, consequenceUserId: partyId, consequenceDays: days },
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
    /** The meeting point on the Peta Literasi, while that place is still shown (TB-027). */
    meetingPlace: { id: string; latitude: number; longitude: number } | null;
    loanDays: number;
    preferredTime: string | null;
    preferredAt: Date | null;
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
    extension: { status: string; days: number | null; note: string | null; responseNote: string | null } | null;
    /** The owner's non-money guarantee agreed with the request. */
    guarantee: string | null;
    /** The admin's open question to this user in a dispute, until they answer. */
    disputeQuestion: string | null;
    /** What the dispute decision applied, when it applied anything. */
    consequence: { type: DisputeConsequence; days: number | null; appliesToYou: boolean } | null;
    cancelledByOther: boolean;
    /** Oldest first; `by` is relative to the reader of the list. */
    events: { id: string; type: string; note: string | null; createdAt: Date; by: "you" | "other" | "system" | "admin" }[];
};

type LoanScope = { kind: "user"; userId: string } | { kind: "community"; communityId: string; userId: string };

/**
 * Loans as seen by a reader (their own copies and what they borrow) or by a community's managers (its
 * collection, 30 Okt 2026). A community's copy belongs to the community's view, not to the manager who added it.
 */
async function loadLoans(scope: LoanScope, now: Date): Promise<LoanItem[]> {
    const viewerId = scope.userId;
    const rows = await db
        .select({
            request: borrowRequests,
            borrowing: borrowings,
            listingId: bookListings.id,
            ownerId: bookListings.ownerId,
            communityId: bookListings.communityId,
            communityName: communities.name,
            book: { id: books.id, title: books.title, authors: books.authors, coverUrl: books.coverUrl },
            requesterName: requesterProfile.displayName,
            ownerName: ownerProfile.displayName,
            meetingPlace: { id: places.id, latitude: places.latitude, longitude: places.longitude },
        })
        .from(borrowRequests)
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .innerJoin(books, eq(books.id, bookListings.bookId))
        .innerJoin(requesterProfile, eq(requesterProfile.id, borrowRequests.requesterId))
        .innerJoin(ownerProfile, eq(ownerProfile.id, bookListings.ownerId))
        .leftJoin(communities, eq(communities.id, bookListings.communityId))
        .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
        .leftJoin(places, and(eq(places.id, borrowRequests.meetingPlaceId), isNull(places.hiddenAt)))
        .where(scope.kind === "community"
            ? eq(bookListings.communityId, scope.communityId)
            : or(eq(borrowRequests.requesterId, viewerId), and(eq(bookListings.ownerId, viewerId), isNull(bookListings.communityId))))
        .orderBy(desc(borrowRequests.updatedAt))
        .limit(200);

    const requestIds = rows.map((row) => row.request.id);
    const eventRows = requestIds.length > 0
        ? await db.select().from(borrowEvents).where(inArray(borrowEvents.requestId, requestIds)).orderBy(borrowEvents.createdAt)
        : [];
    const eventsByRequest = new Map<string, typeof eventRows>();
    for (const event of eventRows) eventsByRequest.set(event.requestId, [...(eventsByRequest.get(event.requestId) ?? []), event]);

    return rows.map(({ request, borrowing, listingId, ownerId, communityId, communityName, book, requesterName, ownerName, meetingPlace }) => {
        const role: LoanRole = scope.kind === "community" || (ownerId === viewerId && communityId === null) ? "owner" : "requester";
        const snapshot = snapshotOf(request, borrowing);
        const events = eventsByRequest.get(request.id) ?? [];
        const asked = role === "owner" ? snapshot.ownerReplyRequestedAt : snapshot.requesterReplyRequestedAt;
        // On a community's side, any non-admin event not by the borrower was the community's own doing.
        const bySide = (actorId: string | null, type: string) => {
            if (actorId === null) return "system" as const;
            if (actorId === viewerId) return "you" as const;
            if (scope.kind === "community") {
                if (actorId === request.requesterId) return "other" as const;
                return (ADMIN_EVENTS as readonly string[]).includes(type) ? "admin" as const : "you" as const;
            }
            const ownerSide = communityId ? !(ADMIN_EVENTS as readonly string[]).includes(type) && actorId !== request.requesterId : actorId === ownerId;
            return actorId === request.requesterId || ownerSide ? "other" as const : "admin" as const;
        };
        return {
            requestId: request.id,
            borrowingId: borrowing?.id ?? null,
            role,
            state: loanState(snapshot, now),
            snapshot,
            listingId,
            book,
            otherParty: role === "owner"
                ? { id: request.requesterId, displayName: requesterName }
                : communityId ? { id: communityId, displayName: communityName ?? ownerName } : { id: ownerId, displayName: ownerName },
            meetingPoint: request.meetingPoint,
            meetingPlace,
            loanDays: request.loanDays,
            preferredTime: request.preferredTime,
            preferredAt: request.preferredAt,
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
            extension: borrowing?.extensionStatus
                ? { status: borrowing.extensionStatus, days: borrowing.extensionDays, note: borrowing.extensionNote, responseNote: borrowing.extensionResponseNote }
                : null,
            guarantee: request.guarantee,
            // The stored note starts with "Untuk <pihak>: " for the shared history; the asked party needs only the question.
            disputeQuestion: asked ? events.findLast((event) => event.type === "DISPUTE_INFO_REQUESTED")?.note?.replace(/^Untuk [^:]+:\s*/, "") ?? null : null,
            consequence: borrowing?.consequence && borrowing.consequence !== "NONE"
                ? {
                    type: borrowing.consequence,
                    days: borrowing.consequenceDays,
                    // On a community's side, a consequence on any manager concerns the community.
                    appliesToYou: borrowing.consequenceUserId === viewerId || (scope.kind === "community" && borrowing.consequenceUserId !== null && borrowing.consequenceUserId !== request.requesterId),
                }
                : null,
            cancelledByOther: request.status === "CANCELLED" && request.cancelledById !== null && (role === "owner" ? request.cancelledById === request.requesterId : request.cancelledById !== viewerId),
            events: events.map((event) => ({
                id: event.id,
                type: event.type,
                note: event.note,
                createdAt: event.createdAt,
                by: bySide(event.actorId, event.type),
            })),
        };
    });
}

/** Every loan the user takes part in, as owner ("Dipinjamkan ke kawan") or borrower ("Saya pinjam"). */
export function listLoansForUser(userId: string, now = new Date()): Promise<LoanItem[]> {
    return loadLoans({ kind: "user", userId }, now);
}

/** Loans of a community's collection, as its managers see them; `userId` is the manager reading. */
export function listLoansForCommunity(communityId: string, userId: string, now = new Date()): Promise<LoanItem[]> {
    return loadLoans({ kind: "community", communityId, userId }, now);
}

/**
 * How many of the user's loans are under "Perlu Tindakan" (`loanGroup`), for the dot on the account menu.
 * Reads only the snapshot columns; the rule itself stays in `loanGroup`.
 */
/**
 * News for the reader since `since`: answers to their requests and loans made by someone else, and reviews
 * about them. Feeds the dot on "Pinjam & pinjamkan" and "Saya pinjam" until they open it.
 */
export type ListingLoanState = "AWAITING_HANDOVER" | "BORROWED";

export async function countLoanUpdatesSince(userId: string, since: Date) {
    const sinceIso = since.toISOString();
    const [[events], [reviews]] = await Promise.all([
        db.select({ total: sql<number>`count(*)::int` }).from(borrowEvents)
            .innerJoin(borrowRequests, eq(borrowRequests.id, borrowEvents.requestId))
            .where(and(
                eq(borrowRequests.requesterId, userId),
                inArray(borrowEvents.type, [...LOAN_UPDATE_EVENTS]),
                sql`${borrowEvents.actorId} is distinct from ${userId}`,
                sql`${borrowEvents.createdAt} > ${sinceIso}::timestamptz`,
            )),
        db.select({ total: sql<number>`count(*)::int` }).from(borrowerReviews)
            .where(and(eq(borrowerReviews.requesterId, userId), sql`${borrowerReviews.createdAt} > ${sinceIso}::timestamptz`)),
    ]);
    return (events?.total ?? 0) + (reviews?.total ?? 0);
}

/**
 * What a RESERVED copy is waiting on (30 Okt 2026): an accepted request before handover, or a copy out on
 * loan. "Dipesan" alone covered both; the collection lists now say which.
 */
export async function listingLoanStates(listingIds: string[]) {
    if (listingIds.length === 0) return new Map<string, ListingLoanState>();
    const rows = await db.select({ listingId: borrowRequests.listingId, borrowingStatus: borrowings.status })
        .from(borrowRequests)
        .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
        .where(and(
            inArray(borrowRequests.listingId, listingIds),
            // Accepted and not handed over yet, or handed over and not settled.
            or(and(eq(borrowRequests.status, "APPROVED"), isNull(borrowings.id)), inArray(borrowings.status, ["ACTIVE", "OVERDUE", "DISPUTED"])),
        ));
    const states = new Map<string, ListingLoanState>();
    for (const row of rows) {
        const state: ListingLoanState = row.borrowingStatus ? "BORROWED" : "AWAITING_HANDOVER";
        if (states.get(row.listingId) !== "BORROWED") states.set(row.listingId, state);
    }
    return states;
}

const openLoan = or(inArray(borrowRequests.status, ["PENDING", "APPROVED"]), inArray(borrowings.status, ["ACTIVE", "OVERDUE", "DISPUTED"]));

export async function countLoansNeedingAction(userId: string, now = new Date()) {
    const rows = await db
        .select({ request: borrowRequests, borrowing: borrowings, ownerId: bookListings.ownerId })
        .from(borrowRequests)
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
        .where(and(
            or(eq(borrowRequests.requesterId, userId), and(eq(bookListings.ownerId, userId), isNull(bookListings.communityId))),
            openLoan,
        ));
    return rows.filter(({ request, borrowing, ownerId }) =>
        loanGroup(snapshotOf(request, borrowing), ownerId === userId ? "owner" : "requester", now) === "action").length;
}

/**
 * Loans of community collections waiting for a manager, per community, for the communities `userId` manages
 * (manage menu and the account-menu dot).
 */
export async function countCommunityLoansNeedingAction(userId: string, now = new Date()) {
    const rows = await db
        .select({ request: borrowRequests, borrowing: borrowings, communityId: bookListings.communityId })
        .from(borrowRequests)
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
        .where(and(sql`${bookListings.communityId} in ${managedCommunityIdsSql(userId)}`, openLoan));
    const counts = new Map<string, number>();
    for (const { request, borrowing, communityId } of rows) {
        if (communityId && loanGroup(snapshotOf(request, borrowing), "owner", now) === "action") counts.set(communityId, (counts.get(communityId) ?? 0) + 1);
    }
    return counts;
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
            consequence: borrowings.consequence,
            consequenceDays: borrowings.consequenceDays,
            consequenceToOwner: sql<boolean>`${borrowings.consequenceUserId} <> ${borrowRequests.requesterId}`,
            ownerReplyRequestedAt: borrowings.ownerReplyRequestedAt,
            requesterReplyRequestedAt: borrowings.requesterReplyRequestedAt,
            handedOverAt: borrowings.handedOverAt,
            dueAt: borrowings.dueAt,
            meetingPoint: borrowRequests.meetingPoint,
            book: { id: books.id, title: books.title, authors: books.authors },
            listingId: bookListings.id,
            requesterName: requesterProfile.displayName,
            ownerName: ownerProfile.displayName,
            reporterName: reporterProfile.displayName,
            reportedByOwner: sql<boolean>`${borrowings.disputedById} <> ${borrowRequests.requesterId}`,
            communityName: communities.name,
        })
        .from(borrowings)
        .innerJoin(borrowRequests, eq(borrowRequests.id, borrowings.requestId))
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .innerJoin(books, eq(books.id, bookListings.bookId))
        .innerJoin(requesterProfile, eq(requesterProfile.id, borrowRequests.requesterId))
        .innerJoin(ownerProfile, eq(ownerProfile.id, bookListings.ownerId))
        .leftJoin(communities, eq(communities.id, bookListings.communityId))
        .leftJoin(reporterProfile, eq(reporterProfile.id, borrowings.disputedById))
        .where(sql`${borrowings.disputedAt} is not null`)
        .orderBy(sql`${borrowings.status} = 'DISPUTED' desc`, desc(borrowings.disputedAt))
        .limit(limit);
}

export async function countOpenBorrowingDisputes() {
    const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(borrowings).where(eq(borrowings.status, "DISPUTED"));
    return row?.total ?? 0;
}

/** Open loans by state for Pengaturan → Aturan Pinjam; OVERDUE is derived from `dueAt`, as in `loanState`. */
export async function countOpenLoans(now = new Date()) {
    const [requests] = await db
        .select({
            pending: sql<number>`count(*) filter (where ${borrowRequests.status} = 'PENDING')::int`,
            awaitingHandover: sql<number>`count(*) filter (where ${borrowRequests.status} = 'APPROVED')::int`,
        })
        .from(borrowRequests);
    const running = sql`${borrowings.status} in ('ACTIVE', 'OVERDUE')`;
    const [loans] = await db
        .select({
            active: sql<number>`count(*) filter (where ${running} and (${borrowings.dueAt} is null or ${borrowings.dueAt} >= ${now.toISOString()}))::int`,
            overdue: sql<number>`count(*) filter (where ${running} and ${borrowings.dueAt} < ${now.toISOString()})::int`,
            disputed: sql<number>`count(*) filter (where ${borrowings.status} = 'DISPUTED')::int`,
            extensionPending: sql<number>`count(*) filter (where ${running} and ${borrowings.extensionStatus} = 'PENDING')::int`,
        })
        .from(borrowings);
    return { ...requests, ...loans };
}

export function listBorrowEvents(requestId: string) {
    return db.select().from(borrowEvents).where(eq(borrowEvents.requestId, requestId)).orderBy(borrowEvents.createdAt);
}

