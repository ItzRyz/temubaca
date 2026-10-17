"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

type SyncResponse = {
    success?: boolean;
    data?: { status: "SUCCESS" | "FAILED"; changedFields: string[]; message: string | null };
    error?: { message?: string };
};

const fieldLabels: Record<string, string> = {
    isbn: "ISBN", title: "judul", authors: "penulis", description: "sinopsis", publisher: "penerbit",
    publishedAt: "tahun", language: "bahasa", categories: "kategori", coverUrl: "sampul",
};

/** Re-fetch one record from its provider; the server logs every attempt. */
export function CatalogSyncButton({ bookId, label = "Sinkronkan Ulang", variant = "primary" }: {
    bookId: string;
    label?: string;
    variant?: "primary" | "outline";
}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

    async function sync() {
        setPending(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/admin/books/${bookId}/sync`, { method: "POST" });
            const payload = await response.json().catch(() => null) as SyncResponse | null;
            if (!response.ok || !payload?.data) {
                setMessage({ tone: "error", text: response.status === 429 ? "Terlalu banyak sinkronisasi. Tunggu sebentar." : payload?.error?.message ?? "Sinkronisasi gagal dijalankan." });
                return;
            }
            const { status, changedFields, message: note } = payload.data;
            if (status === "FAILED") {
                setMessage({ tone: "error", text: note ?? "Sinkronisasi gagal." });
            } else {
                const changed = changedFields.length ? `Diperbarui: ${changedFields.map((field) => fieldLabels[field] ?? field).join(", ")}.` : "Tidak ada perubahan data.";
                setMessage({ tone: "ok", text: note ? `${changed} ${note}` : changed });
            }
            router.refresh();
        } catch {
            setMessage({ tone: "error", text: "Koneksi terputus. Coba lagi." });
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                onClick={sync}
                disabled={pending}
                className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60",
                    variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-card hover:bg-muted",
                )}
            >
                <RefreshCw aria-hidden="true" className={cn("size-4", pending && "animate-spin")} />
                {pending ? "Menyinkronkan…" : label}
            </button>
            {message && (
                <p role={message.tone === "error" ? "alert" : "status"} className={cn("text-xs leading-5", message.tone === "error" ? "text-destructive" : "text-primary")}>
                    {message.text}
                </p>
            )}
        </div>
    );
}
