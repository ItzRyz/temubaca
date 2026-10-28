import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { userInterests, userProfiles } from "../schema";

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

/** Saves the interests picked on "Pilih minat" in one go; the kab/kota only when one was chosen. */
export async function saveOnboardingInterests(userId: string, subjects: string[], regionCode: string | undefined) {
    return db.transaction(async (tx) => {
        await tx.insert(userInterests)
            .values(subjects.map((subject) => ({ userId, subject })))
            .onConflictDoNothing({ target: [userInterests.userId, userInterests.subject] });
        if (regionCode) await tx.update(userProfiles).set({ regionCode, updatedAt: new Date() }).where(eq(userProfiles.id, userId));
        return { saved: subjects.length };
    });
}
