"use client";

import { Check, PackageCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert, TextArea } from "@/components/ui/form";
import { sendLoanRequest } from "@/features/borrowing/client";

import { ACCESS_NOTE_MAX, type AccessAction } from "../access";
import { notify } from "@/lib/toast";

const primary = "flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const outline = "flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60";
const danger = "flex min-h-10 items-center justify-center gap-2 rounded-lg border border-destructive bg-card px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60";

/** Buttons on one access request; the server re-checks each against `accessActionBlocker`. */
export function AccessActions({ accessId, actions }: { accessId: string; actions: AccessAction[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [rejecting, setRejecting] = useState(false);
    const [note, setNote] = useState("");

    function run(body: { action: AccessAction; note?: string }) {
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/book-accesses/${accessId}`, "PATCH", body);
            if (!result.ok) return setError(result.message);
            setRejecting(false);
            notify.success({ approve: "Pengajuan diterima.", reject: "Pengajuan ditolak.", collected: "Buku ditandai sudah diambil.", cancel: "Pengajuan dibatalkan." }[body.action]);
            router.refresh();
        });
    }

    if (actions.length === 0) return null;
    return (
        <div className="flex w-full flex-col gap-2 sm:w-56">
            {actions.includes("approve") && <button type="button" disabled={pending} onClick={() => run({ action: "approve" })} className={primary}><Check aria-hidden="true" className="size-4" /> Terima</button>}
            {actions.includes("collected") && <button type="button" disabled={pending} onClick={() => run({ action: "collected" })} className={primary}><PackageCheck aria-hidden="true" className="size-4" /> Sudah Diambil</button>}
            {actions.includes("reject") && (rejecting ? (
                <div role="group" aria-label="Alasan penolakan" className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-2">
                    <TextArea aria-label="Alasan penolakan" value={note} maxLength={ACCESS_NOTE_MAX} onChange={(event) => setNote(event.target.value)} placeholder="Mis. buku sedang diperbaiki." />
                    <div className="flex gap-2">
                        <button type="button" disabled={pending || note.trim().length < 5} onClick={() => run({ action: "reject", note })} className="min-h-9 flex-1 rounded-md bg-destructive px-2 text-sm font-semibold text-white disabled:opacity-60">Tolak</button>
                        <button type="button" onClick={() => setRejecting(false)} className="min-h-9 flex-1 rounded-md border border-border px-2 text-sm font-semibold">Batal</button>
                    </div>
                </div>
            ) : (
                <button type="button" disabled={pending} onClick={() => setRejecting(true)} className={danger}><X aria-hidden="true" className="size-4" /> Tolak</button>
            ))}
            {actions.includes("cancel") && <button type="button" disabled={pending} onClick={() => run({ action: "cancel" })} className={outline}><X aria-hidden="true" className="size-4" /> Batalkan Pengajuan</button>}
            <FormAlert>{error}</FormAlert>
        </div>
    );
}
