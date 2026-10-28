import "server-only";

import { and, desc, eq, ilike, isNotNull, sql } from "drizzle-orm";

import { db } from "../client";
import { adminAuditLogs, reports, userProfiles, type userRoles } from "../schema";

type Role = (typeof userRoles)[number];

function likePattern(query: string | undefined) {
    const trimmed = query?.trim();
    return trimmed ? `%${trimmed.replace(/[\\%_]/g, "\\$&")}%` : undefined;
}

/** Account directory for admins (Figma "Data Pengguna" 147:807); emails come from Supabase separately. */
export async function listUsersForAdmin(options: { query?: string; role?: Role } = {}) {
    const pattern = likePattern(options.query);
    return db
        .select({
            id: userProfiles.id,
            displayName: userProfiles.displayName,
            role: userProfiles.role,
            createdAt: userProfiles.createdAt,
            suspendedAt: userProfiles.suspendedAt,
            suspendedReason: userProfiles.suspendedReason,
            deletionScheduledFor: userProfiles.deletionScheduledFor,
            deletedAt: userProfiles.deletedAt,
            listingCount: sql<number>`(select count(*)::int from "book_listings" where "book_listings"."ownerId" = "user_profiles"."id")`,
            managedCommunityCount: sql<number>`(
                select count(distinct "communities"."id")::int from "communities"
                left join "community_memberships" on "community_memberships"."communityId" = "communities"."id"
                    and "community_memberships"."userId" = "user_profiles"."id"
                    and "community_memberships"."status" = 'ACTIVE'
                    and "community_memberships"."role" in ('OWNER', 'MANAGER')
                where "communities"."ownerId" = "user_profiles"."id" or "community_memberships"."id" is not null
            )`,
            bookmarkCount: sql<number>`(select count(*)::int from "bookmarks" where "bookmarks"."userId" = "user_profiles"."id")`,
            reportCount: sql<number>`(
                select count(*)::int from "reports"
                where ("reports"."targetType" = 'USER' and "reports"."targetId" = "user_profiles"."id")
                or ("reports"."targetType" = 'BOOK_LISTING' and "reports"."targetId" in (
                    select "book_listings"."id" from "book_listings" where "book_listings"."ownerId" = "user_profiles"."id"
                ))
            )`,
        })
        .from(userProfiles)
        .where(and(
            pattern ? ilike(userProfiles.displayName, pattern) : undefined,
            options.role ? eq(userProfiles.role, options.role) : undefined,
        ))
        .orderBy(desc(userProfiles.createdAt))
        .limit(200);
}

export async function countUsers() {
    const [row] = await db
        .select({
            total: sql<number>`count(*)::int`,
            suspended: sql<number>`count(*) filter (where ${userProfiles.suspendedAt} is not null)::int`,
            pendingDeletion: sql<number>`count(*) filter (where ${userProfiles.deletionRequestedAt} is not null and ${userProfiles.deletedAt} is null)::int`,
            deleted: sql<number>`count(*) filter (where ${userProfiles.deletedAt} is not null)::int`,
        })
        .from(userProfiles);
    return { total: row?.total ?? 0, suspended: row?.suspended ?? 0, pendingDeletion: row?.pendingDeletion ?? 0, deleted: row?.deleted ?? 0 };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Suspend or reinstate an account and record it in the admin audit log, atomically. */
export async function setUserSuspension(input: { targetId: string; actorId: string; suspended: boolean; reason?: string }) {
    return db.transaction((tx) => setUserSuspensionIn(tx, input));
}

/** `setUserSuspension` inside a caller's transaction, e.g. a dispute decision that suspends a party. */
export async function setUserSuspensionIn(tx: Tx, input: { targetId: string; actorId: string; suspended: boolean; reason?: string }) {
    const [target] = await tx.select({ id: userProfiles.id, suspendedAt: userProfiles.suspendedAt, role: userProfiles.role })
        .from(userProfiles).where(eq(userProfiles.id, input.targetId)).for("update");
    if (!target) return { status: "not_found" as const };
    if (Boolean(target.suspendedAt) === input.suspended) return { status: "unchanged" as const, role: target.role };

    const now = new Date();
    await tx.update(userProfiles).set(input.suspended
        ? { suspendedAt: now, suspendedReason: input.reason ?? null, suspendedById: input.actorId, updatedAt: now }
        : { suspendedAt: null, suspendedReason: null, suspendedById: null, updatedAt: now })
        .where(eq(userProfiles.id, target.id));
    await tx.insert(adminAuditLogs).values({
        actorId: input.actorId,
        action: input.suspended ? "USER_SUSPENDED" : "USER_REINSTATED",
        targetType: "USER",
        targetId: target.id,
        note: input.reason || null,
        createdAt: now,
    });
    return { status: "updated" as const, role: target.role };
}

export async function setUserRole(input: { targetId: string; actorId: string; role: Role; note?: string }) {
    return db.transaction(async (tx) => {
        const [target] = await tx.select({ id: userProfiles.id, role: userProfiles.role })
            .from(userProfiles).where(eq(userProfiles.id, input.targetId)).for("update");
        if (!target) return { status: "not_found" as const };
        if (target.role === input.role) return { status: "unchanged" as const };

        const now = new Date();
        await tx.update(userProfiles).set({ role: input.role, updatedAt: now }).where(eq(userProfiles.id, target.id));
        await tx.insert(adminAuditLogs).values({
            actorId: input.actorId,
            action: "USER_ROLE_CHANGED",
            targetType: "USER",
            targetId: target.id,
            note: input.note || null,
            metadata: { from: target.role, to: input.role },
            createdAt: now,
        });
        return { status: "updated" as const };
    });
}

export async function recordEmailReveal(actorId: string, targetId: string) {
    await db.insert(adminAuditLogs).values({ actorId, action: "USER_EMAIL_REVEALED", targetType: "USER", targetId, createdAt: new Date() });
}

export async function listUserAuditTrail(targetId: string, limit = 6) {
    return db
        .select({ id: adminAuditLogs.id, action: adminAuditLogs.action, note: adminAuditLogs.note, metadata: adminAuditLogs.metadata, createdAt: adminAuditLogs.createdAt, actorName: userProfiles.displayName })
        .from(adminAuditLogs)
        .leftJoin(userProfiles, eq(adminAuditLogs.actorId, userProfiles.id))
        .where(and(eq(adminAuditLogs.targetType, "USER"), eq(adminAuditLogs.targetId, targetId)))
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit);
}

/** Reports filed about the account itself (not by it), newest first. */
export async function listReportsAboutUser(targetId: string, limit = 3) {
    return db
        .select({ id: reports.id, reason: reports.reason, status: reports.status, createdAt: reports.createdAt })
        .from(reports)
        .where(and(eq(reports.targetType, "USER"), eq(reports.targetId, targetId), isNotNull(reports.id)))
        .orderBy(desc(reports.createdAt))
        .limit(limit);
}
