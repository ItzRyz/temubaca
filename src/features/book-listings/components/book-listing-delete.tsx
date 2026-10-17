"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { listingDeletionBlocker, listingDeletionBlockerMessage } from "../listing-deletion";

type BookListingDeleteProps = {
    listingId: string;
    bookTitle: string;
    availability: string;
};

export function BookListingDelete({ listingId, bookTitle, availability }: BookListingDeleteProps) {
    const router = useRouter();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Request history is only known server-side; the API rejects that case with 409.
    const blocker = listingDeletionBlocker({ availability, borrowRequestCount: 0 });

    function open() {
        setError(null);
        dialogRef.current?.showModal();
    }

    async function confirmDelete() {
        setPending(true);
        setError(null);
        try {
            const response = await fetch(`/api/book-listings/${listingId}`, { method: "DELETE" });
            if (!response.ok) {
                const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
                setError(response.status === 409 && body?.error?.message
                    ? body.error.message
                    : response.status === 429
                        ? "Terlalu banyak perubahan. Coba lagi sebentar."
                        : "Listing belum dapat dihapus. Coba lagi.");
                return;
            }
            dialogRef.current?.close();
            router.refresh();
        } catch {
            setError("Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    if (blocker) {
        return <p className="mt-2 text-xs text-muted-foreground">{listingDeletionBlockerMessage[blocker]}</p>;
    }

    return (
        <>
            <button
                type="button"
                onClick={open}
                className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-destructive hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
                <Trash2 aria-hidden="true" className="size-4" /> Hapus listing
            </button>
            <dialog
                ref={dialogRef}
                aria-labelledby={titleId}
                className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-card p-6 text-foreground shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(0,23,14,0.6)] backdrop:backdrop-blur-[2px]"
            >
                <h2 id={titleId} className="font-heading text-lg font-semibold">Hapus listing ini?</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Salinan <span className="font-semibold text-foreground">{bookTitle}</span> akan dihapus permanen dari Buku Saya dan halaman buku publik. Tindakan ini tidak dapat dibatalkan.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Kalau hanya ingin berhenti menawarkan sementara, matikan saja switch &ldquo;Ditawarkan&rdquo;.
                </p>
                {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        autoFocus
                        onClick={() => dialogRef.current?.close()}
                        className="min-h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={confirmDelete}
                        disabled={pending}
                        className="min-h-10 rounded-lg bg-destructive px-4 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-60"
                    >
                        {pending ? "Menghapus…" : "Hapus permanen"}
                    </button>
                </div>
            </dialog>
        </>
    );
}
