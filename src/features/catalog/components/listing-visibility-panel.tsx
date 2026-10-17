"use client";

import { Eye, EyeOff, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/** Hide a listing from public pages with a recorded reason, or restore it (Figma "Tindakan Listing"). */
export function ListingVisibilityPanel({ listingId, bookId, hidden }: { listingId: string; bookId: string; hidden: boolean }) {
    const router = useRouter();
    const reasonId = useId();
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

    async function submit() {
        if (!hidden && reason.trim().length < 3) {
            setMessage({ tone: "error", text: "Alasan wajib diisi untuk menyembunyikan listing." });
            return;
        }
        setPending(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/admin/book-listings/${listingId}/visibility`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ hidden: !hidden, reason: reason.trim() || undefined }),
            });
            const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
            if (!response.ok) {
                setMessage({ tone: "error", text: payload?.error?.message ?? "Tindakan belum dapat disimpan." });
                return;
            }
            setReason("");
            setMessage({ tone: "ok", text: hidden ? "Listing ditampilkan kembali." : "Listing disembunyikan dari halaman publik." });
            router.refresh();
        } catch {
            setMessage({ tone: "error", text: "Koneksi terputus. Coba lagi." });
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex flex-col gap-3 bg-[#f1f0ea] p-5">
            <label htmlFor={reasonId} className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Tindakan listing</label>
            <textarea
                id={reasonId}
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={hidden ? "Catatan pemulihan (opsional)." : "Wajib diisi untuk menyembunyikan. Alasan tampil ke pemilik di Buku Saya."}
                className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            {message && (
                <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "rounded bg-destructive/10 px-3 py-2 text-sm text-destructive" : "text-sm text-primary"}>
                    {message.text}
                </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
                <Link href={`/books/${bookId}`} target="_blank" className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted">
                    Buka Buku <ExternalLink aria-hidden="true" className="size-4" /><span className="sr-only">(tab baru)</span>
                </Link>
                <button
                    type="button"
                    onClick={submit}
                    disabled={pending}
                    className={hidden
                        ? "flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        : "flex h-11 items-center justify-center gap-2 rounded-lg bg-destructive text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-60"}
                >
                    {hidden ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
                    {pending ? "Menyimpan…" : hidden ? "Tampilkan Kembali" : "Sembunyikan"}
                </button>
            </div>
            <p className="text-xs text-muted-foreground">Tindakan tercatat di jejak audit. Data buku dari provider tidak diubah manual.</p>
        </div>
    );
}
