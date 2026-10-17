"use client";

import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Add a provider record to TemuBaca, then open its book page so the reader can list a copy. */
export function ImportBookButton({ provider, providerId, title, isAuthenticated, returnTo }: {
    provider: "OPEN_LIBRARY" | "GOOGLE_BOOKS";
    providerId: string;
    title: string;
    isAuthenticated: boolean;
    returnTo: string;
}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isAuthenticated) {
        return (
            <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="flex h-10 items-center justify-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">
                Masuk untuk menambahkan
            </Link>
        );
    }

    async function importBook() {
        setPending(true);
        setError(null);
        try {
            const response = await fetch("/api/books/import", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ provider, providerId }),
            });
            const payload = await response.json().catch(() => null) as { data?: { bookId: string }; error?: { message?: string } } | null;
            if (!response.ok || !payload?.data) {
                setError(response.status === 429 ? "Terlalu banyak penambahan. Tunggu sebentar." : payload?.error?.message ?? "Buku belum dapat ditambahkan.");
                return;
            }
            router.push(`/books/${payload.data.bookId}`);
        } catch {
            setError("Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={importBook}
                disabled={pending}
                aria-label={`Tambahkan ${title} ke katalog TemuBaca`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
                <PlusCircle aria-hidden="true" className="size-4" /> {pending ? "Menambahkan…" : "Tambahkan ke TemuBaca"}
            </button>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
    );
}
