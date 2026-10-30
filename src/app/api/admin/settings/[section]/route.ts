import type { ZodType } from "zod";

import { apiSuccess, NotFoundError, parseBody, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { isSettingsSection, settingsSections } from "@/features/settings/platform-settings";
import { saveSettings } from "@/lib/db/queries/settings";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ section: string }> };

/** Save one section of "Pengaturan" (30 Okt 2026); changed fields are written to `admin_audit_logs`. */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { section } = await context.params;
    if (!isSettingsSection(section)) throw new NotFoundError("Bagian pengaturan tidak ditemukan.");
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("settings-write", admin.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, settingsSections[section].schema as ZodType<Record<string, unknown>>);

    const result = await saveSettings(section, input as never, admin.id);
    return apiSuccess({ settings: input, changed: result.changed });
});
