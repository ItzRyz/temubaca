import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;
export type SendResult<T> = { ok: true; data: T } | { ok: false; message: string; fieldErrors: FieldErrors };

/** First message per field, keyed by the top-level field name. */
export function fieldErrorsOf(error: ZodError): FieldErrors {
    const errors: FieldErrors = {};
    for (const issue of error.issues) {
        const key = String(issue.path[0] ?? "form");
        errors[key] ??= issue.message;
    }
    return errors;
}

/** JSON or multipart call to the community endpoints; validation errors come back per field. */
export async function sendCommunityRequest<T = unknown>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<SendResult<T>> {
    try {
        const isForm = body instanceof FormData;
        const response = await fetch(url, {
            method,
            headers: isForm || body === undefined ? undefined : { "content-type": "application/json" },
            body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.status === 429) return { ok: false, message: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.", fieldErrors: {} };
        if (response.status === 413) return { ok: false, message: "Ukuran berkas maksimal 5 MB.", fieldErrors: { file: "Ukuran berkas maksimal 5 MB." } };
        type Flattened = { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
        const payload = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: { message?: string; details?: Flattened } } | null;
        if (response.ok && payload?.success) return { ok: true, data: payload.data as T };
        const fieldErrors: FieldErrors = {};
        for (const [key, messages] of Object.entries(payload?.error?.details?.fieldErrors ?? {})) if (messages?.[0]) fieldErrors[key] = messages[0];
        const message = payload?.error?.details?.formErrors?.[0] ?? (Object.keys(fieldErrors).length > 0 ? "Periksa kembali isian yang ditandai." : payload?.error?.message) ?? "Perubahan belum dapat disimpan. Coba lagi.";
        return { ok: false, message, fieldErrors };
    } catch {
        return { ok: false, message: "Koneksi terputus. Isian Anda masih ada; coba lagi.", fieldErrors: {} };
    }
}
