import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { communities, merchandiseListings } from "../schema";

const publicMerchandiseFilter = and(
    eq(merchandiseListings.status, "PUBLISHED"),
    eq(communities.status, "VERIFIED"),
);

/** Public catalog projection; omits image references, order data and internal timestamps. */
export async function listPublicMerchandise(options?: { limit?: number; offset?: number; communityId?: string }) {
    return db
        .select({
            id: merchandiseListings.id,
            title: merchandiseListings.title,
            description: merchandiseListings.description,
            priceAmount: merchandiseListings.priceAmount,
            currency: merchandiseListings.currency,
            priceNote: merchandiseListings.priceNote,
            availability: merchandiseListings.availability,
            communityId: communities.id,
            communityName: communities.name,
        })
        .from(merchandiseListings)
        .innerJoin(communities, eq(merchandiseListings.communityId, communities.id))
        .where(and(
            publicMerchandiseFilter,
            options?.communityId ? eq(merchandiseListings.communityId, options.communityId) : undefined,
        ))
        .orderBy(desc(merchandiseListings.createdAt))
        .limit(Math.min(Math.max(options?.limit ?? 20, 1), 100))
        .offset(Math.max(options?.offset ?? 0, 0));
}

export async function countPublicMerchandise() {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(merchandiseListings)
        .innerJoin(communities, eq(merchandiseListings.communityId, communities.id))
        .where(publicMerchandiseFilter);
    return result?.total ?? 0;
}

/** A single PUBLISHED listing of a VERIFIED community, with the same public projection as the catalog. */
export async function findPublicMerchandise(listingId: string) {
    const [listing] = await db
        .select({
            id: merchandiseListings.id,
            title: merchandiseListings.title,
            description: merchandiseListings.description,
            priceAmount: merchandiseListings.priceAmount,
            currency: merchandiseListings.currency,
            priceNote: merchandiseListings.priceNote,
            availability: merchandiseListings.availability,
            communityId: communities.id,
            communityName: communities.name,
            communityLocation: communities.publicLocation,
        })
        .from(merchandiseListings)
        .innerJoin(communities, eq(merchandiseListings.communityId, communities.id))
        .where(and(publicMerchandiseFilter, eq(merchandiseListings.id, listingId)))
        .limit(1);
    return listing ?? null;
}
