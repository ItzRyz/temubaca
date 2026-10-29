import "server-only";

import { and, asc, desc, eq, gte, ilike, isNotNull, lt, or, sql } from "drizzle-orm";

import { db } from "../client";
import { communities, events } from "../schema";

/** Upcoming events visible to the public, with a minimal community projection. */
export async function listUpcomingPublicEvents(options?: {
    limit?: number;
    offset?: number;
    now?: Date;
    communityId?: string;
    query?: string;
}) {
    const now = options?.now ?? new Date();
    return db
        .select({
            id: events.id,
            title: events.title,
            imagePath: events.imagePath,
            description: events.description,
            startsAt: events.startsAt,
            endsAt: events.endsAt,
            publicLocation: events.publicLocation,
            communityId: communities.id,
            communityName: communities.name,
        })
        .from(events)
        .innerJoin(communities, eq(events.communityId, communities.id))
        .where(and(
            eq(events.publicationStatus, "PUBLISHED"),
            eq(communities.status, "VERIFIED"),
            isNotNull(events.startsAt),
            gte(events.startsAt, now),
            options?.communityId ? eq(events.communityId, options.communityId) : undefined,
            eventTextMatch(options?.query),
        ))
        .orderBy(asc(events.startsAt))
        .limit(Math.min(Math.max(options?.limit ?? 20, 1), 100))
        .offset(Math.max(options?.offset ?? 0, 0));
}

/** Case-insensitive match on event title or community name, with LIKE wildcards escaped. */
function eventTextMatch(query: string | undefined) {
    const trimmed = query?.trim();
    if (!trimmed) return undefined;
    const pattern = `%${trimmed.replace(/[\\%_]/g, "\\$&")}%`;
    return or(ilike(events.title, pattern), ilike(communities.name, pattern));
}

export async function countUpcomingPublicEvents(now = new Date(), query?: string) {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(events)
        .innerJoin(communities, eq(events.communityId, communities.id))
        .where(and(
            eq(events.publicationStatus, "PUBLISHED"),
            eq(communities.status, "VERIFIED"),
            isNotNull(events.startsAt),
            gte(events.startsAt, now),
            eventTextMatch(query),
        ));
    return result?.total ?? 0;
}

/** A single PUBLISHED event of a VERIFIED community (past events included so shared links keep working). */
export async function findPublicEvent(eventId: string) {
    const [event] = await db
        .select({
            id: events.id,
            title: events.title,
            imagePath: events.imagePath,
            description: events.description,
            startsAt: events.startsAt,
            endsAt: events.endsAt,
            publicLocation: events.publicLocation,
            eventUrl: events.eventUrl,
            locationType: events.locationType,
            venueName: events.venueName,
            communityId: communities.id,
            communityName: communities.name,
        })
        .from(events)
        .innerJoin(communities, eq(events.communityId, communities.id))
        .where(and(
            eq(events.id, eventId),
            eq(events.publicationStatus, "PUBLISHED"),
            eq(communities.status, "VERIFIED"),
        ))
        .limit(1);
    return event ?? null;
}

/** PUBLISHED events of a VERIFIED community that already started, newest first ("Acara Sebelumnya"). */
export async function listPastPublicEvents(communityId: string, limit = 6, now = new Date()) {
    return db
        .select({ id: events.id, title: events.title, imagePath: events.imagePath, startsAt: events.startsAt, publicLocation: events.publicLocation })
        .from(events)
        .innerJoin(communities, eq(events.communityId, communities.id))
        .where(and(
            eq(events.communityId, communityId),
            eq(events.publicationStatus, "PUBLISHED"),
            eq(communities.status, "VERIFIED"),
            isNotNull(events.startsAt),
            lt(events.startsAt, now),
        ))
        .orderBy(desc(events.startsAt))
        .limit(Math.min(Math.max(limit, 1), 50));
}
