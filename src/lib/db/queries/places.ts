import "server-only";

import { and, asc, eq, ilike, isNull, like, or, sql } from "drizzle-orm";

import type { PlaceType } from "@/features/places/places";
import type { CommunityPlaceInput, CuratedPlaceInput } from "@/lib/validation/schemas/place.schema";

import { db } from "../client";
import { adminAuditLogs, communities, places } from "../schema";

const PUBLIC_PLACE_LIMIT = 500;

/** Fields any visitor may see. Never the creator, hide reason, or anything about the people behind a place. */
const publicColumns = {
    id: places.id,
    type: places.type,
    name: places.name,
    addressPublic: places.addressPublic,
    latitude: places.latitude,
    longitude: places.longitude,
    regionCode: places.regionCode,
    checkedAt: places.checkedAt,
    communityId: places.communityId,
    communityName: communities.name,
};

/**
 * Places on the Peta Literasi (DEC-07): not hidden, and a community pin only while its community is
 * VERIFIED. Event pins arrive in phase 2 and stay off the map until then. `region` is a province
 * (`NN`) or kab/kota (`NN.NN`) prefix.
 */
export async function listPublicPlaces(filter: { types: PlaceType[]; region?: string; q?: string }) {
    const types = filter.types.filter((type) => type !== "EVENT");
    if (!types.length) return [];
    const query = filter.q?.replace(/[\\%_]/g, "\\$&");

    return db
        .select(publicColumns)
        .from(places)
        .leftJoin(communities, eq(places.communityId, communities.id))
        .where(and(
            isNull(places.hiddenAt),
            sql`${places.type} in (${sql.join(types.map((type) => sql`${type}`), sql`, `)})`,
            or(sql`${places.type} <> 'COMMUNITY'`, eq(communities.status, "VERIFIED")),
            filter.region ? like(places.regionCode, `${filter.region}%`) : undefined,
            query ? or(ilike(places.name, `%${query}%`), ilike(communities.name, `%${query}%`), ilike(places.addressPublic, `%${query}%`)) : undefined,
        ))
        .orderBy(asc(places.name))
        .limit(PUBLIC_PLACE_LIMIT);
}

export type PublicPlace = Awaited<ReturnType<typeof listPublicPlaces>>[number];

/** Every place for the admin list, hidden ones included. */
export async function listPlacesForAdmin() {
    return db
        .select({ ...publicColumns, hiddenAt: places.hiddenAt, hiddenReason: places.hiddenReason, source: places.source, communityStatus: communities.status })
        .from(places)
        .leftJoin(communities, eq(places.communityId, communities.id))
        .orderBy(asc(places.type), asc(places.name));
}

export async function createCuratedPlace(input: CuratedPlaceInput, actorId: string) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [place] = await tx.insert(places).values({ ...input, checkedAt: now, createdById: actorId, createdAt: now, updatedAt: now }).returning({ id: places.id });
        await tx.insert(adminAuditLogs).values({ actorId, action: "PLACE_CREATED", targetType: "PLACE", targetId: place.id, note: input.name, createdAt: now });
        return place;
    });
}

/** Updates a curated place; community pins are edited by their owner, not here. Returns null when no such curated place. */
export async function updateCuratedPlace(placeId: string, input: CuratedPlaceInput, actorId: string) {
    return db.transaction(async (tx) => {
        const now = new Date();
        const [place] = await tx.update(places)
            .set({ ...input, checkedAt: now, updatedAt: now })
            .where(and(eq(places.id, placeId), sql`${places.type} in ('LIBRARY', 'MEETING_POINT')`))
            .returning({ id: places.id });
        if (!place) return null;
        await tx.insert(adminAuditLogs).values({ actorId, action: "PLACE_UPDATED", targetType: "PLACE", targetId: place.id, note: input.name, createdAt: now });
        return place;
    });
}

/** Hide (with a reason) or restore any place, community pins included. Returns null when the place does not exist. */
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

/** The community's own pin for its manage page, hidden state included so the owner knows. */
export async function findCommunityPlace(communityId: string) {
    const [place] = await db
        .select({ id: places.id, addressPublic: places.addressPublic, latitude: places.latitude, longitude: places.longitude, hiddenAt: places.hiddenAt, updatedAt: places.updatedAt })
        .from(places)
        .where(eq(places.communityId, communityId))
        .limit(1);
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

