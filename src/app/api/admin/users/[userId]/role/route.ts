import { apiSuccess, ConflictError, NotFoundError, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { accountActionBlocker } from "@/features/admin-users/account-rules";
import { setUserRole } from "@/lib/db/queries/admin-users";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { userIdParamSchema } from "@/lib/validation/common";
import { userRoleChangeSchema } from "@/lib/validation/schemas/user.schema";

type RouteContext = { params: Promise<{ userId: string }> };

/** Change an account's platform role (MEMBER ↔ ADMIN). Admins cannot change their own role. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("moderation-write", admin.id), ...RATE_LIMITS.WRITE });
    const { userId } = await parseParams(context.params, userIdParamSchema);
    const input = await parseBody(request, userRoleChangeSchema);

    if (accountActionBlocker("role", { actorId: admin.id, targetId: userId, targetRole: input.role }) === "self") {
        throw new ConflictError("Kamu tidak dapat mengubah peranmu sendiri.");
    }

    const result = await setUserRole({ targetId: userId, actorId: admin.id, role: input.role, note: input.note });
    if (result.status === "not_found") throw new NotFoundError("Pengguna tidak ditemukan.");
    return apiSuccess({ id: userId, role: input.role, changed: result.status === "updated" });
});
