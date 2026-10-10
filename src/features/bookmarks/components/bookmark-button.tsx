"use client";

import Link from "next/link";
import { useState } from "react";

type BookmarkButtonProps = {
    bookId: string;
    isAuthenticated: boolean;
    initiallyBookmarked: boolean;
    /** Overrides the trigger styling; behaviour is unchanged. */
    className?: string;
};

export function BookmarkButton({
    bookId,
    isAuthenticated,
    initiallyBookmarked,
    className,
}: BookmarkButtonProps) {
    const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isAuthenticated) {
        return (
            <Link
                href="/login"
                className={className ?? "inline-flex min-h-11 items-center justify-center rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/5"}
            >
                {className ? "Simpan" : "Masuk untuk menyimpan"}
            </Link>
        );
    }

    async function toggleBookmark() {
        setPending(true);
        setError(null);

        try {
            const response = await fetch(`/api/bookmarks/${bookId}`, {
                method: bookmarked ? "DELETE" : "PUT",
            });

            if (!response.ok) {
                setError(
                    response.status === 429
                        ? "Terlalu banyak perubahan. Coba lagi sebentar."
                        : "Bookmark belum dapat diperbarui. Coba lagi.",
                );
                return;
            }

            setBookmarked(!bookmarked);
        } catch {
            setError("Koneksi terputus. Periksa internet lalu coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                aria-pressed={bookmarked}
                disabled={pending}
                onClick={toggleBookmark}
                className={className ?? "inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"}
            >
                {pending ? "Menyimpan…" : bookmarked ? "Tersimpan" : "Simpan buku"}
            </button>
            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
    );
}
