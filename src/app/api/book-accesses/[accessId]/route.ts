import { apiSuccess, parseBody, parseParams, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { actOnAccessRequest } from "@/lib/db/queries/libraries";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { accessActionSchema, accessIdParamSchema } from "@/lib/validation/schemas/library.schema";

type RouteContext = { params: Promise<{ accessId: string }> };

/** The reader cancels; the library's manager approves (pick-up deadline), rejects with a reason, or marks it collected. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("library-access-write", user.id), ...RATE_LIMITS.WRITE });
    const { accessId } = await parseParams(context.params, accessIdParamSchema);
    const input = await parseBody(request, accessActionSchema);
    return apiSuccess(await actOnAccessRequest(accessId, user.id, input));
});
