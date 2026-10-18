"use client";

import { Bell, Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/ui/form";

import { sendLoanRequest } from "../client";
import type { LoanAction, LoanRole } from "../lifecycle";
import { RejectExtensionDialog, RequestExtensionDialog } from "./extension-dialogs";
import { RejectRequestDialog } from "./reject-request-dialog";
import { ReportProblemDialog } from "./report-problem-dialog";

const primary = "flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const outline = "flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60";
const danger = "flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-destructive bg-card px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60";

/** Buttons for one loan card; the server re-checks every action against the DEC-02 rules. */
export function LoanActions({ role, requestId, borrowingId, actions, bookTitle, otherName, summary, hint, dueAt = null, extensionDays = null }: {
    role: LoanRole;
    requestId: string;
    borrowingId: string | null;
    actions: LoanAction[];
    bookTitle: string;
    otherName: string;
    summary: string;
    hint?: string;
    dueAt?: Date | null;
    extensionDays?: number | null;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [confirmingCancel, setConfirmingCancel] = useState(false);

    function run(action: LoanAction) {
        setError("");
        const onBorrowing = action === "confirm_return" || action === "remind" || action === "approve_extension";
        startTransition(async () => {
            const result = await sendLoanRequest(
                onBorrowing ? `/api/borrowings/${borrowingId}` : `/api/borrow-requests/${requestId}`,
                "PATCH",
                { action },
            );
            if (!result.ok) return setError(result.message);
            setConfirmingCancel(false);
            router.refresh();
        });
    }

    const can = (action: LoanAction) => actions.includes(action);
    if (actions.length === 0 && !hint) return null;

    return (
        <div className="flex w-full flex-col gap-2 lg:w-56">
            {can("approve_extension") && (
                <button type="button" disabled={pending} onClick={() => run("approve_extension")} className={primary}>
                    <Check aria-hidden="true" className="size-4" /> Terima Perpanjangan
                </button>
            )}
            {can("reject_extension") && borrowingId && (
                <RejectExtensionDialog borrowingId={borrowingId} bookTitle={bookTitle} days={extensionDays} triggerClassName={danger} />
            )}
            {can("approve") && (
                <button type="button" disabled={pending} onClick={() => run("approve")} className={primary}>
                    <Check aria-hidden="true" className="size-4" /> Terima Permintaan
                </button>
            )}
            {can("reject") && <RejectRequestDialog requestId={requestId} bookTitle={bookTitle} requesterName={otherName} summary={summary} triggerClassName={danger} />}
            {can("confirm_handover") && (
                <button type="button" disabled={pending} onClick={() => run("confirm_handover")} className={primary}>
                    <Check aria-hidden="true" className="size-4" /> Konfirmasi Serah Terima
                </button>
            )}
            {can("confirm_return") && (
                <button type="button" disabled={pending} onClick={() => run("confirm_return")} className={role === "owner" ? outline : primary}>
                    <RotateCcw aria-hidden="true" className="size-4" /> {role === "owner" ? "Konfirmasi Pengembalian" : "Kembalikan Buku"}
                </button>
            )}
            {can("remind") && (
                <button type="button" disabled={pending} onClick={() => run("remind")} className={primary}>
                    <Bell aria-hidden="true" className="size-4" /> Kirim Pengingat
                </button>
            )}
            {can("request_extension") && borrowingId && (
                <RequestExtensionDialog borrowingId={borrowingId} bookTitle={bookTitle} summary={summary} dueAt={dueAt} triggerClassName={outline} />
            )}
            {can("report_problem") && borrowingId && (
                <ReportProblemDialog borrowingId={borrowingId} bookTitle={bookTitle} summary={summary} triggerClassName={outline} />
            )}
            {can("cancel") && (confirmingCancel ? (
                <div role="group" aria-label="Konfirmasi pembatalan" className="rounded-lg border border-destructive/40 p-2 text-xs">
                    <p className="font-semibold text-destructive">Batalkan pinjaman ini?</p>
                    <div className="mt-2 flex gap-2">
                        <button type="button" disabled={pending} onClick={() => run("cancel")} className="min-h-9 flex-1 rounded-md bg-destructive px-2 font-semibold text-white disabled:opacity-60">Ya, batalkan</button>
                        <button type="button" onClick={() => setConfirmingCancel(false)} className="min-h-9 flex-1 rounded-md border border-border px-2 font-semibold">Tidak</button>
                    </div>
                </div>
            ) : (
                <button type="button" disabled={pending} onClick={() => setConfirmingCancel(true)} className={danger}>
                    <X aria-hidden="true" className="size-4" /> {role === "requester" && !can("confirm_handover") ? "Batalkan Permintaan" : "Batalkan"}
                </button>
            ))}
            {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
            <FormAlert>{error}</FormAlert>
        </div>
    );
}
