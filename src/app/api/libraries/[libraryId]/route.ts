import { apiSuccess, parseBody, parseParams, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { updateLibraryAccessSettings } from "@/lib/db/queries/libraries";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { libraryAccessSettingsSchema, libraryIdParamSchema } from "@/lib/validation/schemas/library.schema";

type RouteContext = { params: Promise<{ libraryId: string }> };

/** A library's manager decides whether readers can ask through TemuBaca, the rules, and the pick-up window. */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("library-write", user.id), ...RATE_LIMITS.WRITE });
    const { libraryId } = await parseParams(context.params, libraryIdParamSchema);
    const input = await parseBody(request, libraryAccessSettingsSchema);
    return apiSuccess(await updateLibraryAccessSettings(libraryId, user.id, input));
});
