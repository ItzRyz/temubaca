import { apiSuccess, parseBody, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { catalogSettingsSchema } from "@/features/settings/catalog-settings";
import { saveCatalogSettings } from "@/lib/db/queries/settings";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/** Save "Pengaturan → Katalog Buku"; changed fields are written to `admin_audit_logs`. */
export const PUT = withApiHandler(async (request) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("settings-write", admin.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, catalogSettingsSchema);

    const result = await saveCatalogSettings(input, admin.id);
    return apiSuccess({ settings: input, changed: result.changed });
});
