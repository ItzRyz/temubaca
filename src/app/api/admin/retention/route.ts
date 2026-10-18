import { apiSuccess, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { runRetention } from "@/features/account-deletion/retention";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey } from "@/lib/rate-limit";

/** "Jalankan sekarang" in Pengaturan → Retensi & Data; recorded in admin_audit_logs. */
export const POST = withApiHandler(async () => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("retention-run", admin.id), limit: 3, windowSeconds: 3600 });
    return apiSuccess(await runRetention(admin.id));
});
