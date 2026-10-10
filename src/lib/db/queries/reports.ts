import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../client";
import { bookListings, books, communities, events, merchandiseListings, reports, userProfiles, type reportStatusValues, type targetTypeValues } from "../schema";

type ReportFilters = {
    status?: (typeof reportStatusValues)[number];
    targetType?: (typeof targetTypeValues)[number];
    limit: number;
    offset: number;
};

function reportFilter(filters: Pick<ReportFilters, "status" | "targetType">) {
    return and(
        filters.status ? eq(reports.status, filters.status) : undefined,
        filters.targetType ? eq(reports.targetType, filters.targetType) : undefined,
    );
}

export async function createReport(input: {
    reporterId: string;
    targetType: (typeof targetTypeValues)[number];
    targetId: string;
    reason: string;
    details?: string;
}) {
    const [report] = await db.insert(reports).values(input).returning({
        id: reports.id,
        status: reports.status,
        createdAt: reports.createdAt,
    });
    return report;
}

export async function listReports(filters: ReportFilters) {
    const where = reportFilter(filters);
    const [items, count] = await Promise.all([
        db.query.reports.findMany({
            where,
            columns: {
                id: true,
                targetType: true,
                targetId: true,
                reason: true,
                details: true,
                status: true,
                outcome: true,
                createdAt: true,
                reviewedAt: true,
            },
            with: { reporter: { columns: { displayName: true } } },
            orderBy: [desc(reports.createdAt)],
            limit: filters.limit,
            offset: filters.offset,
        }),
        db.select({ total: sql<number>`count(*)::int` }).from(reports).where(where),
    ]);
    return { items, total: count[0]?.total ?? 0 };
}

export async function countReportsByStatus(status: (typeof reportStatusValues)[number]) {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(reports)
        .where(eq(reports.status, status));
    return result?.total ?? 0;
}

export async function updateReportReview(input: {
    reportId: string;
    reviewerId: string;
    status: (typeof reportStatusValues)[number];
    outcome?: string;
}) {
    const closed = input.status === "RESOLVED" || input.status === "REJECTED";
    const [report] = await db.update(reports).set({
        status: input.status,
        reviewerId: input.reviewerId,
        ...(input.outcome !== undefined ? { outcome: input.outcome || null } : {}),
        reviewedAt: closed ? new Date() : null,
        updatedAt: new Date(),
    }).where(eq(reports.id, input.reportId)).returning({
        id: reports.id,
        status: reports.status,
        reviewedAt: reports.reviewedAt,
    });
    return report ?? null;
}

/** Apply one moderation decision to several reports about the same item in a single (atomic) UPDATE. */
export async function updateReportsReview(input: {
    reportIds: string[];
    reviewerId: string;
    status: (typeof reportStatusValues)[number];
    outcome?: string;
}) {
    const closed = input.status === "RESOLVED" || input.status === "REJECTED";
    return db.update(reports).set({
        status: input.status,
        reviewerId: input.reviewerId,
        ...(input.outcome !== undefined ? { outcome: input.outcome || null } : {}),
        reviewedAt: closed ? new Date() : null,
        updatedAt: new Date(),
    }).where(inArray(reports.id, input.reportIds)).returning({ id: reports.id, status: reports.status });
}

export type ReportTargetSummary = {
    title: string;
    subtitle: string;
    href: string | null;
};

type TargetRef = { targetType: (typeof targetTypeValues)[number]; targetId: string };

/** Resolve reported items to a short admin-facing label. Missing targets are omitted from the map. */
export async function resolveReportTargets(targets: TargetRef[]) {
    const idsOf = (type: TargetRef["targetType"]) => [...new Set(targets.filter((t) => t.targetType === type).map((t) => t.targetId))];
    const result = new Map<string, ReportTargetSummary>();
    const key = (type: string, id: string) => `${type}:${id}`;

    const [bookRows, listingRows, communityRows, eventRows, merchRows, userRows] = await Promise.all([
        idsOf("BOOK").length ? db.select({ id: books.id, title: books.title, authors: books.authors }).from(books).where(inArray(books.id, idsOf("BOOK"))) : [],
        idsOf("BOOK_LISTING").length ? db.select({ id: bookListings.id, bookId: books.id, title: books.title, owner: userProfiles.displayName, availability: bookListings.availability })
            .from(bookListings).innerJoin(books, eq(bookListings.bookId, books.id)).innerJoin(userProfiles, eq(bookListings.ownerId, userProfiles.id))
            .where(inArray(bookListings.id, idsOf("BOOK_LISTING"))) : [],
        idsOf("COMMUNITY").length ? db.select({ id: communities.id, name: communities.name, status: communities.status }).from(communities).where(inArray(communities.id, idsOf("COMMUNITY"))) : [],
        idsOf("EVENT").length ? db.select({ id: events.id, title: events.title, community: communities.name, status: events.publicationStatus })
            .from(events).innerJoin(communities, eq(events.communityId, communities.id)).where(inArray(events.id, idsOf("EVENT"))) : [],
        idsOf("MERCHANDISE_LISTING").length ? db.select({ id: merchandiseListings.id, title: merchandiseListings.title, community: communities.name, status: merchandiseListings.status })
            .from(merchandiseListings).innerJoin(communities, eq(merchandiseListings.communityId, communities.id)).where(inArray(merchandiseListings.id, idsOf("MERCHANDISE_LISTING"))) : [],
        idsOf("USER").length ? db.select({ id: userProfiles.id, name: userProfiles.displayName }).from(userProfiles).where(inArray(userProfiles.id, idsOf("USER"))) : [],
    ]);

    for (const row of bookRows) result.set(key("BOOK", row.id), { title: row.title, subtitle: `Buku • ${row.authors.join(", ") || "Penulis belum tercatat"}`, href: `/books/${row.id}` });
    for (const row of listingRows) result.set(key("BOOK_LISTING", row.id), { title: row.title, subtitle: `Listing buku • Pemilik: ${row.owner}`, href: `/books/${row.bookId}` });
    for (const row of communityRows) result.set(key("COMMUNITY", row.id), { title: row.name, subtitle: `Komunitas • ${row.status}`, href: row.status === "VERIFIED" ? `/communities/${row.id}` : null });
    for (const row of eventRows) result.set(key("EVENT", row.id), { title: row.title, subtitle: `Acara • ${row.community}`, href: row.status === "PUBLISHED" ? `/events/${row.id}` : null });
    for (const row of merchRows) result.set(key("MERCHANDISE_LISTING", row.id), { title: row.title, subtitle: `Merchandise • ${row.community}`, href: row.status === "PUBLISHED" ? `/merchandise/${row.id}` : null });
    for (const row of userRows) result.set(key("USER", row.id), { title: row.name, subtitle: "Akun pengguna", href: null });
    return result;
}
