import { apiSuccess, ConflictError, NotFoundError, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { accountActionBlocker } from "@/features/admin-users/account-rules";
import { setUserSuspension } from "@/lib/db/queries/admin-users";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { userIdParamSchema } from "@/lib/validation/common";
import { userSuspensionSchema } from "@/lib/validation/schemas/user.schema";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ userId: string }> };

/** Suspend (reason required) or reinstate an account. Recorded in `admin_audit_logs`. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { userId } = await parseParams(context.params, userIdParamSchema);
    const input = await parseBody(request, userSuspensionSchema);

    const target = await db.query.userProfiles.findFirst({ where: eq(userProfiles.id, userId), columns: { id: true, role: true } });
    if (!target) throw new NotFoundError("Pengguna tidak ditemukan.");
    const blocker = input.suspended ? accountActionBlocker("suspend", { actorId: admin.id, targetId: userId, targetRole: target.role }) : null;
    if (blocker === "self") throw new ConflictError("Kamu tidak dapat menangguhkan akunmu sendiri.");
    if (blocker === "admin_target") throw new ConflictError("Turunkan peran admin terlebih dahulu sebelum menangguhkan akun ini.");

    const result = await setUserSuspension({ targetId: userId, actorId: admin.id, suspended: input.suspended, reason: input.reason });
    if (result.status === "not_found") throw new NotFoundError("Pengguna tidak ditemukan.");
    return apiSuccess({ id: userId, suspended: input.suspended, changed: result.status === "updated" });
});
