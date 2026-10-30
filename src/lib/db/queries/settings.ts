import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { changedFields, parseSettings, settingsSections, type SettingsOf, type SettingsSection } from "@/features/settings/platform-settings";

import { db } from "../client";
import { adminAuditLogs, appSettings, userProfiles } from "../schema";

/** Settings are not a row-level entity; audit entries point at this fixed id. */
const SETTINGS_TARGET_ID = "00000000-0000-0000-0000-000000000000";

/** One section of admin settings, read once per request; each section is a row keyed by its name. */
export const getSettings = cache(async <S extends SettingsSection>(section: S) => {
    const [row] = await db
        .select({ value: appSettings.value, updatedAt: appSettings.updatedAt, updatedByName: userProfiles.displayName })
        .from(appSettings)
        .leftJoin(userProfiles, eq(appSettings.updatedById, userProfiles.id))
        .where(eq(appSettings.key, section));
    return {
        settings: parseSettings(section, row?.value),
        updatedAt: row?.updatedAt ?? null,
        updatedByName: row?.updatedByName ?? null,
    };
});

/** Current catalog settings, read once per request. */
export const getCatalogSettings = () => getSettings("catalog");

/** Save one section and audit the changed fields in one transaction. */
export async function saveSettings<S extends SettingsSection>(section: S, next: SettingsOf<S>, actorId: string) {
    return db.transaction(async (tx) => {
        const [current] = await tx.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, section)).for("update");
        const before = parseSettings(section, current?.value);
        const changes = changedFields(before as Record<string, unknown>, next as Record<string, unknown>);
        if (changes.length === 0) return { changed: [] as string[] };

        const now = new Date();
        await tx.insert(appSettings)
            .values({ key: section, value: next, updatedById: actorId, updatedAt: now })
            .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedById: actorId, updatedAt: now } });
        await tx.insert(adminAuditLogs).values({
            actorId,
            action: "SETTINGS_UPDATED",
            targetType: "OTHER",
            targetId: SETTINGS_TARGET_ID,
            note: `${settingsSections[section].label}: ${changes.map((change) => change.key).join(", ")}`,
            metadata: { section, changes },
            createdAt: now,
        });
        return { changed: changes.map((change) => change.key) };
    });
}

