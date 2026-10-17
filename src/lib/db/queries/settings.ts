import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { changedSettings, parseCatalogSettings, type CatalogSettings } from "@/features/settings/catalog-settings";

import { db } from "../client";
import { adminAuditLogs, appSettings, userProfiles } from "../schema";

const CATALOG_KEY = "catalog";
/** Settings are not a row-level entity; audit entries point at this fixed id. */
const SETTINGS_TARGET_ID = "00000000-0000-0000-0000-000000000000";

/** Current catalog settings, read once per request. */
export const getCatalogSettings = cache(async () => {
    const [row] = await db
        .select({ value: appSettings.value, updatedAt: appSettings.updatedAt, updatedByName: userProfiles.displayName })
        .from(appSettings)
        .leftJoin(userProfiles, eq(appSettings.updatedById, userProfiles.id))
        .where(eq(appSettings.key, CATALOG_KEY));
    return {
        settings: parseCatalogSettings(row?.value),
        updatedAt: row?.updatedAt ?? null,
        updatedByName: row?.updatedByName ?? null,
    };
});

/** Save catalog settings and audit the changed fields in one transaction. */
export async function saveCatalogSettings(next: CatalogSettings, actorId: string) {
    return db.transaction(async (tx) => {
        const [current] = await tx.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, CATALOG_KEY)).for("update");
        const before = parseCatalogSettings(current?.value);
        const changes = changedSettings(before, next);
        if (changes.length === 0) return { changed: [] };

        const now = new Date();
        await tx.insert(appSettings)
            .values({ key: CATALOG_KEY, value: next, updatedById: actorId, updatedAt: now })
            .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedById: actorId, updatedAt: now } });
        await tx.insert(adminAuditLogs).values({
            actorId,
            action: "SETTINGS_UPDATED",
            targetType: "OTHER",
            targetId: SETTINGS_TARGET_ID,
            note: `Katalog Buku: ${changes.map((change) => change.key).join(", ")}`,
            metadata: { section: CATALOG_KEY, changes },
            createdAt: now,
        });
        return { changed: changes.map((change) => change.key) };
    });
}
