import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { setLibraryManager } from "@/lib/db/queries/libraries";
import { requireAdmin } from "@/lib/permissions/guards";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { libraryIdParamSchema, libraryManagerSchema } from "@/lib/validation/schemas/library.schema";

type RouteContext = { params: Promise<{ libraryId: string }> };

async function setManager(request: Request, context: RouteContext, appointed: boolean) {
    const admin = await requireAdmin();
    await requireApiRateLimit({ key: createUserRateLimitKey("libraries-write", admin.id), ...RATE_LIMITS.WRITE });
    const { libraryId } = await parseParams(context.params, libraryIdParamSchema);
    const { userId } = await parseBody(request, libraryManagerSchema);
    return apiSuccess(await setLibraryManager(libraryId, userId, admin.id, appointed));
}

/** Appoint (POST) or remove (DELETE) a library's manager; recorded in the audit log. */
export const POST = withApiHandler((request, context: RouteContext) => setManager(request, context, true));
export const DELETE = withApiHandler((request, context: RouteContext) => setManager(request, context, false));
