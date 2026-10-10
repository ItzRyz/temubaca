import "server-only";

import { and, asc, eq, gte, isNotNull, sql } from "drizzle-orm";

import { db } from "../client";
import { communities, events } from "../schema";

/** Upcoming events visible to the public, with a minimal community projection. */
export async function listUpcomingPublicEvents(options?: {
    limit?: number;
    offset?: number;
    now?: Date;
    communityId?: string;
}) {
    const now = options?.now ?? new Date();
    return db
        .select({
            id: events.id,
            title: events.title,
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
        ))
        .orderBy(asc(events.startsAt))
        .limit(Math.min(Math.max(options?.limit ?? 20, 1), 100))
        .offset(Math.max(options?.offset ?? 0, 0));
}

export async function countUpcomingPublicEvents(now = new Date()) {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(events)
        .innerJoin(communities, eq(events.communityId, communities.id))
        .where(and(
            eq(events.publicationStatus, "PUBLISHED"),
            eq(communities.status, "VERIFIED"),
            isNotNull(events.startsAt),
            gte(events.startsAt, now),
        ));
    return result?.total ?? 0;
}

/** A single PUBLISHED event of a VERIFIED community (past events included so shared links keep working). */
export async function findPublicEvent(eventId: string) {
    const [event] = await db
        .select({
            id: events.id,
            title: events.title,
            description: events.description,
            startsAt: events.startsAt,
            endsAt: events.endsAt,
            publicLocation: events.publicLocation,
            eventUrl: events.eventUrl,
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
