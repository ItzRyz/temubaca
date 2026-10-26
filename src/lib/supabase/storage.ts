import "server-only";

import { randomUUID } from "node:crypto";

import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES, MERCH_PHOTO_MAX_BYTES, MERCH_PHOTO_TYPES } from "@/features/community-management/rules";
import { MERCH_PHOTO_BUCKET } from "@/features/merchandise/format";

import { getSupabaseAdmin } from "./admin";

export const EVIDENCE_BUCKET = "community-evidence";

let bucketReady: Promise<void> | null = null;

/** Creates the private evidence bucket on first use; it is never public and only signed URLs are handed out. */
function ensureEvidenceBucket() {
    bucketReady ??= (async () => {
        const admin = getSupabaseAdmin();
        if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
        const { data } = await admin.storage.getBucket(EVIDENCE_BUCKET);
        if (data) return;
        const { error } = await admin.storage.createBucket(EVIDENCE_BUCKET, {
            public: false,
            fileSizeLimit: EVIDENCE_MAX_BYTES,
            allowedMimeTypes: [...EVIDENCE_TYPES],
        });
        if (error && !/already exists/i.test(error.message)) throw error;
    })().catch((error) => {
        bucketReady = null;
        throw error;
    });
    return bucketReady;
}

export function isEvidenceStorageAvailable() {
    return getSupabaseAdmin() !== null;
}

const extensionFor: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

/** Stores an already-validated evidence file under a random name; returns its storage path. */
export async function uploadEvidenceFile(folder: string, file: File) {
    await ensureEvidenceBucket();
    const admin = getSupabaseAdmin()!;
    const path = `${folder}/${randomUUID()}.${extensionFor[file.type] ?? "bin"}`;
    const { error } = await admin.storage.from(EVIDENCE_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
}

export async function removeEvidenceFile(path: string) {
    const admin = getSupabaseAdmin();
    if (admin) await admin.storage.from(EVIDENCE_BUCKET).remove([path]);
}

/** A short-lived link for the owner or an admin to open the file. */
export async function signedEvidenceUrl(path: string, fileName: string | null) {
    const admin = getSupabaseAdmin();
    if (!admin) return null;
    const { data, error } = await admin.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 60, fileName ? { download: fileName } : undefined);
    return error ? null : data.signedUrl;
}

let photoBucketReady: Promise<void> | null = null;

/** Public bucket for community images: merchandise photos (DEC-12) and logos (TB-030). Uploads go only through the server. */
function ensureMerchandisePhotoBucket() {
    photoBucketReady ??= (async () => {
        const admin = getSupabaseAdmin();
        if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
        const { data } = await admin.storage.getBucket(MERCH_PHOTO_BUCKET);
        if (data) return;
        const { error } = await admin.storage.createBucket(MERCH_PHOTO_BUCKET, {
            public: true,
            fileSizeLimit: MERCH_PHOTO_MAX_BYTES,
            allowedMimeTypes: [...MERCH_PHOTO_TYPES],
        });
        if (error && !/already exists/i.test(error.message)) throw error;
    })().catch((error) => {
        photoBucketReady = null;
        throw error;
    });
    return photoBucketReady;
}

const photoExtensionFor: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Stores an already-validated image as `<communityId>/<prefix><uuid>.<ext>`; returns its storage path. */
async function uploadCommunityImage(communityId: string, file: File, prefix = "") {
    await ensureMerchandisePhotoBucket();
    const admin = getSupabaseAdmin()!;
    const path = `${communityId}/${prefix}${randomUUID()}.${photoExtensionFor[file.type]}`;
    const body = await file.arrayBuffer();
    let { error } = await admin.storage.from(MERCH_PHOTO_BUCKET).upload(path, body, { contentType: file.type, upsert: false });
    // A dropped connection to Storage surfaces as StorageUnknownError; one retry covers it.
    if (error?.name === "StorageUnknownError") ({ error } = await admin.storage.from(MERCH_PHOTO_BUCKET).upload(path, body, { contentType: file.type, upsert: false }));
    if (error) throw error;
    return path;
}

export function uploadMerchandisePhoto(communityId: string, file: File) {
    return uploadCommunityImage(communityId, file);
}

export function uploadCommunityLogo(communityId: string, file: File) {
    return uploadCommunityImage(communityId, file, "logo-");
}

export async function removeCommunityImages(paths: string[]) {
    const admin = getSupabaseAdmin();
    if (admin && paths.length > 0) await admin.storage.from(MERCH_PHOTO_BUCKET).remove(paths);
}
