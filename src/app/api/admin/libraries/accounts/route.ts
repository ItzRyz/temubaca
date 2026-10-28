import { z } from "zod";

import { apiSuccess, parseQuery, withApiHandler } from "@/lib/api";
import { searchAccountsForManager } from "@/lib/db/queries/libraries";
import { requireAdmin } from "@/lib/permissions/guards";

const querySchema = z.object({ q: z.string().trim().min(2, "Ketik minimal 2 huruf.").max(80) });

/** Accounts to appoint as a library's manager, by display name only. */
export const GET = withApiHandler(async (request) => {
    await requireAdmin();
    const { q } = parseQuery(request, querySchema);
    return apiSuccess(await searchAccountsForManager(q));
});
