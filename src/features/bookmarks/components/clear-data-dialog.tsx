"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { FormAlert } from "@/components/ui/form";

import { clearMyBookmarksAndInterests } from "../actions";
import { notify } from "@/lib/toast";

/** Confirmation dialog from Figma 209:1097; the account and the reader's own listings are untouched. */
export function ClearDataDialog({ bookmarkCount, interestCount }: { bookmarkCount: number; interestCount: number }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [done, setDone] = useState("");
    const empty = bookmarkCount === 0 && interestCount === 0;

    function open() {
        setError("");
        dialogRef.current?.showModal();
    }

    function confirm() {
        setError("");
        startTransition(async () => {
            const result = await clearMyBookmarksAndInterests();
            if (!result.success) {
                setError(result.message);
                return;
            }
            dialogRef.current?.close();
            setDone(`${result.bookmarks} bookmark dan ${result.interests} minat telah dihapus.`);
            notify.success("Bookmark dan minat dihapus.");
            router.refresh();
        });
    }

    return (
        <div className="mt-5">
            <button
                type="button"
                onClick={open}
                disabled={empty}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Trash2 aria-hidden="true" className="size-4" /> Hapus bookmark dan minat
            </button>
            {empty && !done && <p className="mt-2 text-xs text-muted-foreground">Belum ada bookmark atau minat yang tersimpan.</p>}
            <FormAlert className="mt-3" tone="success">{done}</FormAlert>

            <dialog
                ref={dialogRef}
                aria-labelledby={titleId}
                className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-[#fcfbf7] p-6 text-foreground shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(0,23,14,0.6)] backdrop:backdrop-blur-[2px]"
            >
                <div className="flex items-start justify-between gap-4">
                    <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-[#ffdbd1] text-destructive"><Trash2 className="size-5" /></span>
                    <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Tutup dialog" className="flex size-10 items-center justify-center rounded-lg bg-[#e7efe8] text-primary hover:bg-[#d9e6db] focus-visible:outline-2 focus-visible:outline-ring">
                        <X aria-hidden="true" className="size-4" />
                    </button>
                </div>
                <h2 id={titleId} className="mt-4 font-heading text-2xl font-semibold">Hapus bookmark dan minat?</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {bookmarkCount} bookmark dan {interestCount} minat baca Anda akan dihapus. Rekomendasi kembali bersifat umum sampai Anda memilih minat lagi. Akun dan buku Anda tidak terpengaruh.
                </p>
                <FormAlert className="mt-3">{error}</FormAlert>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={() => dialogRef.current?.close()} autoFocus className="min-h-11 rounded-lg bg-[#e7efe8] px-5 text-sm font-semibold text-primary hover:bg-[#d9e6db]">Batal</button>
                    <button type="button" onClick={confirm} disabled={pending} className="flex min-h-11 items-center gap-2 rounded-lg bg-destructive px-5 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
                        <Trash2 aria-hidden="true" className="size-4" /> {pending ? "Menghapus..." : "Ya, Hapus"}
                    </button>
                </div>
            </dialog>
        </div>
    );
}
