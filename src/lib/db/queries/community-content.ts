import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { wibDateTime } from "@/features/community-management/rules";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { removeCommunityImages } from "@/lib/supabase/storage";
import type { CommunityEventInput, CommunityMerchandiseInput } from "@/lib/validation/schemas/community-management.schema";

import { db } from "../client";
import { adminAuditLogs, communities, events, merchandiseListings, orderItems } from "../schema";
import { deleteEventPlace } from "./places";
import { getSettings } from "./settings";

/**
 * The status a manager's "publish" turns into (settings, 30 Okt 2026): with pre-publication review on, new
 * and draft content waits for an admin; content already approved and published stays published when edited.
 */
export function publishStatus(requested: "PUBLISHED" | "DRAFT", current: string | undefined, review: boolean) {
    if (requested !== "PUBLISHED") return "DRAFT" as const;
    if (!review || current === "PUBLISHED" || current === "UNAVAILABLE") return "PUBLISHED" as const;
    return "PENDING_REVIEW" as const;
}

async function moderation() {
    return (await getSettings("moderation")).settings;
}

function eventValues(input: CommunityEventInput) {
    const online = input.locationType === "ONLINE";
    return {
        title: input.title,
        description: input.description,
        startsAt: input.date && input.startTime ? wibDateTime(input.date, input.startTime) : null,
        endsAt: input.date && input.endTime ? wibDateTime(input.date, input.endTime) : null,
        locationType: input.locationType,
        venueName: online ? null : input.venueName ?? null,
        publicLocation: online ? null : input.publicLocation ?? null,
        eventUrl: online ? input.eventUrl ?? null : null,
        publicationStatus: input.publicationStatus,
    };
}

export function listEventsForManage(communityId: string) {
    return db
        .select()
        .from(events)
        .where(eq(events.communityId, communityId))
        // Drafts without a date sort first so they get finished; then the nearest schedule.
        .orderBy(sql`${events.startsAt} is not null`, asc(events.startsAt), desc(events.createdAt))
        .limit(200);
}

export function findManagedEvent(communityId: string, eventId: string) {
    return db.query.events.findFirst({ where: and(eq(events.id, eventId), eq(events.communityId, communityId)) });
}

export async function createCommunityEvent(communityId: string, input: CommunityEventInput) {
    const status = publishStatus(input.publicationStatus, undefined, (await moderation()).reviewNewEvents);
    const [event] = await db.insert(events).values({ communityId, ...eventValues(input), publicationStatus: status })
        .returning({ id: events.id, publicationStatus: events.publicationStatus });
    return event;
}

export async function updateCommunityEvent(communityId: string, eventId: string, input: CommunityEventInput) {
    const current = await findManagedEvent(communityId, eventId);
    if (!current) throw new NotFoundError("Acara tidak ditemukan.");
    const status = publishStatus(input.publicationStatus, current.publicationStatus, (await moderation()).reviewNewEvents);
    const [event] = await db
        .update(events)
        // Sending it for review again clears the previous refusal.
        .set({ ...eventValues(input), publicationStatus: status, ...(status === "PENDING_REVIEW" ? { moderationNote: null } : {}), updatedAt: new Date() })
        .where(and(eq(events.id, eventId), eq(events.communityId, communityId)))
        .returning({ id: events.id, publicationStatus: events.publicationStatus });
    if (!event) throw new NotFoundError("Acara tidak ditemukan.");
    // An online event has no venue to pin (DEC-07); the pin's name is read from the event itself.
    if (input.locationType === "ONLINE") await deleteEventPlace(eventId);
    return event;
}

export async function archiveCommunityEvent(communityId: string, eventId: string) {
    const [event] = await db
        .update(events)
        .set({ publicationStatus: "ARCHIVED", updatedAt: new Date() })
        .where(and(eq(events.id, eventId), eq(events.communityId, communityId)))
        .returning({ id: events.id });
    if (!event) throw new NotFoundError("Acara tidak ditemukan.");
    return event;
}

/** "Duplikat" on a finished event: a new draft with the same content and no schedule. */
export async function duplicateCommunityEvent(communityId: string, eventId: string) {
    const source = await findManagedEvent(communityId, eventId);
    if (!source) throw new NotFoundError("Acara tidak ditemukan.");
    const [copy] = await db
        .insert(events)
        .values({
            communityId,
            title: source.title,
            description: source.description,
            locationType: source.locationType,
            venueName: source.venueName,
            publicLocation: source.publicLocation,
            eventUrl: source.eventUrl,
            publicationStatus: "DRAFT",
        })
        .returning({ id: events.id });
    return copy;
}

/** Only drafts are deleted outright; published history is archived instead. */
export async function deleteCommunityEvent(communityId: string, eventId: string) {
    const event = await findManagedEvent(communityId, eventId);
    if (!event) throw new NotFoundError("Acara tidak ditemukan.");
    if (event.publicationStatus !== "DRAFT") throw new ConflictError("Acara yang sudah terbit diarsipkan, bukan dihapus.");
    await db.delete(events).where(eq(events.id, eventId));
    if (event.imagePath) await removeCommunityImages([event.imagePath]);
    return { id: eventId };
}

/**
 * Sets or clears the event image (29 Okt 2026); the replaced file is removed. A duplicated event starts
 * without one, so a file never belongs to two events.
 */
export async function setCommunityEventImage(communityId: string, eventId: string, imagePath: string | null) {
    const previous = await db.transaction(async (tx) => {
        const [event] = await tx.select({ imagePath: events.imagePath }).from(events)
            .where(and(eq(events.id, eventId), eq(events.communityId, communityId))).for("update");
        if (!event) throw new NotFoundError("Acara tidak ditemukan.");
        await tx.update(events).set({ imagePath, updatedAt: new Date() }).where(eq(events.id, eventId));
        return event.imagePath;
    });
    if (previous && previous !== imagePath) await removeCommunityImages([previous]);
    return imagePath;
}

function merchandiseValues(communityId: string, input: CommunityMerchandiseInput) {
    const fixed = input.priceMode === "FIXED";
    return {
        title: input.title,
        category: input.category ?? null,
        description: input.description ?? null,
        priceAmount: fixed && input.priceAmount !== undefined ? String(input.priceAmount) : null,
        currency: fixed ? "IDR" : null,
        priceNote: fixed ? null : input.priceNote ?? null,
        availability: input.availability,
        stockNote: input.stockNote ?? null,
        contactOverride: input.contactMode === "CUSTOM" ? input.contactOverride ?? null : null,
        variants: input.variants,
        fulfillmentNote: input.fulfillmentNote ?? null,
        // Only photos uploaded for this community; anything else is dropped.
        photoPaths: [...new Set(input.photoPaths)].filter((path) => path.startsWith(`${communityId}/`)),
        // "Tampilkan di halaman komunitas" off keeps the item as a hidden draft (DEC-05: no prior review).
        status: input.visible ? ("PUBLISHED" as const) : ("DRAFT" as const),
    };
}

export function listMerchandiseForManage(communityId: string) {
    return db
        .select()
        .from(merchandiseListings)
        .where(and(eq(merchandiseListings.communityId, communityId), sql`${merchandiseListings.status} <> 'ARCHIVED'`))
        .orderBy(desc(merchandiseListings.createdAt))
        .limit(200);
}

export function findManagedMerchandise(communityId: string, itemId: string) {
    return db.query.merchandiseListings.findFirst({ where: and(eq(merchandiseListings.id, itemId), eq(merchandiseListings.communityId, communityId)) });
}

export async function createCommunityMerchandise(communityId: string, input: CommunityMerchandiseInput) {
    const values = merchandiseValues(communityId, input);
    const status = publishStatus(values.status, undefined, (await moderation()).reviewNewMerchandise);
    const [item] = await db.insert(merchandiseListings).values({ communityId, ...values, status })
        .returning({ id: merchandiseListings.id, status: merchandiseListings.status });
    return item;
}

export async function updateCommunityMerchandise(communityId: string, itemId: string, input: CommunityMerchandiseInput) {
    const before = await findManagedMerchandise(communityId, itemId);
    if (!before) throw new NotFoundError("Merchandise tidak ditemukan.");
    const values = merchandiseValues(communityId, input);
    const status = publishStatus(values.status, before.status, (await moderation()).reviewNewMerchandise);
    const [item] = await db
        .update(merchandiseListings)
        .set({ ...values, status, ...(status === "PENDING_REVIEW" ? { moderationNote: null } : {}), updatedAt: new Date() })
        .where(and(eq(merchandiseListings.id, itemId), eq(merchandiseListings.communityId, communityId)))
        .returning({ id: merchandiseListings.id, status: merchandiseListings.status });
    if (!item) throw new NotFoundError("Merchandise tidak ditemukan.");
    await removeCommunityImages(before.photoPaths.filter((path) => !values.photoPaths.includes(path)));
    return item;
}

/** Items referenced by an order are archived instead of deleted. Orders do not exist yet (DEC-03). */
export async function deleteCommunityMerchandise(communityId: string, itemId: string) {
    const item = await findManagedMerchandise(communityId, itemId);
    if (!item) throw new NotFoundError("Merchandise tidak ditemukan.");
    const [ordered] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.merchandiseListingId, itemId)).limit(1);
    if (ordered) {
        await db.update(merchandiseListings).set({ status: "ARCHIVED", updatedAt: new Date() }).where(eq(merchandiseListings.id, itemId));
        return { id: itemId, archived: true };
    }
    await db.delete(merchandiseListings).where(eq(merchandiseListings.id, itemId));
    await removeCommunityImages(item.photoPaths);
    return { id: itemId, archived: false };
}

export type ReviewableContent = "event" | "merchandise";

/** Events and merchandise waiting for an admin while review is on, oldest first, for Peninjauan. */
export async function listPendingCommunityContent() {
    const [pendingEvents, pendingItems] = await Promise.all([
        db.select({ id: events.id, title: events.title, description: events.description, startsAt: events.startsAt, publicLocation: events.publicLocation, imagePath: events.imagePath, submittedAt: events.updatedAt, communityId: communities.id, communityName: communities.name })
            .from(events).innerJoin(communities, eq(communities.id, events.communityId))
            .where(eq(events.publicationStatus, "PENDING_REVIEW")).orderBy(asc(events.updatedAt)).limit(100),
        db.select({ id: merchandiseListings.id, title: merchandiseListings.title, description: merchandiseListings.description, photoPaths: merchandiseListings.photoPaths, priceAmount: merchandiseListings.priceAmount, priceNote: merchandiseListings.priceNote, submittedAt: merchandiseListings.updatedAt, communityId: communities.id, communityName: communities.name })
            .from(merchandiseListings).innerJoin(communities, eq(communities.id, merchandiseListings.communityId))
            .where(eq(merchandiseListings.status, "PENDING_REVIEW")).orderBy(asc(merchandiseListings.updatedAt)).limit(100),
    ]);
    return { events: pendingEvents, merchandise: pendingItems };
}

export async function countPendingCommunityContent() {
    const [[eventRow], [itemRow]] = await Promise.all([
        db.select({ total: sql<number>`count(*)::int` }).from(events).where(eq(events.publicationStatus, "PENDING_REVIEW")),
        db.select({ total: sql<number>`count(*)::int` }).from(merchandiseListings).where(eq(merchandiseListings.status, "PENDING_REVIEW")),
    ]);
    return (eventRow?.total ?? 0) + (itemRow?.total ?? 0);
}

/**
 * An admin's decision on a waiting event or merchandise item: approve publishes it; refuse sends it back
 * to draft with a reason the managers see. Only content still waiting can be decided; audited.
 */
export async function decideCommunityContent(type: ReviewableContent, id: string, adminId: string, decision: { approve: true } | { approve: false; note: string }) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const table = type === "event" ? events : merchandiseListings;
        const statusColumn = type === "event" ? events.publicationStatus : merchandiseListings.status;
        const [row] = await tx.select({ id: table.id, title: table.title, status: statusColumn }).from(table).where(eq(table.id, id)).for("update");
        if (!row) throw new NotFoundError(type === "event" ? "Acara tidak ditemukan." : "Merchandise tidak ditemukan.");
        if (row.status !== "PENDING_REVIEW") throw new ConflictError("Konten ini sudah diputuskan atau tidak lagi menunggu tinjauan.");
        const next = decision.approve ? "PUBLISHED" : "DRAFT";
        const note = decision.approve ? null : decision.note;
        if (type === "event") await tx.update(events).set({ publicationStatus: next, moderationNote: note, reviewedAt: now, updatedAt: now }).where(eq(events.id, id));
        else await tx.update(merchandiseListings).set({ status: next, moderationNote: note, reviewedAt: now, updatedAt: now }).where(eq(merchandiseListings.id, id));
        await tx.insert(adminAuditLogs).values({
            actorId: adminId,
            action: decision.approve ? "CONTENT_APPROVED" : "CONTENT_REJECTED",
            targetType: type === "event" ? "EVENT" : "MERCHANDISE_LISTING",
            targetId: id,
            note: decision.approve ? `Disetujui: ${row.title}` : `Ditolak: ${row.title}. ${decision.note}`,
            createdAt: now,
        });
        return { status: next };
    });
}
