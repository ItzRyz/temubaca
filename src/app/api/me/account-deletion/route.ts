import { z } from "zod";

import { apiSuccess, ConflictError, parseBody, requireApiRateLimit, requireApiUser, UnauthorizedError, withApiHandler } from "@/lib/api";
import { CONFIRM_WORD } from "@/features/account-deletion/rules";
import { getCurrentUser } from "@/lib/auth";
import { cancelAccountDeletion, requestAccountDeletion } from "@/lib/db/queries/account-deletion";
import { createUserRateLimitKey } from "@/lib/rate-limit";

const requestSchema = z.object({
    confirm: z.string().trim().refine((value) => value === CONFIRM_WORD, `Ketik ${CONFIRM_WORD} untuk melanjutkan.`),
}).strict();

/** "Hapus Akun Saya" (Figma 210:1145): starts the 14-day grace period (DEC-11). */
export const POST = withApiHandler(async (request) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("account-deletion", user.id), limit: 5, windowSeconds: 3600 });
    await parseBody(request, requestSchema);
    const { scheduledFor } = await requestAccountDeletion(user.id);
    return apiSuccess({ scheduledFor });
});

/** Cancels a pending deletion. Uses the plain session: requireApiUser refuses accounts in the grace period. */
export const DELETE = withApiHandler(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requireApiRateLimit({ key: createUserRateLimitKey("account-deletion", user.id), limit: 5, windowSeconds: 3600 });
    if (!(await cancelAccountDeletion(user.id))) throw new ConflictError("Tidak ada penghapusan akun yang dijadwalkan.");
    return apiSuccess({ cancelled: true });
});
