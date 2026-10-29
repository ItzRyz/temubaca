"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { sendLoanRequest } from "@/features/borrowing/client";
import { notify } from "@/lib/toast";

/** Removes one book from a library's collection (manager or curated rows only, by endpoint). */
export function RemoveHoldingButton({ endpoint, bookId, bookTitle }: { endpoint: string; bookId: string; bookTitle: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState("");
    return (
        <span className="flex flex-col items-end gap-1">
            <button type="button" disabled={pending} aria-label={`Hapus ${bookTitle} dari koleksi`}
                onClick={() => startTransition(async () => {
                    const result = await sendLoanRequest(endpoint, "DELETE", { bookId });
                    if (!result.ok) return setError(result.message);
                    notify.success("Catatan koleksi dihapus.");
                    router.refresh();
                })}
                className="flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-60">
                <Trash2 aria-hidden="true" className="size-4" />
            </button>
            {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
        </span>
    );
}
