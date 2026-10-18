"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/ui/form";
import { sendCommunityRequest } from "@/features/community-management/client";

/** "Jalankan sekarang" for the DEC-11 retention job; the result is saved and audited server-side. */
export function RunRetentionButton() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [confirming, setConfirming] = useState(false);
    const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

    return (
        <div className="flex flex-col gap-3">
            {confirming ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
                    <span className="font-semibold text-destructive">Data yang lewat batas akan dihapus permanen. Lanjutkan?</span>
                    <button type="button" disabled={pending} onClick={() => startTransition(async () => {
                        const result = await sendCommunityRequest<{ accountsDeleted: number; reportDetails: number; auditEntries: number; loans: number; evidence: number }>("/api/admin/retention", "POST");
                        setConfirming(false);
                        if (!result.ok) return setMessage({ tone: "error", text: result.message });
                        const r = result.data;
                        setMessage({ tone: "success", text: `Selesai: ${r.accountsDeleted} akun dihapus, ${r.reportDetails} detail laporan, ${r.auditEntries} catatan audit, ${r.loans} riwayat pinjam, ${r.evidence} bukti komunitas.` });
                        router.refresh();
                    })} className="min-h-10 rounded-lg bg-destructive px-4 font-semibold text-white disabled:opacity-60">{pending ? "Menjalankan..." : "Ya, jalankan"}</button>
                    <button type="button" onClick={() => setConfirming(false)} className="min-h-10 rounded-lg border border-border px-4 font-semibold">Batal</button>
                </div>
            ) : (
                <button type="button" onClick={() => { setMessage(null); setConfirming(true); }} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <Play aria-hidden="true" className="size-4" /> Jalankan sekarang
                </button>
            )}
            <FormAlert tone={message?.tone ?? "success"}>{message?.text}</FormAlert>
        </div>
    );
}
