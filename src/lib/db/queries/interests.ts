import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { userInterests } from "../schema";

export function listUserInterests(userId: string) {
    return db.query.userInterests.findMany({
        where: eq(userInterests.userId, userId),
        orderBy: (table, { asc }) => [asc(table.subject)],
    });
}

export async function countUserInterests(userId: string) {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(userInterests)
        .where(eq(userInterests.userId, userId));
    return result?.total ?? 0;
}

export async function addUserInterest(userId: string, subject: string) {
    const [interest] = await db
        .insert(userInterests)
        .values({ userId, subject })
        .onConflictDoNothing({
            target: [userInterests.userId, userInterests.subject],
        })
        .returning();
    return interest ?? null;
}

export async function removeUserInterest(userId: string, interestId: string) {
    const [removed] = await db
        .delete(userInterests)
        .where(and(
            eq(userInterests.id, interestId),
            eq(userInterests.userId, userId),
        ))
        .returning({ id: userInterests.id });
    return Boolean(removed);
}
