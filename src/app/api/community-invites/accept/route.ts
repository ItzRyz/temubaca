import { apiSuccess, parseBody, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { acceptManagerInvite } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { acceptInviteSchema } from "@/lib/validation/schemas/community-management.schema";

export const POST = withApiHandler(async (request) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("community-invite-accept", user.id), limit: 10, windowSeconds: 3600 });
    const { token } = await parseBody(request, acceptInviteSchema);
    return apiSuccess(await acceptManagerInvite(token, user.id));
});
