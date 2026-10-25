import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { wibDateTime } from "@/features/community-management/rules";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { removeMerchandisePhotos } from "@/lib/supabase/storage";
import type { CommunityEventInput, CommunityMerchandiseInput } from "@/lib/validation/schemas/community-management.schema";

import { db } from "../client";
import { events, merchandiseListings, orderItems, places } from "../schema";

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
    const [event] = await db.insert(events).values({ communityId, ...eventValues(input) }).returning({ id: events.id });
    return event;
}

export async function updateCommunityEvent(communityId: string, eventId: string, input: CommunityEventInput) {
    const [event] = await db
        .update(events)
        .set({ ...eventValues(input), updatedAt: new Date() })
        .where(and(eq(events.id, eventId), eq(events.communityId, communityId)))
        .returning({ id: events.id });
    if (!event) throw new NotFoundError("Acara tidak ditemukan.");
    // The venue pin carries the event title, and an online event has no venue to pin (DEC-07).
    if (input.locationType === "ONLINE") await db.delete(places).where(eq(places.eventId, eventId));
    else await db.update(places).set({ name: input.title, updatedAt: new Date() }).where(eq(places.eventId, eventId));
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
    return { id: eventId };
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
    const [item] = await db.insert(merchandiseListings).values({ communityId, ...merchandiseValues(communityId, input) }).returning({ id: merchandiseListings.id });
    return item;
}

export async function updateCommunityMerchandise(communityId: string, itemId: string, input: CommunityMerchandiseInput) {
    const before = await findManagedMerchandise(communityId, itemId);
    if (!before) throw new NotFoundError("Merchandise tidak ditemukan.");
    const values = merchandiseValues(communityId, input);
    const [item] = await db
        .update(merchandiseListings)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(merchandiseListings.id, itemId), eq(merchandiseListings.communityId, communityId)))
        .returning({ id: merchandiseListings.id });
    if (!item) throw new NotFoundError("Merchandise tidak ditemukan.");
    await removeMerchandisePhotos(before.photoPaths.filter((path) => !values.photoPaths.includes(path)));
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
    await removeMerchandisePhotos(item.photoPaths);
    return { id: itemId, archived: false };
}
