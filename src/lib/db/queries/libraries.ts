import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNull, like, or, sql } from "drizzle-orm";

import { accessActionBlocker, pickupDeadline, type AccessRole, type HoldingSource } from "@/features/libraries/access";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import type { AccessActionInput, CreateAccessRequestInput, HoldingInput, LibraryAccessSettingsInput, UpdateLibraryInput } from "@/lib/validation/schemas/library.schema";

import { db } from "../client";
import { adminAuditLogs, bookAccesses, books, libraries, libraryHoldings, libraryManagers, places, userProfiles } from "../schema";
import { assertNotBorrowBlocked } from "./borrowing";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

function isUniqueViolation(error: unknown) {
    const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
    return code === "23505";
}

/** Fields any visitor may see about a library (TB-023). */
const libraryColumns = {
    id: libraries.id,
    name: libraries.name,
    publicLocation: libraries.publicLocation,
    regionCode: libraries.regionCode,
    placeId: libraries.placeId,
    catalogUrl: libraries.catalogUrl,
    websiteUrl: libraries.websiteUrl,
    accessEnabled: libraries.accessEnabled,
    accessRules: libraries.accessRules,
    pickupDays: libraries.pickupDays,
};

/** Libraries on `/libraries`. `region` is a province (`NN`) or kab/kota (`NN.NN`) prefix. */
export async function listLibraries(filter: { region?: string; q?: string } = {}) {
    const query = filter.q ? escapeLike(filter.q) : undefined;
    return db
        .select({ ...libraryColumns, holdings: sql<number>`(select count(distinct ${libraryHoldings.bookId})::int from ${libraryHoldings} where ${libraryHoldings.libraryId} = ${libraries.id})` })
        .from(libraries)
        .where(and(
            isNull(libraries.hiddenAt),
            filter.region ? like(libraries.regionCode, `${filter.region}%`) : undefined,
            query ? or(ilike(libraries.name, `%${query}%`), ilike(libraries.publicLocation, `%${query}%`)) : undefined,
        ))
        .orderBy(asc(libraries.name));
}

/** One library; hidden ones only for its managers and admins (`includeHidden`). */
export async function findLibrary(libraryId: string, options: { includeHidden?: boolean } = {}) {
    const [library] = await db
        .select({ ...libraryColumns, hiddenAt: libraries.hiddenAt })
        .from(libraries)
        .where(and(eq(libraries.id, libraryId), options.includeHidden ? undefined : isNull(libraries.hiddenAt)));
    return library ?? null;
}

const holdingColumns = {
    libraryId: libraryHoldings.libraryId,
    bookId: libraryHoldings.bookId,
    source: libraryHoldings.source,
    status: libraryHoldings.status,
    copiesTotal: libraryHoldings.copiesTotal,
    copiesAvailable: libraryHoldings.copiesAvailable,
    callNumber: libraryHoldings.callNumber,
    sourceUrl: libraryHoldings.sourceUrl,
    checkedAt: libraryHoldings.checkedAt,
};

/** Every source's holding of one book in visible libraries; the page merges them per library (`mergeHoldings`). */
export function listHoldingsForBook(bookId: string) {
    return db
        .select({ ...holdingColumns, library: libraryColumns })
        .from(libraryHoldings)
        .innerJoin(libraries, eq(libraries.id, libraryHoldings.libraryId))
        .where(and(eq(libraryHoldings.bookId, bookId), isNull(libraries.hiddenAt)))
        .orderBy(asc(libraries.name));
}

/** A library's collection, newest checks first; `q` searches title and author. */
export function listHoldingsForLibrary(libraryId: string, q?: string, limit = 100) {
    const query = q ? escapeLike(q) : undefined;
    return db
        .select({ ...holdingColumns, book: { id: books.id, title: books.title, authors: books.authors, coverUrl: books.coverUrl } })
        .from(libraryHoldings)
        .innerJoin(books, eq(books.id, libraryHoldings.bookId))
        .where(and(
            eq(libraryHoldings.libraryId, libraryId),
            query ? or(ilike(books.title, `%${query}%`), sql`array_to_string(${books.authors}, ' ') ilike ${`%${query}%`}`) : undefined,
        ))
        .orderBy(desc(libraryHoldings.checkedAt))
        .limit(limit);
}

export async function isLibraryManager(userId: string, libraryId: string, client: Pick<typeof db, "select"> = db) {
    const [row] = await client.select({ id: libraryManagers.id }).from(libraryManagers)
        .where(and(eq(libraryManagers.libraryId, libraryId), eq(libraryManagers.userId, userId)));
    return Boolean(row);
}

/** Libraries this account runs, for the account menu and `/my-libraries`. */
export function listManagedLibraries(userId: string) {
    return db
        .select({ id: libraries.id, name: libraries.name, accessEnabled: libraries.accessEnabled, hiddenAt: libraries.hiddenAt })
        .from(libraryManagers)
        .innerJoin(libraries, eq(libraries.id, libraryManagers.libraryId))
        .where(eq(libraryManagers.userId, userId))
        .orderBy(asc(libraries.name));
}

// --- Access requests -------------------------------------------------------------------------------

export async function createAccessRequest(requesterId: string, input: CreateAccessRequestInput) {
    return db.transaction(async (tx) => {
        await assertNotBorrowBlocked(tx, requesterId);
        const [library] = await tx.select({ id: libraries.id, accessEnabled: libraries.accessEnabled, hiddenAt: libraries.hiddenAt })
            .from(libraries).where(eq(libraries.id, input.libraryId)).for("update");
        if (!library || library.hiddenAt) throw new NotFoundError("Perpustakaan tidak ditemukan.");
        if (!library.accessEnabled) throw new ConflictError("Perpustakaan ini belum menerima pengajuan lewat TemuBaca.");
        if (await isLibraryManager(requesterId, library.id, tx)) throw new ForbiddenError("Anda pengelola perpustakaan ini.");
        const [holding] = await tx.select({ id: libraryHoldings.id }).from(libraryHoldings)
            .where(and(eq(libraryHoldings.libraryId, library.id), eq(libraryHoldings.bookId, input.bookId))).limit(1);
        if (!holding) throw new NotFoundError("Buku ini tidak tercatat di koleksi perpustakaan tersebut.");
        try {
            const [request] = await tx.insert(bookAccesses)
                .values({ libraryId: library.id, bookId: input.bookId, requesterId, message: input.message })
                .returning({ id: bookAccesses.id, status: bookAccesses.status, createdAt: bookAccesses.createdAt });
            return request;
        } catch (error) {
            if (isUniqueViolation(error)) throw new ConflictError("Anda sudah punya pengajuan yang berjalan untuk buku ini di perpustakaan ini.");
            throw error;
        }
    });
}

/** The reader cancels; the library's manager approves, rejects, or marks the book collected. */
export async function actOnAccessRequest(accessId: string, userId: string, input: AccessActionInput) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [request] = await tx
            .select({ id: bookAccesses.id, status: bookAccesses.status, expiresAt: bookAccesses.expiresAt, requesterId: bookAccesses.requesterId, libraryId: bookAccesses.libraryId, pickupDays: libraries.pickupDays })
            .from(bookAccesses)
            .innerJoin(libraries, eq(libraries.id, bookAccesses.libraryId))
            .where(eq(bookAccesses.id, accessId))
            .for("update", { of: bookAccesses });
        if (!request) throw new NotFoundError("Pengajuan tidak ditemukan.");
        const role: AccessRole | null = input.action === "cancel"
            ? (request.requesterId === userId ? "requester" : null)
            : (await isLibraryManager(userId, request.libraryId, tx) ? "manager" : null);
        if (!role) throw new NotFoundError("Pengajuan tidak ditemukan.");
        const blocker = accessActionBlocker(request, role, input.action, now);
        if (blocker) throw new ConflictError(blocker);

        const changes = {
            approve: { status: "APPROVED" as const, respondedById: userId, respondedAt: now, responseNote: "note" in input ? input.note : null, expiresAt: pickupDeadline(now, request.pickupDays) },
            reject: { status: "REJECTED" as const, respondedById: userId, respondedAt: now, responseNote: "note" in input ? input.note : null },
            collected: { status: "COLLECTED" as const, collectedAt: now },
            cancel: { status: "CANCELLED" as const },
        }[input.action];
        await tx.update(bookAccesses).set({ ...changes, updatedAt: now }).where(eq(bookAccesses.id, request.id));
        return { id: request.id, status: changes.status };
    });
}

const accessColumns = {
    id: bookAccesses.id,
    status: bookAccesses.status,
    message: bookAccesses.message,
    responseNote: bookAccesses.responseNote,
    expiresAt: bookAccesses.expiresAt,
    respondedAt: bookAccesses.respondedAt,
    collectedAt: bookAccesses.collectedAt,
    createdAt: bookAccesses.createdAt,
    updatedAt: bookAccesses.updatedAt,
    book: { id: books.id, title: books.title, authors: books.authors },
};

/** Libraries where the reader already has an open request for this book, for the book page. */
export async function openAccessRequestLibraries(userId: string, bookId: string) {
    const rows = await db.select({ libraryId: bookAccesses.libraryId }).from(bookAccesses)
        .where(and(eq(bookAccesses.requesterId, userId), eq(bookAccesses.bookId, bookId), inArray(bookAccesses.status, ["PENDING", "APPROVED"])));
    return new Set(rows.map((row) => row.libraryId));
}

/** The reader's own requests ("Minta & Pinjam → Perpustakaan"). */
export function listAccessRequestsForUser(userId: string) {
    return db
        .select({ ...accessColumns, library: { id: libraries.id, name: libraries.name, publicLocation: libraries.publicLocation, placeId: libraries.placeId, accessRules: libraries.accessRules } })
        .from(bookAccesses)
        .innerJoin(books, eq(books.id, bookAccesses.bookId))
        .innerJoin(libraries, eq(libraries.id, bookAccesses.libraryId))
        .where(eq(bookAccesses.requesterId, userId))
        .orderBy(desc(bookAccesses.updatedAt))
        .limit(200);
}

/** A library's requests for its manager: open ones first. The reader is shown by display name only. */
export function listAccessRequestsForLibrary(libraryId: string) {
    return db
        .select({ ...accessColumns, requesterName: userProfiles.displayName })
        .from(bookAccesses)
        .innerJoin(books, eq(books.id, bookAccesses.bookId))
        .innerJoin(userProfiles, eq(userProfiles.id, bookAccesses.requesterId))
        .where(eq(bookAccesses.libraryId, libraryId))
        .orderBy(sql`${bookAccesses.status} in ('PENDING', 'APPROVED') desc`, desc(bookAccesses.createdAt))
        .limit(200);
}

/**
 * Library items waiting for this account, for the dot on the account menu: requests to answer at the
 * libraries it runs, and its own approved requests still to pick up.
 */
export async function countLibraryActions(userId: string, now = new Date()) {
    const [row] = await db
        .select({
            toAnswer: sql<number>`(select count(*)::int from ${bookAccesses} where ${bookAccesses.status} = 'PENDING' and ${bookAccesses.libraryId} in (select ${libraryManagers.libraryId} from ${libraryManagers} where ${libraryManagers.userId} = ${userId}))`,
            toCollect: sql<number>`(select count(*)::int from ${bookAccesses} where ${bookAccesses.requesterId} = ${userId} and ${bookAccesses.status} = 'APPROVED' and ${bookAccesses.expiresAt} >= ${now.toISOString()})`,
        })
        .from(sql`(select 1) as one`);
    return { toAnswer: row?.toAnswer ?? 0, toCollect: row?.toCollect ?? 0 };
}

// --- Holdings ---------------------------------------------------------------------------------------

async function writeHolding(tx: Tx, libraryId: string, source: HoldingSource, input: HoldingInput, actorId: string | null, now: Date) {
    const [book] = await tx.select({ id: books.id }).from(books).where(eq(books.id, input.bookId));
    if (!book) throw new NotFoundError("Buku tidak ditemukan di katalog.");
    const values = {
        status: input.status,
        copiesTotal: input.copiesTotal,
        copiesAvailable: input.copiesAvailable,
        callNumber: input.callNumber,
        sourceUrl: input.sourceUrl ?? null,
        checkedAt: now,
        updatedById: actorId,
        updatedAt: now,
    };
    await tx.insert(libraryHoldings)
        .values({ libraryId, bookId: input.bookId, source, ...values })
        .onConflictDoUpdate({ target: [libraryHoldings.libraryId, libraryHoldings.bookId, libraryHoldings.source, libraryHoldings.sourceRecordId], set: values });
}

/** A manager records a book in their library; their word outranks the other sources. */
export async function upsertManagerHolding(libraryId: string, userId: string, input: HoldingInput) {
    return db.transaction(async (tx) => {
        if (!(await isLibraryManager(userId, libraryId, tx))) throw new NotFoundError("Perpustakaan tidak ditemukan.");
        await writeHolding(tx, libraryId, "MANAGER", input, userId, new Date());
        return { bookId: input.bookId };
    });
}

export async function removeManagerHolding(libraryId: string, userId: string, bookId: string) {
    return db.transaction(async (tx) => {
        if (!(await isLibraryManager(userId, libraryId, tx))) throw new NotFoundError("Perpustakaan tidak ditemukan.");
        await tx.delete(libraryHoldings).where(and(eq(libraryHoldings.libraryId, libraryId), eq(libraryHoldings.bookId, bookId), eq(libraryHoldings.source, "MANAGER")));
        return { bookId };
    });
}

/** Admin curation from a library's official catalog (DEC-13), recorded in the audit log. `input: null` removes it. */
export async function setCuratedHolding(libraryId: string, actorId: string, bookId: string, input: HoldingInput | null) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [library] = await tx.select({ id: libraries.id }).from(libraries).where(eq(libraries.id, libraryId));
        if (!library) throw new NotFoundError("Perpustakaan tidak ditemukan.");
        if (input) await writeHolding(tx, libraryId, "CURATED", input, actorId, now);
        else await tx.delete(libraryHoldings).where(and(eq(libraryHoldings.libraryId, libraryId), eq(libraryHoldings.bookId, bookId), eq(libraryHoldings.source, "CURATED")));
        await tx.insert(adminAuditLogs).values({
            actorId, action: "LIBRARY_HOLDING_CHANGED", targetType: "LIBRARY", targetId: libraryId,
            note: input ? `Koleksi dicatat: ${input.status}` : "Koleksi dihapus", metadata: { bookId, source: "CURATED" }, createdAt: now,
        });
        return { bookId };
    });
}

// --- Manager settings and admin -----------------------------------------------------------------------

export async function updateLibraryAccessSettings(libraryId: string, userId: string, input: LibraryAccessSettingsInput) {
    return db.transaction(async (tx) => {
        if (!(await isLibraryManager(userId, libraryId, tx))) throw new NotFoundError("Perpustakaan tidak ditemukan.");
        await tx.update(libraries).set({ ...input, updatedAt: new Date() }).where(eq(libraries.id, libraryId));
        return { id: libraryId };
    });
}

/** Every library for `/admin/libraries`, hidden ones included, with its managers and open requests. */
export async function listLibrariesForAdmin() {
    const rows = await db
        .select({
            ...libraryColumns,
            hiddenAt: libraries.hiddenAt,
            holdings: sql<number>`(select count(*)::int from ${libraryHoldings} where ${libraryHoldings.libraryId} = ${libraries.id})`,
            openRequests: sql<number>`(select count(*)::int from ${bookAccesses} where ${bookAccesses.libraryId} = ${libraries.id} and ${bookAccesses.status} in ('PENDING', 'APPROVED'))`,
        })
        .from(libraries)
        .orderBy(asc(libraries.name));
    const managers = rows.length
        ? await db.select({ libraryId: libraryManagers.libraryId, userId: libraryManagers.userId, displayName: userProfiles.displayName })
            .from(libraryManagers).innerJoin(userProfiles, eq(userProfiles.id, libraryManagers.userId))
            .where(inArray(libraryManagers.libraryId, rows.map((row) => row.id)))
        : [];
    return rows.map((row) => ({ ...row, managers: managers.filter((manager) => manager.libraryId === row.id) }));
}

/** Libraries on the Peta Literasi that are not a TemuBaca library yet. */
export function listLibraryPlacesWithoutLibrary() {
    return db
        .select({ id: places.id, name: places.name, addressPublic: places.addressPublic, regionCode: places.regionCode })
        .from(places)
        .where(and(eq(places.type, "LIBRARY"), isNull(places.hiddenAt), sql`not exists (select 1 from ${libraries} where ${libraries.placeId} = ${places.id})`))
        .orderBy(asc(places.name));
}

/** Creates a library from its Peta Literasi place. Opening hours and website stay empty until someone knows them. */
export async function createLibraryFromPlace(placeId: string, actorId: string | null, client?: Tx) {
    const run = async (tx: Tx) => {
        const now = new Date();
        const [place] = await tx.select({ id: places.id, name: places.name, addressPublic: places.addressPublic, regionCode: places.regionCode })
            .from(places).where(and(eq(places.id, placeId), eq(places.type, "LIBRARY")));
        if (!place) throw new NotFoundError("Perpustakaan tidak ditemukan di Peta Literasi.");
        try {
            const [library] = await tx.insert(libraries)
                .values({ name: place.name, publicLocation: place.addressPublic, regionCode: place.regionCode, placeId: place.id, source: "Peta Literasi", createdAt: now, updatedAt: now })
                .returning({ id: libraries.id });
            await tx.insert(adminAuditLogs).values({ actorId, action: "LIBRARY_CREATED", targetType: "LIBRARY", targetId: library.id, note: place.name, metadata: { placeId }, createdAt: now });
            return library;
        } catch (error) {
            if (isUniqueViolation(error)) throw new ConflictError("Tempat ini sudah menjadi perpustakaan di TemuBaca.");
            throw error;
        }
    };
    return client ? run(client) : db.transaction(run);
}

export async function updateLibrary(libraryId: string, input: UpdateLibraryInput, actorId: string) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const { hidden, ...fields } = input;
        const [current] = await tx.select({ hiddenAt: libraries.hiddenAt }).from(libraries).where(eq(libraries.id, libraryId)).for("update");
        if (!current) throw new NotFoundError("Perpustakaan tidak ditemukan.");
        await tx.update(libraries)
            .set({ ...fields, hiddenAt: hidden ? current.hiddenAt ?? now : null, updatedAt: now })
            .where(eq(libraries.id, libraryId));
        await tx.insert(adminAuditLogs).values({ actorId, action: "LIBRARY_UPDATED", targetType: "LIBRARY", targetId: libraryId, note: input.name, metadata: { hidden }, createdAt: now });
        return { id: libraryId };
    });
}

/** Accounts an admin may appoint, by display name; never the email (TB-023). */
export function searchAccountsForManager(q: string) {
    return db
        .select({ id: userProfiles.id, displayName: userProfiles.displayName })
        .from(userProfiles)
        .where(and(ilike(userProfiles.displayName, `%${escapeLike(q)}%`), isNull(userProfiles.suspendedAt), isNull(userProfiles.deletionRequestedAt), isNull(userProfiles.deletedAt)))
        .orderBy(asc(userProfiles.displayName))
        .limit(10);
}

/** Appoints or removes a manager; a suspended or deleted account cannot be appointed. */
export async function setLibraryManager(libraryId: string, userId: string, actorId: string, appointed: boolean) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [library] = await tx.select({ id: libraries.id }).from(libraries).where(eq(libraries.id, libraryId));
        if (!library) throw new NotFoundError("Perpustakaan tidak ditemukan.");
        if (appointed) {
            const [user] = await tx.select({ suspendedAt: userProfiles.suspendedAt, deletionRequestedAt: userProfiles.deletionRequestedAt })
                .from(userProfiles).where(eq(userProfiles.id, userId));
            if (!user) throw new NotFoundError("Akun tidak ditemukan.");
            if (user.suspendedAt || user.deletionRequestedAt) throw new ConflictError("Akun yang ditangguhkan atau sedang dihapus tidak dapat menjadi pengelola.");
            const inserted = await tx.insert(libraryManagers).values({ libraryId, userId, createdById: actorId, createdAt: now }).onConflictDoNothing().returning({ id: libraryManagers.id });
            if (!inserted.length) return { changed: false };
        } else {
            const removed = await tx.delete(libraryManagers).where(and(eq(libraryManagers.libraryId, libraryId), eq(libraryManagers.userId, userId))).returning({ id: libraryManagers.id });
            if (!removed.length) return { changed: false };
        }
        await tx.insert(adminAuditLogs).values({
            actorId, action: appointed ? "LIBRARY_MANAGER_ADDED" : "LIBRARY_MANAGER_REMOVED", targetType: "LIBRARY", targetId: libraryId, metadata: { userId }, createdAt: now,
        });
        return { changed: true };
    });
}

