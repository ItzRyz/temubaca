import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "../client";
import { books, communities, events, libraries, merchandiseListings } from "../schema";
import { publicMerchandiseFilter } from "./merchandise";

/** Per kind, well under the 50,000 URLs one sitemap file may hold. */
const SITEMAP_LIMIT = 5_000;

/**
 * Public pages for `sitemap.xml` (SEO, 29 Okt 2026), with the same visibility rules as the pages:
 * every catalog book, verified communities, their published events and merchandise, visible libraries.
 */
export async function listSitemapEntries() {
    const [bookRows, communityRows, eventRows, merchandiseRows, libraryRows] = await Promise.all([
        db.select({ id: books.id, updatedAt: books.updatedAt }).from(books).orderBy(desc(books.updatedAt)).limit(SITEMAP_LIMIT),
        db.select({ id: communities.id, updatedAt: communities.updatedAt }).from(communities)
            .where(eq(communities.status, "VERIFIED")).orderBy(desc(communities.updatedAt)).limit(SITEMAP_LIMIT),
        db.select({ id: events.id, updatedAt: events.updatedAt }).from(events)
            .innerJoin(communities, eq(events.communityId, communities.id))
            .where(and(eq(events.publicationStatus, "PUBLISHED"), eq(communities.status, "VERIFIED")))
            .orderBy(desc(events.updatedAt)).limit(SITEMAP_LIMIT),
        db.select({ id: merchandiseListings.id, updatedAt: merchandiseListings.updatedAt }).from(merchandiseListings)
            .innerJoin(communities, eq(merchandiseListings.communityId, communities.id))
            .where(publicMerchandiseFilter).orderBy(desc(merchandiseListings.updatedAt)).limit(SITEMAP_LIMIT),
        db.select({ id: libraries.id, updatedAt: libraries.updatedAt }).from(libraries)
            .where(isNull(libraries.hiddenAt)).orderBy(desc(libraries.updatedAt)).limit(SITEMAP_LIMIT),
    ]);
    return { books: bookRows, communities: communityRows, events: eventRows, merchandise: merchandiseRows, libraries: libraryRows };
}
