import "server-only";

import {
    and,
    count,
    desc,
    eq,
    ilike,
    isNull,
    ne,
    or,
    sql,
} from "drizzle-orm";

import {
    listingDeletionBlocker,
    type ListingDeletionBlocker,
} from "@/features/book-listings/listing-deletion";

import type { CatalogAvailability, CatalogSort } from "@/features/books/catalog-url";
import { genreBySlug, genres } from "@/features/books/genres";
import { meetingPointsOf } from "@/features/borrowing/lifecycle";
import { ValidationError } from "@/lib/api/errors";

import { db } from "../client";
import { listingManagedBy, listingVisible } from "./listing-access";
import { meetingPlaceNames } from "./places";
import { getSettings } from "./settings";

import {
    books,
    bookListings,
    borrowRequests,
    libraries,
    libraryHoldings,
} from "../schema";


/** Fields safe and useful for public catalog responses; omits raw provider metadata and internal timestamps. */
export const publicBookColumns = {
    id: books.id,
    provider: books.provider,
    providerId: books.providerId,
    isbn: books.isbn,
    title: books.title,
    authors: books.authors,
    description: books.description,
    publisher: books.publisher,
    publishedAt: books.publishedAt,
    language: books.language,
    categories: books.categories,
    coverUrl: books.coverUrl,
};

export async function findBookById(
    bookId: string,
) {
    return db.query.books.findFirst({
        where: eq(books.id, bookId),

        columns: {
            id: true,
            provider: true,
            providerId: true,
            isbn: true,
            title: true,
            authors: true,
            description: true,
            publisher: true,
            publishedAt: true,
            language: true,
            categories: true,
            coverUrl: true,
        },

        with: {
            listings: {
                with: {
                    ownerUser: {
                        columns: {
                            displayName: true,
                        },
                    },
                },

                where: (listing, { and, eq, isNull }) =>
                    and(eq(listing.availability, "AVAILABLE"), isNull(listing.hiddenAt), listingVisible(listing.ownerId, listing.communityId)),

                orderBy: (table, { desc }) => [
                    desc(table.createdAt),
                ],
            },
        },
    });
}

export async function findBookByProvider(
    provider: (typeof import("@/lib/db/schema").bookProviderValues)[number],
    providerId: string,
) {
    return db.query.books.findFirst({
        where: and(
            eq(books.provider, provider),
            eq(books.providerId, providerId),
        ),
    });
}

export async function searchBooks(
    query: string,
    limit = 20,
    offset = 0,
) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return [];
    }

    const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
    const search = `%${escapedQuery}%`;
    const searchCondition = or(
        ilike(books.title, search),
        ilike(books.isbn, search),
        sql`array_to_string(${books.authors}, ' ') ILIKE ${search}`,
        sql`array_to_string(${books.categories}, ' ') ILIKE ${search}`,
    );

    return db
        .select(publicBookColumns)
        .from(books)
        .where(searchCondition)
        .orderBy(desc(books.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100))
        .offset(Math.max(offset, 0));
}

function textSearchCondition(query: string) {
    const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
    const search = `%${escapedQuery}%`;
    return or(
        ilike(books.title, search),
        ilike(books.isbn, search),
        sql`array_to_string(${books.authors}, ' ') ILIKE ${search}`,
        sql`array_to_string(${books.categories}, ' ') ILIKE ${search}`,
    );
}

export type BookBrowseFilters = {
    q?: string;
    category?: string;
    language?: string;
    availability?: CatalogAvailability;
    sort?: CatalogSort;
};

/**
 * Copies readers offer now: AVAILABLE, not hidden, from an owner who is not suspended or leaving.
 * Qualified names: drizzle renders bare column refs unqualified inside sql``, which would bind to the subquery table.
 */
/** Raw-SQL twin of `listingVisible` for subqueries over "book_listings" (personal owner active, or community verified). */
export const publicListingSql = sql`(("book_listings"."communityId" is null and "book_listings"."ownerId" not in (select "user_profiles"."id" from "user_profiles" where "user_profiles"."suspendedAt" is not null or "user_profiles"."deletionRequestedAt" is not null))
    or "book_listings"."communityId" in (select "communities"."id" from "communities" where "communities"."status" = 'VERIFIED'))`;

const availableCopiesSql = sql<number>`(
    select count(*)::int from ${bookListings}
    where "book_listings"."bookId" = "books"."id" and "book_listings"."availability" = 'AVAILABLE'
    and "book_listings"."hiddenAt" is null
    and ${publicListingSql}
)`;

/** Recorded at a library readers can see (TB-023). */
const heldByLibrarySql = sql`exists (
    select 1 from ${libraryHoldings} join ${libraries} on "libraries"."id" = "library_holdings"."libraryId"
    where "library_holdings"."bookId" = "books"."id" and "libraries"."hiddenAt" is null
)`;

/** A genre slug matches any of its provider subjects; anything else is an exact subject (old links). */
function categoryCondition(category: string) {
    const genre = genreBySlug(category);
    return genre
        ? sql`exists (select 1 from unnest(${books.categories}) as subject where lower(subject) ~ ${genre.pattern})`
        : sql`${category} = ANY(${books.categories})`;
}

function browseCondition(filters: BookBrowseFilters) {
    const q = filters.q?.trim();
    return and(
        q ? textSearchCondition(q) : undefined,
        filters.category ? categoryCondition(filters.category) : undefined,
        filters.language ? eq(books.language, filters.language) : undefined,
        filters.availability === "warga" ? sql`${availableCopiesSql} > 0` : undefined,
        filters.availability === "perpustakaan" ? heldByLibrarySql : undefined,
    );
}

const browseOrder = {
    terbaru: [desc(books.createdAt)],
    judul: [sql`lower(${books.title}) asc`, desc(books.createdAt)],
    salinan: [sql`${availableCopiesSql} desc`, desc(books.createdAt)],
} as const;

/** Catalog browse with optional text/category/language/availability filters, an order, and a count of AVAILABLE shared copies. */
export async function browseBooks(filters: BookBrowseFilters, limit = 10, offset = 0) {
    const where = browseCondition(filters);

    const [items, [countRow]] = await Promise.all([
        db
            .select({
                id: books.id,
                title: books.title,
                authors: books.authors,
                description: books.description,
                publisher: books.publisher,
                publishedAt: books.publishedAt,
                categories: books.categories,
                coverUrl: books.coverUrl,
                availableCopies: availableCopiesSql,
            })
            .from(books)
            .where(where)
            .orderBy(...browseOrder[filters.sort ?? "terbaru"])
            .limit(Math.min(Math.max(limit, 1), 50))
            .offset(Math.max(offset, 0)),
        db.select({ total: sql<number>`count(*)::int` }).from(books).where(where),
    ]);

    return { items, total: countRow?.total ?? 0 };
}

/** Genre counts for the /books filter (see features/books/genres.ts), most common first; empty genres are left out. */
export async function listGenreFacets() {
    const counts = sql.join(
        genres.map((genre) => sql`count(*) filter (where exists (select 1 from unnest(${books.categories}) as subject where lower(subject) ~ ${genre.pattern}))::int`),
        sql`, `,
    );
    const result = await db.execute<{ counts: number[] }>(sql`select array[${counts}] as counts from ${books}`);
    const totals = result.rows[0]?.counts ?? [];
    return genres
        .map((genre, index) => ({ value: genre.slug, label: genre.label, total: Number(totals[index] ?? 0) }))
        .filter((facet) => facet.total > 0)
        .sort((a, b) => b.total - a.total);
}

/** Most common raw provider subjects and languages. */
export async function listBookFacets(limit = 8) {
    const [categories, languages] = await Promise.all([
        db.execute<{ value: string; total: number }>(sql`
            select category as value, count(*)::int as total
            from ${books}, unnest(${books.categories}) as category
            group by category order by total desc, category asc limit ${limit}
        `),
        db
            .select({ value: books.language, total: sql<number>`count(*)::int` })
            .from(books)
            .where(sql`${books.language} is not null and ${books.language} <> ''`)
            .groupBy(books.language)
            .orderBy(desc(sql`count(*)`))
            .limit(limit),
    ]);

    return {
        categories: categories.rows.map((row) => ({ value: row.value, total: Number(row.total) })),
        languages: languages.flatMap((row) => (row.value ? [{ value: row.value, total: row.total }] : [])),
    };
}

export async function countBooks() {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(books);

    return result?.total ?? 0;
}

export async function countBooksMatchingQuery(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return 0;
    }

    const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
    const search = `%${escapedQuery}%`;
    const searchCondition = or(
        ilike(books.title, search),
        ilike(books.isbn, search),
        sql`array_to_string(${books.authors}, ' ') ILIKE ${search}`,
        sql`array_to_string(${books.categories}, ' ') ILIKE ${search}`,
    );

    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(books)
        .where(searchCondition);

    return result?.total ?? 0;
}

export async function listBooks(
    limit = 20,
    offset = 0,
) {
    return db
        .select()
        .from(books)
        .orderBy(desc(books.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100))
        .offset(Math.max(offset, 0));
}

/** Latest catalog entries for public surfaces; uses the safe public projection. */
export async function listLatestPublicBooks(limit = 4) {
    return db
        .select(publicBookColumns)
        .from(books)
        .orderBy(desc(books.createdAt))
        .limit(Math.min(Math.max(limit, 1), 24));
}

export async function listBookListings(
    bookId: string,
) {
    return db.query.bookListings.findMany({
        where: and(
            eq(bookListings.bookId, bookId),
            eq(
                bookListings.availability,
                "AVAILABLE",
            ),
            // Listings hidden by an admin, or owned by a suspended account, never reach public pages.
            isNull(bookListings.hiddenAt),
            listingVisible(bookListings.ownerId, bookListings.communityId),
        ),

        with: {
            ownerUser: {
                columns: {
                    displayName: true,
                    createdAt: true,
                },
            },
            // A community's copy is shown as the community, not the manager who added it.
            community: { columns: { id: true, name: true, logoPath: true, createdAt: true } },
        },

        orderBy: (table, { desc }) => [
            desc(table.updatedAt),
        ],
    });
}

const listingBookColumns = { id: true, title: true, authors: true, categories: true, publishedAt: true, publisher: true, coverUrl: true } as const;

/** Every copy in a community's collection, for its managers (30 Okt 2026). */
export async function listCommunityBookListings(communityId: string) {
    return db.query.bookListings.findMany({
        where: eq(bookListings.communityId, communityId),
        with: { book: { columns: listingBookColumns } },
        orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
}

/** The community's copies the public may see and borrow: offered or reserved, not hidden, community verified. */
export async function listPublicCommunityBookListings(communityId: string) {
    return db.query.bookListings.findMany({
        where: and(
            eq(bookListings.communityId, communityId),
            isNull(bookListings.hiddenAt),
            ne(bookListings.availability, "UNAVAILABLE"),
            listingVisible(bookListings.ownerId, bookListings.communityId),
        ),
        with: { book: { columns: listingBookColumns } },
        orderBy: (table, { asc }) => [asc(table.availability), desc(table.createdAt)],
    });
}

/** The reader's own copies; copies added for a community live in that community's collection. */
export async function listUserBookListings(userId: string) {
    return db.query.bookListings.findMany({
        where: and(eq(bookListings.ownerId, userId), isNull(bookListings.communityId)),
        with: {
            book: {
                columns: {
                    id: true,
                    title: true,
                    authors: true,
                    categories: true,
                    publishedAt: true,
                    publisher: true,
                    coverUrl: true,
                },
            },
        },
        orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
}

export async function countUserBookListings(userId: string) {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(bookListings)
        .where(eq(bookListings.ownerId, userId));
    return result?.total ?? 0;
}

export async function findBookListingById(
    listingId: string,
) {
    return db.query.bookListings.findFirst({
        where: eq(bookListings.id, listingId),

        with: {
            book: {
                columns: {
                    id: true,
                    title: true,
                    authors: true,
                    categories: true,
                    publishedAt: true,
                    coverUrl: true,
                },
            },
            ownerUser: { columns: { id: true, displayName: true } },
        },
    });
}

export async function findAvailableBookListings(
    bookId: string,
) {
    return db.query.bookListings.findMany({
        where: and(
            eq(bookListings.bookId, bookId),
            eq(
                bookListings.availability,
                "AVAILABLE",
            ),
            // Listings hidden by an admin, or owned by a suspended account, never reach public pages.
            isNull(bookListings.hiddenAt),
            listingVisible(bookListings.ownerId, bookListings.communityId),
        ),

        with: {
            ownerUser: {
                columns: {
                    displayName: true,
                },
            },
        },
    });
}

/**
 * The Peta Literasi places a listing keeps (TB-027): those whose name is still one of its meeting
 * points. Newly sent ids (`strict`) must be curated places on the map; stored ids that no longer
 * qualify, or whose point was edited away, are dropped quietly.
 */
async function linkedMeetingPlaces(publicLocation: string | null | undefined, placeIds: string[], strict: boolean) {
    const ids = [...new Set(placeIds)];
    const names = await meetingPlaceNames(ids);
    if (strict && names.size !== ids.length) throw new ValidationError("Titik temu dari peta tidak ditemukan di Peta Literasi.");
    const points = meetingPointsOf(publicLocation);
    return ids.filter((id) => points.includes(names.get(id) ?? ""));
}

/**
 * With "titik temu hanya dari daftar aman" on (Pengaturan → Aturan Pinjam, 30 Okt 2026), every meeting
 * point must be a Peta Literasi place; typed places are refused.
 */
async function assertMeetingPointsAllowed(publicLocation: string | null | undefined, linkedIds: string[]) {
    if (!(await getSettings("borrowing")).settings.meetingPointsFromMapOnly) return;
    if (meetingPointsOf(publicLocation).length > linkedIds.length) {
        throw new ValidationError("Titik temu harus dipilih dari Peta Literasi (perpustakaan atau titik temu publik).");
    }
}

export async function createBookListing(input: {
    ownerId: string;
    bookId: string;
    condition:
    | "NEW"
    | "LIKE_NEW"
    | "GOOD"
    | "FAIR"
    | "POOR";
    availability?:
    | "AVAILABLE"
    | "UNAVAILABLE"
    | "RESERVED";
    publicLocation?: string;
    meetingPlaceIds?: string[];
    borrowingRules?: string;
    communityId?: string;
}) {
    const meetingPlaceIds = await linkedMeetingPlaces(input.publicLocation, input.meetingPlaceIds ?? [], true);
    await assertMeetingPointsAllowed(input.publicLocation, meetingPlaceIds);
    const [listing] = await db
        .insert(bookListings)
        .values({
            ownerId: input.ownerId,
            communityId: input.communityId ?? null,
            bookId: input.bookId,
            condition: input.condition,
            availability:
                input.availability ?? "AVAILABLE",
            publicLocation:
                input.publicLocation,
            meetingPlaceIds,
            borrowingRules:
                input.borrowingRules,
        })
        .returning();

    return listing;
}

export async function updateBookListing(
    listingId: string,
    ownerId: string,
    input: {
        condition?:
        | "NEW"
        | "LIKE_NEW"
        | "GOOD"
        | "FAIR"
        | "POOR";

        availability?:
        | "AVAILABLE"
        | "UNAVAILABLE"
        | "RESERVED";

        publicLocation?: string | null;

        meetingPlaceIds?: string[];

        borrowingRules?: string | null;
    },
) {
    // Editing the meeting points re-checks which of them are Peta Literasi places.
    let meetingPlaceIds: string[] | undefined;
    if (input.publicLocation !== undefined || input.meetingPlaceIds !== undefined) {
        const current = await db.query.bookListings.findFirst({
            where: and(eq(bookListings.id, listingId), listingManagedBy(ownerId, bookListings.ownerId, bookListings.communityId)),
            columns: { publicLocation: true, meetingPlaceIds: true },
        });
        if (!current) return null;
        meetingPlaceIds = await linkedMeetingPlaces(
            input.publicLocation !== undefined ? input.publicLocation : current.publicLocation,
            input.meetingPlaceIds ?? current.meetingPlaceIds,
            input.meetingPlaceIds !== undefined,
        );
        if (input.publicLocation !== undefined) await assertMeetingPointsAllowed(input.publicLocation, meetingPlaceIds);
    }

    const [listing] = await db
        .update(bookListings)
        .set({
            ...(input.condition !== undefined
                ? {
                    condition: input.condition,
                }
                : {}),

            ...(input.availability !== undefined
                ? {
                    availability:
                        input.availability,
                }
                : {}),

            ...(input.publicLocation !== undefined
                ? {
                    publicLocation:
                        input.publicLocation,
                }
                : {}),

            ...(meetingPlaceIds !== undefined
                ? {
                    meetingPlaceIds,
                }
                : {}),

            ...(input.borrowingRules !== undefined
                ? {
                    borrowingRules:
                        input.borrowingRules,
                }
                : {}),

            updatedAt: new Date(),
        })
        .where(and(
            eq(bookListings.id, listingId),
            listingManagedBy(ownerId, bookListings.ownerId, bookListings.communityId),
        ))
        .returning();

    return listing ?? null;
}

export type DeleteBookListingResult =
    | { status: "deleted"; id: string }
    | { status: "not_found" }
    | { status: "blocked"; reason: ListingDeletionBlocker };

export async function deleteBookListing(
    listingId: string,
    ownerId: string,
): Promise<DeleteBookListingResult> {
    return db.transaction(async (tx) => {
        const [listing] = await tx
            .select({ id: bookListings.id, availability: bookListings.availability })
            .from(bookListings)
            .where(and(
                eq(bookListings.id, listingId),
                listingManagedBy(ownerId, bookListings.ownerId, bookListings.communityId),
            ))
            .for("update");

        if (!listing) return { status: "not_found" };

        const [{ requestCount }] = await tx
            .select({ requestCount: count() })
            .from(borrowRequests)
            .where(eq(borrowRequests.listingId, listingId));

        const blocker = listingDeletionBlocker({
            availability: listing.availability,
            borrowRequestCount: requestCount,
        });
        if (blocker) return { status: "blocked", reason: blocker };

        await tx.delete(bookListings).where(eq(bookListings.id, listingId));
        return { status: "deleted", id: listingId };
    });
}
