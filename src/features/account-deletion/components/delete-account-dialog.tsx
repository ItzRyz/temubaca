"use client";

import { AlertTriangle, Download, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { FormAlert, TextInput } from "@/components/ui/form";
import { sendCommunityRequest } from "@/features/community-management/client";

import { CONFIRM_WORD, DELETION_GRACE_DAYS } from "../rules";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });

/** Figma "Dialog: Hapus Akun" (210:1145) with the DEC-11 grace period and blockers. */
export function DeleteAccountDialog({ bookmarks, interests, listings, blockers, triggerClassName, graceDays = DELETION_GRACE_DAYS, allowExport = true }: {
    /** From Pengaturan → Retensi & Data (30 Okt 2026). */
    graceDays?: number;
    allowExport?: boolean;
    bookmarks: number;
    interests: number;
    listings: number;
    blockers: string[];
    triggerClassName?: string;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const inputId = useId();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const blocked = blockers.length > 0;
    const ready = !blocked && confirm.trim() === CONFIRM_WORD;

    function submit() {
        setError("");
        startTransition(async () => {
            const result = await sendCommunityRequest<{ scheduledFor: string }>("/api/me/account-deletion", "POST", { confirm: confirm.trim() });
            if (!result.ok) return setError(result.fieldErrors.confirm ?? result.message);
            dialogRef.current?.close();
            router.refresh();
        });
    }

    const close = () => dialogRef.current?.close();

    return (
        <>
            <button type="button" onClick={() => { setConfirm(""); setError(""); dialogRef.current?.showModal(); }}
                className={triggerClassName ?? "inline-flex min-h-11 items-center gap-2 rounded-lg border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-destructive/5"}>
                <Trash2 aria-hidden="true" className="size-4" /> Hapus akun dan data
            </button>
            <dialog ref={dialogRef} aria-labelledby={titleId}
                className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-[#fcfbf7] p-6 text-foreground shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(0,23,14,0.6)] backdrop:backdrop-blur-[2px]">
                <div className="flex items-start justify-between gap-4">
                    <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-[#ffdbd1] text-destructive"><AlertTriangle className="size-5" /></span>
                    <button type="button" onClick={close} aria-label="Tutup dialog" className="flex size-10 items-center justify-center rounded-lg bg-[#e7efe8] text-primary hover:bg-[#d9e6db]">
                        <X aria-hidden="true" className="size-4" />
                    </button>
                </div>
                <h2 id={titleId} className="mt-4 font-heading text-2xl font-semibold">Hapus akun dan data?</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Akun langsung dinonaktifkan dan dihapus permanen setelah {graceDays} hari. Selama itu Anda bisa membatalkannya dengan masuk lagi. Yang akan dihapus:
                </p>
                <ul className="mt-3 flex list-disc flex-col gap-1.5 rounded-xl border border-border bg-card py-3 pr-4 pl-8 text-sm">
                    <li>Profil dan data akun Anda</li>
                    <li>{bookmarks} bookmark dan {interests} minat baca</li>
                    <li>{listings > 0 ? `${listings} buku yang Anda daftarkan untuk dipinjamkan` : "Buku yang Anda daftarkan untuk dipinjamkan"}</li>
                </ul>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Riwayat pinjam dan laporan yang menyangkut orang lain tetap disimpan dengan nama &quot;Akun dihapus&quot;.</p>
                {allowExport && (
                    <a href="/api/me/export" download className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                        <Download aria-hidden="true" className="size-4" /> Unduh salinan data saya dulu
                    </a>
                )}

                {blocked ? (
                    <div role="alert" className="mt-4 rounded-xl bg-[#fbecc4] p-4 text-sm text-[#5c3d00]">
                        <p className="font-semibold">Akun belum dapat dihapus</p>
                        <ul className="mt-1 list-disc pl-5">{blockers.map((message) => <li key={message}>{message}</li>)}</ul>
                    </div>
                ) : (
                    <div className="mt-4 flex flex-col gap-1.5">
                        <label htmlFor={inputId} className="text-sm font-semibold">Ketik {CONFIRM_WORD} untuk melanjutkan</label>
                        <TextInput id={inputId} value={confirm} autoComplete="off" onChange={(event) => setConfirm(event.target.value)} placeholder="Ketik di sini" />
                    </div>
                )}
                <FormAlert className="mt-3">{error}</FormAlert>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={close} className="min-h-11 rounded-lg bg-[#e7efe8] px-5 text-sm font-semibold text-primary hover:bg-[#d9e6db]">Batal</button>
                    <button type="button" disabled={!ready || pending} onClick={submit} className="flex min-h-11 items-center gap-2 rounded-lg bg-destructive px-5 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-50">
                        <Trash2 aria-hidden="true" className="size-4" /> {pending ? "Memproses..." : "Hapus Akun Saya"}
                    </button>
                </div>
            </dialog>
        </>
    );
}

/** Shown on every signed-in page while the deletion is scheduled. */
export function DeletionPendingBanner({ scheduledFor }: { scheduledFor: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState("");
    return (
        <div role="alert" className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:px-8">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p>
                    <strong>Akunmu dijadwalkan dihapus pada {dateFormatter.format(new Date(scheduledFor))}.</strong> Sampai saat itu akunmu hanya bisa membaca dan listing bukumu tidak tampil.
                    {error ? ` ${error}` : ""}
                </p>
                <button type="button" disabled={pending} onClick={() => startTransition(async () => {
                    const result = await sendCommunityRequest("/api/me/account-deletion", "DELETE");
                    if (!result.ok) return setError(result.message);
                    router.refresh();
                })} className="min-h-10 shrink-0 rounded-lg border border-destructive bg-card px-4 text-sm font-semibold hover:bg-destructive/5 disabled:opacity-60">
                    {pending ? "Membatalkan..." : "Batalkan penghapusan"}
                </button>
            </div>
        </div>
    );
}
