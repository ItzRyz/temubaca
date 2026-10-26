import "server-only";

import { and, asc, eq, gte, ilike, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { alias, type PgSelect } from "drizzle-orm/pg-core";

import { CURATED_PLACE_TYPES, type PlaceType } from "@/features/places/places";
import type { CommunityPlaceInput, CuratedPlaceInput, EventPlaceInput } from "@/lib/validation/schemas/place.schema";

import { db } from "../client";
import { adminAuditLogs, communities, events, places } from "../schema";

const PUBLIC_PLACE_LIMIT = 500;

// An event pin has no communityId (`places_owner_check`); its organiser is reached through the event.
const organisers = alias(communities, "organisers");

// An event pin is named after its event and a community pin after its community, read live so a renamed
// event or community never leaves a stale name behind; `places.name` is the stored fallback.
const placeName = sql<string>`coalesce(${events.title}, ${communities.name}, ${places.name})`;

/** Fields any visitor may see. Never the creator, hide reason, or anything about the people behind a place. */
const publicColumns = {
    id: places.id,
    type: places.type,
    name: placeName,
    addressPublic: places.addressPublic,
    latitude: places.latitude,
    longitude: places.longitude,
    regionCode: places.regionCode,
    checkedAt: places.checkedAt,
    communityId: places.communityId,
    // The community behind the pin: its own for a community pin, the organiser for an event pin.
    communityName: sql<string | null>`coalesce(${communities.name}, ${organisers.name})`,
    eventId: places.eventId,
    eventStartsAt: events.startsAt,
};

/** Joins the community behind a pin, directly or through its event (Drizzle dynamic query). */
function withOwners<T extends PgSelect>(query: T) {
    return query
        .leftJoin(communities, eq(places.communityId, communities.id))
        .leftJoin(events, eq(places.eventId, events.id))
        .leftJoin(organisers, eq(events.communityId, organisers.id));
}

/**
 * When a pin is on the Peta Literasi (DEC-07): not hidden; a community pin while its community is
 * VERIFIED; an event pin while the event is PUBLISHED, in person, not yet over, and its community VERIFIED.
 */
function isOnMap(now: Date) {
    return and(
        isNull(places.hiddenAt),
        or(
            inArray(places.type, [...CURATED_PLACE_TYPES]),
            and(eq(places.type, "COMMUNITY"), eq(communities.status, "VERIFIED")),
            and(
                eq(places.type, "EVENT"),
                eq(events.publicationStatus, "PUBLISHED"),
                eq(events.locationType, "PHYSICAL"),
                gte(sql`coalesce(${events.endsAt}, ${events.startsAt})`, now),
                eq(organisers.status, "VERIFIED"),
            ),
        ),
    );
}

function publicPlaces() {
    return withOwners(db.select(publicColumns).from(places).$dynamic());
}

/** Places on the Peta Literasi. `region` is a province (`NN`) or kab/kota (`NN.NN`) prefix. */
export async function listPublicPlaces(filter: { types: PlaceType[]; region?: string; q?: string }, now = new Date()) {
    if (!filter.types.length) return [];
    const query = filter.q?.replace(/[\\%_]/g, "\\$&");

    return publicPlaces()
        .where(and(
            isOnMap(now),
            inArray(places.type, filter.types),
            filter.region ? like(places.regionCode, `${filter.region}%`) : undefined,
            query ? or(ilike(placeName, `%${query}%`), ilike(organisers.name, `%${query}%`), ilike(places.addressPublic, `%${query}%`)) : undefined,
        ))
        .orderBy(asc(placeName))
        .limit(PUBLIC_PLACE_LIMIT);
}

export type PublicPlace = Awaited<ReturnType<typeof listPublicPlaces>>[number];

async function firstOnMap(where: SQL, now: Date) {
    const [place] = await publicPlaces().where(and(isOnMap(now), where)).limit(1);
    return place ?? null;
}

/** One place by id while it is on the map; the route handler resolves its destination here (TB-064). */
export function findPublicPlace(placeId: string, now = new Date()) {
    return firstOnMap(eq(places.id, placeId), now);
}

/** The pin of one community or event while it is on the map, for "Lihat di Peta Literasi" links. */
export function findPublicPin(owner: { communityId: string } | { eventId: string }, now = new Date()) {
    return firstOnMap("communityId" in owner ? eq(places.communityId, owner.communityId) : eq(places.eventId, owner.eventId), now);
}

/** Every place for the admin list, hidden ones included, with whether it is on the map right now. */
export async function listPlacesForAdmin(now = new Date()) {
    const columns = {
        ...publicColumns,
        hiddenAt: places.hiddenAt,
        hiddenReason: places.hiddenReason,
        source: places.source,
        onMap: sql<boolean>`coalesce(${isOnMap(now)}, false)`,
    };
    return withOwners(db.select(columns).from(places).$dynamic())
        .orderBy(asc(places.type), asc(placeName));
}

export async function createCuratedPlace(input: CuratedPlaceInput, actorId: string) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [place] = await tx.insert(places).values({ ...input, checkedAt: now, createdById: actorId, createdAt: now, updatedAt: now }).returning({ id: places.id });
        await tx.insert(adminAuditLogs).values({ actorId, action: "PLACE_CREATED", targetType: "PLACE", targetId: place.id, note: input.name, createdAt: now });
        return place;
    });
}

/** Updates a curated place; community and event pins are edited by their owner, not here. Returns null when no such curated place. */
export async function updateCuratedPlace(placeId: string, input: CuratedPlaceInput, actorId: string) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [place] = await tx.update(places)
            .set({ ...input, checkedAt: now, updatedAt: now })
            .where(and(eq(places.id, placeId), inArray(places.type, [...CURATED_PLACE_TYPES])))
            .returning({ id: places.id });
        if (!place) return null;
        await tx.insert(adminAuditLogs).values({ actorId, action: "PLACE_UPDATED", targetType: "PLACE", targetId: place.id, note: input.name, createdAt: now });
        return place;
    });
}

/** Hide (with a reason) or restore any place, community and event pins included. Returns null when the place does not exist. */
export async function setPlaceHidden(placeId: string, hidden: { reason: string } | null, actorId: string) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [place] = await tx.update(places)
            .set({ hiddenAt: hidden ? now : null, hiddenReason: hidden?.reason ?? null, updatedAt: now })
            .where(eq(places.id, placeId))
            .returning({ id: places.id });
        if (!place) return null;
        await tx.insert(adminAuditLogs).values({
            actorId, action: hidden ? "PLACE_HIDDEN" : "PLACE_RESTORED", targetType: "PLACE", targetId: place.id, note: hidden?.reason ?? null, createdAt: now,
        });
        return place;
    });
}

/** A community's or event's own pin for its manage page, hidden state included so the owner knows. */
const ownPinColumns = {
    id: places.id, addressPublic: places.addressPublic, latitude: places.latitude, longitude: places.longitude,
    regionCode: places.regionCode, hiddenAt: places.hiddenAt, updatedAt: places.updatedAt,
};

export async function findCommunityPlace(communityId: string) {
    const [place] = await db.select(ownPinColumns).from(places).where(eq(places.communityId, communityId)).limit(1);
    return place ?? null;
}

/**
 * One public meeting place per community (`places_community_id_key`). Name and kab/kota follow the
 * community profile. An admin-hidden pin stays hidden when the owner moves it.
 */
export async function upsertCommunityPlace(community: { id: string; name: string; regionCode: string | null }, input: CommunityPlaceInput, actorId: string) {
    const now = new Date();
    const values = { name: community.name, regionCode: community.regionCode, ...input, checkedAt: now, updatedAt: now };
    const [place] = await db.insert(places)
        .values({ type: "COMMUNITY", communityId: community.id, createdById: actorId, createdAt: now, ...values })
        .onConflictDoUpdate({ target: places.communityId, set: values })
        .returning({ id: places.id });
    return place;
}

export async function deleteCommunityPlace(communityId: string) {
    const removed = await db.delete(places).where(eq(places.communityId, communityId)).returning({ id: places.id });
    return removed.length > 0;
}

export async function findEventPlace(eventId: string) {
    const [place] = await db.select(ownPinColumns).from(places).where(eq(places.eventId, eventId)).limit(1);
    return place ?? null;
}

/**
 * One venue pin per in-person event (`places_event_id_key`, DEC-07 phase 2). The map shows the
 * event's current title (`placeName`); the kab/kota is chosen per event, since a community can meet
 * outside its home region.
 * An admin-hidden pin stays hidden when it is moved.
 */
export async function upsertEventPlace(event: { id: string; title: string }, input: EventPlaceInput, actorId: string) {
    const now = new Date();
    const values = { name: event.title, ...input, checkedAt: now, updatedAt: now };
    const [place] = await db.insert(places)
        .values({ type: "EVENT", eventId: event.id, createdById: actorId, createdAt: now, ...values })
        .onConflictDoUpdate({ target: places.eventId, set: values })
        .returning({ id: places.id });
    return place;
}

export async function deleteEventPlace(eventId: string) {
    const removed = await db.delete(places).where(eq(places.eventId, eventId)).returning({ id: places.id });
    return removed.length > 0;
}
