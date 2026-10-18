import { z } from "zod";

import { apiCreated, BadRequestError, parseParams, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { parseEvidenceForm } from "@/features/community-management/api";
import { APPEAL_DETAILS_MAX, appealFileError, appealReasons } from "@/features/listing-appeals/rules";
import { createListingAppeal } from "@/lib/db/queries/listing-appeals";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { isEvidenceStorageAvailable, removeEvidenceFile, uploadEvidenceFile } from "@/lib/supabase/storage";
import { listingIdParamSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ listingId: string }> };

const appealSchema = z.object({
    reason: z.enum(appealReasons, { error: "Pilih alasan banding." }),
    details: z.string().trim().min(10, "Jelaskan minimal 10 karakter.").max(APPEAL_DETAILS_MAX, `Penjelasan maksimal ${APPEAL_DETAILS_MAX} karakter.`),
});

/** "Ajukan Banding" (Figma 301:2608): multipart with an optional JPG/PNG photo. */
export const POST = withApiHandler(async (request, context: RouteContext) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("listing-appeal", user.id), limit: 5, windowSeconds: 3600 });
    const { listingId } = await parseParams(context.params, listingIdParamSchema);
    const { input, file } = await parseEvidenceForm(request, appealSchema);

    let stored: { path: string; name: string; type: string; size: number } | null = null;
    if (file) {
        const problem = appealFileError(file);
        if (problem) throw new BadRequestError(problem);
        if (!isEvidenceStorageAvailable()) throw new BadRequestError("Unggah foto belum tersedia di server ini. Kirim banding tanpa foto.");
        stored = { path: await uploadEvidenceFile(`appeals/${listingId}`, file), name: file.name.slice(0, 120), type: file.type, size: file.size };
    }
    try {
        return apiCreated(await createListingAppeal(user.id, listingId, input, stored));
    } catch (error) {
        if (stored) await removeEvidenceFile(stored.path).catch(() => undefined);
        throw error;
    }
});
