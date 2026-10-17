import { apiSuccess, NotFoundError, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { recordEmailReveal } from "@/lib/db/queries/admin-users";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { getAuthEmail } from "@/lib/supabase/admin";
import { userIdParamSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ userId: string }> };

/** Reveal one account's full email. Every reveal is written to `admin_audit_logs` first. */
export const POST = withApiHandler(async (_request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("email-reveal", admin.id), limit: 10, windowSeconds: 60 });
    const { userId } = await parseParams(context.params, userIdParamSchema);

    const email = await getAuthEmail(userId);
    if (!email) throw new NotFoundError("Email tidak tersedia. Pastikan SUPABASE_SERVICE_ROLE_KEY sudah diatur.");
    await recordEmailReveal(admin.id, userId);
    return apiSuccess({ email });
});
