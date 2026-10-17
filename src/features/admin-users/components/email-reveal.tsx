"use client";

import { Eye } from "lucide-react";
import { useState } from "react";

/** Reveal the full email on demand; the server writes an audit entry before returning it. */
export function EmailReveal({ userId, masked }: { userId: string; masked: string }) {
    const [email, setEmail] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function reveal() {
        setPending(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/users/${userId}/email`, { method: "POST" });
            const payload = await response.json().catch(() => null) as { data?: { email: string }; error?: { message?: string } } | null;
            if (!response.ok || !payload?.data) {
                setError(payload?.error?.message ?? "Email belum dapat ditampilkan.");
                return;
            }
            setEmail(payload.data.email);
        } catch {
            setError("Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="col-span-2 flex flex-col gap-1">
            <dl>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-0.5 font-semibold break-all">{email ?? masked}</dd>
            </dl>
            {!email && (
                <button type="button" onClick={reveal} disabled={pending} className="flex w-fit items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60">
                    <Eye aria-hidden="true" className="size-3.5" /> {pending ? "Memuat…" : "Tampilkan email lengkap (tercatat di audit)"}
                </button>
            )}
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
    );
}
