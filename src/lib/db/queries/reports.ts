import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { reports, type reportStatusValues, type targetTypeValues } from "../schema";

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
