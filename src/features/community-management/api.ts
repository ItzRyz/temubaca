import "server-only";

import type { ZodType } from "zod";

import { BadRequestError, ForbiddenError, NotFoundError, PayloadTooLargeError, requireApiUser, validate } from "@/lib/api";
import { getCommunityAccess, type EvidenceFile } from "@/lib/db/queries/community-management";
import { isEvidenceStorageAvailable, uploadEvidenceFile } from "@/lib/supabase/storage";

import { communityCapabilities, evidenceFileError, EVIDENCE_MAX_BYTES, merchPhotoError, MERCH_PHOTO_MAX_BYTES, type CommunityStatus } from "./rules";

type Capability = Exclude<keyof ReturnType<typeof communityCapabilities>, "view">;

const deniedMessage: Record<Capability, string> = {
    editProfile: "Hanya pemilik yang dapat mengubah profil komunitas.",
    manageTeam: "Hanya pemilik komunitas terverifikasi yang dapat mengatur pengurus.",
    submitVerification: "Hanya pemilik yang dapat mengajukan verifikasi, setelah komunitas terverifikasi atau ditolak.",
    manageContent: "Acara dan merchandise hanya dapat dikelola pengurus komunitas yang terverifikasi.",
};

/** Signed-in owner/manager with the given capability; strangers get 404 so communities are not probed. */
export async function requireCommunityCapability(communityId: string, capability: Capability) {
    const user = await requireApiUser();
    const access = await getCommunityAccess(user.id, communityId);
    if (!access?.role) throw new NotFoundError("Komunitas tidak ditemukan.");
    if (!communityCapabilities(access.role, access.community.status as CommunityStatus)[capability]) throw new ForbiddenError(deniedMessage[capability]);
    return { user, community: access.community, role: access.role };
}

/**
 * The image in a multipart `file` field (logo, banner, event image): JPG/PNG/WebP up to 2 MB, the same
 * rules as merchandise photos. `label` names it in messages ("Logo", "Banner", "Gambar acara").
 */
export async function readCommunityImage(request: Request, label: string) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MERCH_PHOTO_MAX_BYTES + 64 * 1024) throw new PayloadTooLargeError(`Ukuran ${label.toLowerCase()} maksimal 2 MB.`);
    let file: FormDataEntryValue | null;
    try {
        file = (await request.formData()).get("file");
    } catch {
        throw new BadRequestError("Formulir tidak dapat dibaca.");
    }
    if (!(file instanceof File)) throw new BadRequestError(`Pilih ${label.toLowerCase()} untuk diunggah.`);
    const problem = merchPhotoError(file, label);
    if (problem) throw new BadRequestError(problem);
    if (!isEvidenceStorageAvailable()) throw new BadRequestError(`Unggah ${label.toLowerCase()} belum tersedia di server ini.`);
    return file;
}

/** Reads a multipart form with an optional `file` field (evidence, ≤5 MB) and validates the other fields. */
export async function parseEvidenceForm<T>(request: Request, schema: ZodType<T>) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > EVIDENCE_MAX_BYTES + 256 * 1024) throw new PayloadTooLargeError("Ukuran berkas maksimal 5 MB.");
    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        throw new BadRequestError("Formulir tidak dapat dibaca.");
    }
    const fields: Record<string, string> = {};
    for (const [key, value] of form.entries()) if (typeof value === "string") fields[key] = value;
    const input = validate(schema, fields);
    const file = form.get("file");
    return { input, file: file instanceof File && file.size > 0 ? file : null };
}

/**
 * Uploads an evidence file after checking type and size; returns what the submission row stores.
 * `folder` is the community id, or `applications/<userId>` before the community exists.
 */
export async function storeEvidenceFile(folder: string, file: File | null): Promise<EvidenceFile | null> {
    if (!file) return null;
    const error = evidenceFileError(file);
    if (error) throw new BadRequestError(error);
    if (!isEvidenceStorageAvailable()) throw new BadRequestError("Unggah berkas belum tersedia di server ini. Kirim tautan bukti saja.");
    const path = await uploadEvidenceFile(folder, file);
    return { path, name: file.name.slice(0, 120), type: file.type, size: file.size };
}
