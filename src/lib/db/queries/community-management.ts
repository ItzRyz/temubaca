import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";

import {
    INVITE_TTL_DAYS,
    MAX_PENDING_APPLICATIONS,
    submissionBlocker,
    type CommunityRole,
    type CommunityStatus,
} from "@/features/community-management/rules";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import type { CommunityApplicationInput, CommunityProfileInput } from "@/lib/validation/schemas/community-management.schema";

import { db } from "../client";
import {
    communities,
    communityInvites,
    communityMemberships,
    communitySubmissions,
    events,
    merchandiseListings,
    userProfiles,
    verifications,
} from "../schema";

export type EvidenceFile = { path: string; name: string; type: string; size: number };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** The caller's role in a community: the owner column wins, then an ACTIVE manager membership. */
export async function getCommunityAccess(userId: string, communityId: string) {
    const community = await db.query.communities.findFirst({ where: eq(communities.id, communityId) });
    if (!community) return null;
    if (community.ownerId === userId) return { community, role: "owner" as CommunityRole };
    const membership = await db.query.communityMemberships.findFirst({
        where: and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, userId), eq(communityMemberships.role, "MANAGER"), eq(communityMemberships.status, "ACTIVE")),
        columns: { id: true },
    });
    return membership ? { community, role: "manager" as CommunityRole } : { community, role: null };
}

/** Communities the user owns or manages, for "Komunitas Saya" and the manage menu. */
export async function listManagedCommunities(userId: string) {
    const managed = db
        .select({ communityId: communityMemberships.communityId })
        .from(communityMemberships)
        .where(and(eq(communityMemberships.userId, userId), eq(communityMemberships.role, "MANAGER"), eq(communityMemberships.status, "ACTIVE")));
    const rows = await db
        .select({ id: communities.id, name: communities.name, status: communities.status, ownerId: communities.ownerId, publicLocation: communities.publicLocation, createdAt: communities.createdAt })
        .from(communities)
        .where(or(eq(communities.ownerId, userId), inArray(communities.id, managed)))
        .orderBy(desc(communities.createdAt));
    return rows.map((row) => ({ ...row, role: (row.ownerId === userId ? "owner" : "manager") as CommunityRole }));
}

export async function createCommunityApplication(ownerId: string, input: CommunityApplicationInput, file: EvidenceFile | null) {
    return db.transaction(async (tx) => {
        // Serialise applications per account so the pending limit cannot be raced.
        await tx.select({ id: userProfiles.id }).from(userProfiles).where(eq(userProfiles.id, ownerId)).for("update");
        const [{ pending }] = await tx.select({ pending: count() }).from(communities).where(and(eq(communities.ownerId, ownerId), eq(communities.status, "PENDING")));
        if (pending >= MAX_PENDING_APPLICATIONS) {
            throw new ConflictError(`Anda sudah punya ${MAX_PENDING_APPLICATIONS} pengajuan komunitas yang menunggu ditinjau.`);
        }
        const [community] = await tx
            .insert(communities)
            .values({
                ownerId,
                name: input.name,
                description: input.description,
                publicLocation: input.publicLocation,
                contactEmail: input.contactEmail,
                instagramHandle: input.instagramHandle,
                whatsappNumber: input.whatsappNumber,
                status: "PENDING",
            })
            .returning({ id: communities.id });
        await tx.insert(communityMemberships).values({ userId: ownerId, communityId: community.id, role: "OWNER", status: "ACTIVE" });
        await tx.insert(communitySubmissions).values({
            communityId: community.id,
            submittedById: ownerId,
            evidenceUrl: input.evidenceUrl,
            note: input.note ?? null,
            filePath: file?.path ?? null,
            fileName: file?.name ?? null,
            fileType: file?.type ?? null,
            fileSize: file?.size ?? null,
        });
        return community;
    });
}

export async function updateCommunityProfile(communityId: string, input: CommunityProfileInput) {
    const [community] = await db
        .update(communities)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(communities.id, communityId), ne(communities.status, "SUSPENDED")))
        .returning({ id: communities.id });
    if (!community) throw new ConflictError("Profil komunitas yang ditangguhkan tidak dapat diubah.");
    return community;
}

/** Re-verification of a VERIFIED community, or a new attempt after rejection (back to PENDING). */
export async function createVerificationSubmission(communityId: string, userId: string, input: { evidenceUrl: string; note?: string }, file: EvidenceFile | null) {
    return db.transaction(async (tx) => {
        const [community] = await tx.select({ id: communities.id, status: communities.status }).from(communities).where(eq(communities.id, communityId)).for("update");
        if (!community) throw new NotFoundError("Komunitas tidak ditemukan.");
        const [{ open }] = await tx.select({ open: count() }).from(communitySubmissions).where(and(eq(communitySubmissions.communityId, communityId), eq(communitySubmissions.status, "PENDING")));
        const blocker = submissionBlocker(community.status as CommunityStatus, open > 0);
        if (blocker) throw new ConflictError(blocker);

        const [submission] = await tx
            .insert(communitySubmissions)
            .values({
                communityId,
                submittedById: userId,
                evidenceUrl: input.evidenceUrl,
                note: input.note ?? null,
                filePath: file?.path ?? null,
                fileName: file?.name ?? null,
                fileType: file?.type ?? null,
                fileSize: file?.size ?? null,
            })
            .returning({ id: communitySubmissions.id });
        if (community.status === "REJECTED") {
            await tx.update(communities).set({ status: "PENDING", updatedAt: new Date() }).where(eq(communities.id, communityId));
        }
        return { id: submission.id, status: community.status === "REJECTED" ? "PENDING" : community.status };
    });
}

export function listCommunitySubmissions(communityId: string, limit = 10) {
    return db
        .select({
            id: communitySubmissions.id,
            evidenceUrl: communitySubmissions.evidenceUrl,
            note: communitySubmissions.note,
            filePath: communitySubmissions.filePath,
            fileName: communitySubmissions.fileName,
            fileSize: communitySubmissions.fileSize,
            status: communitySubmissions.status,
            reviewNote: communitySubmissions.reviewNote,
            createdAt: communitySubmissions.createdAt,
            reviewedAt: communitySubmissions.reviewedAt,
        })
        .from(communitySubmissions)
        .where(eq(communitySubmissions.communityId, communityId))
        .orderBy(desc(communitySubmissions.createdAt))
        .limit(limit);
}

export function findCommunitySubmission(communityId: string, submissionId: string) {
    return db.query.communitySubmissions.findFirst({ where: and(eq(communitySubmissions.id, submissionId), eq(communitySubmissions.communityId, communityId)) });
}

/** Re-verification requests of VERIFIED communities waiting for an admin (applications use the community review). */
export function listPendingReverifications(limit = 50) {
    return db
        .select({ id: communitySubmissions.id, communityId: communities.id, communityName: communities.name, evidenceUrl: communitySubmissions.evidenceUrl, note: communitySubmissions.note, fileName: communitySubmissions.fileName, createdAt: communitySubmissions.createdAt })
        .from(communitySubmissions)
        .innerJoin(communities, eq(communities.id, communitySubmissions.communityId))
        .where(and(eq(communitySubmissions.status, "PENDING"), eq(communities.status, "VERIFIED")))
        .orderBy(asc(communitySubmissions.createdAt))
        .limit(limit);
}

/** Admin answer to a re-verification: confirming refreshes the approval date; dismissing keeps the status. */
export async function reviewReverification(submissionId: string, adminId: string, input: { decision: "CONFIRM" | "DISMISS"; note?: string }) {
    return db.transaction(async (tx) => {
        const [row] = await tx
            .select({ id: communitySubmissions.id, status: communitySubmissions.status, communityId: communitySubmissions.communityId, communityStatus: communities.status })
            .from(communitySubmissions)
            .innerJoin(communities, eq(communities.id, communitySubmissions.communityId))
            .where(eq(communitySubmissions.id, submissionId))
            .for("update", { of: communitySubmissions });
        if (!row) throw new NotFoundError("Pengajuan tidak ditemukan.");
        if (row.status !== "PENDING") throw new ConflictError("Pengajuan ini sudah ditinjau.");
        if (row.communityStatus !== "VERIFIED") throw new ConflictError("Pengajuan komunitas baru ditinjau lewat Peninjauan.");

        const now = new Date();
        await tx
            .update(communitySubmissions)
            .set({ status: input.decision === "CONFIRM" ? "APPROVED" : "REJECTED", reviewerId: adminId, reviewNote: input.note ?? null, reviewedAt: now })
            .where(eq(communitySubmissions.id, submissionId));
        if (input.decision === "CONFIRM") {
            await tx.insert(verifications).values({ targetType: "COMMUNITY", targetId: row.communityId, status: "APPROVED", reviewerId: adminId, note: input.note ?? "Pembaruan verifikasi dikonfirmasi.", reviewedAt: now, createdAt: now, updatedAt: now });
        }
        return { id: submissionId, decision: input.decision };
    });
}

/** Creates a one-time invite; the raw token is returned once and only its hash is kept. */
export async function createManagerInvite(communityId: string, ownerId: string) {
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const [invite] = await db.insert(communityInvites).values({ communityId, tokenHash: hashToken(token), createdById: ownerId, expiresAt }).returning({ id: communityInvites.id });
    return { id: invite.id, token, expiresAt };
}

export function listOpenInvites(communityId: string, now = new Date()) {
    return db
        .select({ id: communityInvites.id, createdAt: communityInvites.createdAt, expiresAt: communityInvites.expiresAt })
        .from(communityInvites)
        .where(and(eq(communityInvites.communityId, communityId), isNull(communityInvites.usedAt), isNull(communityInvites.revokedAt), gt(communityInvites.expiresAt, now)))
        .orderBy(desc(communityInvites.createdAt));
}

export async function revokeManagerInvite(communityId: string, inviteId: string) {
    const [invite] = await db
        .update(communityInvites)
        .set({ revokedAt: new Date() })
        .where(and(eq(communityInvites.id, inviteId), eq(communityInvites.communityId, communityId), isNull(communityInvites.usedAt), isNull(communityInvites.revokedAt)))
        .returning({ id: communityInvites.id });
    if (!invite) throw new NotFoundError("Undangan tidak ditemukan atau sudah tidak berlaku.");
    return invite;
}

/** Looks an invite up without using it, for the accept page. */
export async function previewManagerInvite(token: string, now = new Date()) {
    const [row] = await db
        .select({ id: communityInvites.id, usedAt: communityInvites.usedAt, revokedAt: communityInvites.revokedAt, expiresAt: communityInvites.expiresAt, communityId: communities.id, communityName: communities.name, communityStatus: communities.status, ownerId: communities.ownerId })
        .from(communityInvites)
        .innerJoin(communities, eq(communities.id, communityInvites.communityId))
        .where(eq(communityInvites.tokenHash, hashToken(token)));
    if (!row) return null;
    const valid = !row.usedAt && !row.revokedAt && row.expiresAt > now && row.communityStatus === "VERIFIED";
    return { ...row, valid };
}

export async function acceptManagerInvite(token: string, userId: string) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [invite] = await tx
            .select({ id: communityInvites.id, communityId: communityInvites.communityId, usedAt: communityInvites.usedAt, revokedAt: communityInvites.revokedAt, expiresAt: communityInvites.expiresAt })
            .from(communityInvites)
            .where(eq(communityInvites.tokenHash, hashToken(token)))
            .for("update");
        if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= now) throw new ConflictError("Undangan ini sudah dipakai, dicabut, atau kedaluwarsa.");
        const [community] = await tx.select({ ownerId: communities.ownerId, status: communities.status }).from(communities).where(eq(communities.id, invite.communityId));
        if (!community || community.status !== "VERIFIED") throw new ConflictError("Komunitas ini sedang tidak menerima pengurus baru.");
        if (community.ownerId === userId) throw new ConflictError("Anda adalah pemilik komunitas ini.");

        await tx
            .insert(communityMemberships)
            .values({ userId, communityId: invite.communityId, role: "MANAGER", status: "ACTIVE" })
            .onConflictDoUpdate({
                target: [communityMemberships.userId, communityMemberships.communityId],
                set: { role: "MANAGER", status: "ACTIVE", updatedAt: now },
            });
        await tx.update(communityInvites).set({ usedAt: now, usedById: userId }).where(eq(communityInvites.id, invite.id));
        return { communityId: invite.communityId };
    });
}

export async function listCommunityTeam(communityId: string) {
    const community = await db.query.communities.findFirst({ where: eq(communities.id, communityId), columns: { ownerId: true }, with: { owner: { columns: { id: true, displayName: true } } } });
    const managers = await db
        .select({ userId: userProfiles.id, displayName: userProfiles.displayName, since: communityMemberships.updatedAt })
        .from(communityMemberships)
        .innerJoin(userProfiles, eq(userProfiles.id, communityMemberships.userId))
        .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.role, "MANAGER"), eq(communityMemberships.status, "ACTIVE")))
        .orderBy(asc(communityMemberships.updatedAt));
    return { owner: community?.owner ?? null, managers };
}

export async function removeCommunityManager(communityId: string, userId: string) {
    const [membership] = await db
        .update(communityMemberships)
        .set({ status: "REMOVED", updatedAt: new Date() })
        .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, userId), eq(communityMemberships.role, "MANAGER"), eq(communityMemberships.status, "ACTIVE")))
        .returning({ id: communityMemberships.id });
    if (!membership) throw new NotFoundError("Pengurus tidak ditemukan.");
    return membership;
}

/** Counts for the manage menu badges. */
export async function countCommunityContent(communityId: string) {
    const [[eventRow], [merchRow]] = await Promise.all([
        db.select({ total: sql<number>`count(*)::int` }).from(events).where(and(eq(events.communityId, communityId), ne(events.publicationStatus, "ARCHIVED"))),
        db.select({ total: sql<number>`count(*)::int` }).from(merchandiseListings).where(and(eq(merchandiseListings.communityId, communityId), ne(merchandiseListings.status, "ARCHIVED"))),
    ]);
    return { events: eventRow?.total ?? 0, merchandise: merchRow?.total ?? 0 };
}

export function getCommunityContacts(communityId: string) {
    return db.query.communities.findFirst({
        where: eq(communities.id, communityId),
        columns: { id: true, status: true, contactEmail: true, instagramHandle: true, whatsappNumber: true },
    });
}
