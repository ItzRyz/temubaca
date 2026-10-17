import { z } from "zod";

export const staleDayOptions = [7, 14, 30, 60, 90] as const;

/** Admin "Pengaturan → Katalog Buku" (Figma 161:859). Defaults keep today's behaviour. */
export const catalogSettingsSchema = z
    .object({
        primaryProvider: z.enum(["OPEN_LIBRARY", "GOOGLE_BOOKS"]),
        /** Use the other provider when the primary has no data, fails, or is rate limited. */
        fallbackEnabled: z.boolean(),
        staleAfterDays: z.union(staleDayOptions.map((value) => z.literal(value)) as [z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<30>, z.ZodLiteral<60>, z.ZodLiteral<90>]),
        showAttribution: z.boolean(),
    })
    .strict();

export type CatalogSettings = z.infer<typeof catalogSettingsSchema>;

export const defaultCatalogSettings: CatalogSettings = {
    primaryProvider: "OPEN_LIBRARY",
    fallbackEnabled: true,
    staleAfterDays: 30,
    showAttribution: true,
};

/** Stored JSON may predate a field or be hand-edited; fall back field by field. */
export function parseCatalogSettings(value: unknown): CatalogSettings {
    const merged = { ...defaultCatalogSettings, ...(value && typeof value === "object" ? value : {}) };
    const parsed = catalogSettingsSchema.safeParse(merged);
    return parsed.success ? parsed.data : defaultCatalogSettings;
}

/** Providers in the order a sync should try them, honouring the fallback switch. */
export function providerOrder(settings: Pick<CatalogSettings, "primaryProvider" | "fallbackEnabled">) {
    const secondary = settings.primaryProvider === "OPEN_LIBRARY" ? "GOOGLE_BOOKS" : "OPEN_LIBRARY";
    return settings.fallbackEnabled ? [settings.primaryProvider, secondary] as const : [settings.primaryProvider] as const;
}

/** Field-level diff for the audit log. */
export function changedSettings(before: CatalogSettings, after: CatalogSettings) {
    return (Object.keys(after) as (keyof CatalogSettings)[])
        .filter((key) => before[key] !== after[key])
        .map((key) => ({ key, from: before[key], to: after[key] }));
}
