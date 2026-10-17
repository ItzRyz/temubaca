/** Client-side calls to the loan endpoints; returns the server's message on failure. */
export async function sendLoanRequest(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        const response = await fetch(url, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        if (response.status === 429) return { ok: false, message: "Terlalu banyak percobaan. Coba lagi sebentar lagi." };
        type Flattened = { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
        const payload = await response.json().catch(() => null) as { success?: boolean; error?: { message?: string; details?: Flattened } } | null;
        if (response.ok && payload?.success) return { ok: true };
        // Validation errors carry zod's flattened messages, which are written in Indonesian.
        const details = payload?.error?.details;
        const detail = details?.formErrors?.[0] ?? Object.values(details?.fieldErrors ?? {}).find((messages) => messages?.length)?.[0];
        return { ok: false, message: detail ?? payload?.error?.message ?? "Permintaan belum dapat diproses. Coba lagi." };
    } catch {
        return { ok: false, message: "Koneksi terputus. Periksa jaringan Anda lalu coba lagi." };
    }
}
