import { describe, expect, test } from "bun:test";

import { catalogRecordStatus } from "../../src/features/catalog/catalog-status";
import { catalogSettingsSchema, changedSettings, defaultCatalogSettings, parseCatalogSettings, providerOrder } from "../../src/features/settings/catalog-settings";

describe("catalog settings", () => {
    test("stored values fall back to defaults field by field", () => {
        expect(parseCatalogSettings(undefined)).toEqual(defaultCatalogSettings);
        expect(parseCatalogSettings({ staleAfterDays: 60 })).toEqual({ ...defaultCatalogSettings, staleAfterDays: 60 });
        expect(parseCatalogSettings({ staleAfterDays: 45 })).toEqual(defaultCatalogSettings);
    });

    test("only listed stale periods and known providers are accepted", () => {
        expect(catalogSettingsSchema.safeParse({ ...defaultCatalogSettings, staleAfterDays: 14 }).success).toBe(true);
        expect(catalogSettingsSchema.safeParse({ ...defaultCatalogSettings, staleAfterDays: 3 }).success).toBe(false);
        expect(catalogSettingsSchema.safeParse({ ...defaultCatalogSettings, primaryProvider: "MANUAL" }).success).toBe(false);
    });

    test("the fallback switch controls whether the second provider is used", () => {
        expect(providerOrder({ primaryProvider: "GOOGLE_BOOKS", fallbackEnabled: true })).toEqual(["GOOGLE_BOOKS", "OPEN_LIBRARY"]);
        expect(providerOrder({ primaryProvider: "OPEN_LIBRARY", fallbackEnabled: false })).toEqual(["OPEN_LIBRARY"]);
    });

    test("audits only the fields that changed", () => {
        expect(changedSettings(defaultCatalogSettings, { ...defaultCatalogSettings, showAttribution: false })).toEqual([{ key: "showAttribution", from: true, to: false }]);
    });

    test("the stale period drives the catalog label", () => {
        const now = new Date("2026-10-17T00:00:00Z");
        const record = { createdAt: new Date("2026-09-30T00:00:00Z"), syncedAt: null, lastSyncFailed: false, duplicateCount: 0 };
        expect(catalogRecordStatus(record, now, 30)).toBe("FRESH");
        expect(catalogRecordStatus(record, now, 14)).toBe("STALE");
    });
});
