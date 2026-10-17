import "server-only";

import { randomUUID } from "node:crypto";

import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES } from "@/features/community-management/rules";

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
