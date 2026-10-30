"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { FormAlert, TextArea } from "@/components/ui/form";
import { sendCommunityRequest } from "@/features/community-management/client";
import { notify } from "@/lib/toast";

/** Approve or refuse one waiting event or merchandise item; a refusal needs a reason the managers will see. */
export function ContentDecisionPanel({ type, id, title }: { type: "event" | "merchandise"; id: string; title: string }) {
    const router = useRouter();
    const noteId = useId();
    const [pending, startTransition] = useTransition();
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    const decide = (decision: "APPROVE" | "REJECT") => startTransition(async () => {
        setError("");
        if (decision === "REJECT" && note.trim().length < 5) return setError("Tulis alasan penolakan minimal 5 karakter.");
        const result = await sendCommunityRequest(`/api/admin/community-content/${type}/${id}`, "PATCH", decision === "APPROVE" ? { decision } : { decision, note });
        if (!result.ok) return setError(result.message);
        notify.success(decision === "APPROVE" ? `“${title}” disetujui dan tayang.` : `“${title}” dikembalikan ke draf.`);
        router.refresh();
    });

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={noteId} className="text-xs font-semibold">Alasan bila ditolak</label>
            <TextArea id={noteId} value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Mis. lokasi tidak jelas, foto tidak sesuai." />
            <FormAlert>{error}</FormAlert>
            <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => decide("APPROVE")} className="flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                    <Check aria-hidden="true" className="size-4" /> Setujui
                </button>
                <button type="button" disabled={pending} onClick={() => decide("REJECT")} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60">
                    <X aria-hidden="true" className="size-4" /> Tolak
                </button>
            </div>
        </div>
    );
}
