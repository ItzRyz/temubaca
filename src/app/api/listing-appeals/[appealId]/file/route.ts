import { NextResponse } from "next/server";
import { z } from "zod";

import { NotFoundError, parseParams, requireApiUser, withApiHandler } from "@/lib/api";
import { findAppealFile } from "@/lib/db/queries/listing-appeals";
import { signedEvidenceUrl } from "@/lib/supabase/storage";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ appealId: string }> };

/** Appeal photos are private: the listing owner or an admin gets a 60-second signed URL. */
export const GET = withApiHandler(async (_request, context: RouteContext) => {
    const { appealId } = await parseParams(context.params, z.object({ appealId: uuidSchema }));
    const user = await requireApiUser();
    const appeal = await findAppealFile(appealId);
    if (!appeal?.filePath || (user.role !== "ADMIN" && appeal.ownerId !== user.id)) throw new NotFoundError("Berkas tidak ditemukan.");
    const url = await signedEvidenceUrl(appeal.filePath, appeal.fileName);
    if (!url) throw new NotFoundError("Berkas tidak dapat dibuka saat ini.");
    return NextResponse.redirect(url, 303);
});
