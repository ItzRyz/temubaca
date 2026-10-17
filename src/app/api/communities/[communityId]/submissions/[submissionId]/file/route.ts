import { NextResponse } from "next/server";

import { NotFoundError, parseParams, requireApiUser, withApiHandler } from "@/lib/api";
import { getCommunityAccess, findCommunitySubmission } from "@/lib/db/queries/community-management";
import { signedEvidenceUrl } from "@/lib/supabase/storage";
import { submissionIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string; submissionId: string }> };

/** Evidence files are private: the owner or an admin is redirected to a 60-second signed URL. */
export const GET = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId, submissionId } = await parseParams(context.params, submissionIdSchema);
    const user = await requireApiUser();
    const access = user.role === "ADMIN" ? null : await getCommunityAccess(user.id, communityId);
    if (user.role !== "ADMIN" && access?.role !== "owner") throw new NotFoundError("Berkas tidak ditemukan.");
    const submission = await findCommunitySubmission(communityId, submissionId);
    if (!submission?.filePath) throw new NotFoundError("Berkas tidak ditemukan.");
    const url = await signedEvidenceUrl(submission.filePath, submission.fileName);
    if (!url) throw new NotFoundError("Berkas tidak dapat dibuka saat ini.");
    return NextResponse.redirect(url, 303);
});
