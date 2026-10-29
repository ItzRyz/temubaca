"use client";

import { Check, Copy, Crown, Link2, UserMinus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/ui/form";

import { sendCommunityRequest } from "../client";
import { INVITE_TTL_DAYS } from "../rules";
import { notify } from "@/lib/toast";

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Pengurus: invite managers with one-time links, revoke links, remove managers (owner only). */
export function TeamPanel({ communityId, managers, invites }: {
    communityId: string;
    managers: { userId: string; displayName: string }[];
    invites: { id: string; expiresAt: string }[];
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [link, setLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [confirmTransfer, setConfirmTransfer] = useState<string | null>(null);
    const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

    function act(run: () => Promise<{ ok: boolean; message?: string }>, success?: string) {
        setMessage(null);
        startTransition(async () => {
            const result = await run();
            if (!result.ok) return setMessage({ tone: "error", text: result.message ?? "Tindakan gagal." });
            if (success) notify.success(success);
            setConfirmRemove(null);
            router.refresh();
        });
    }

    function createInvite() {
        setCopied(false);
        act(async () => {
            const result = await sendCommunityRequest<{ path: string }>(`/api/communities/${communityId}/invites`, "POST");
            if (!result.ok) return { ok: false, message: result.message };
            setLink(`${window.location.origin}${result.data.path}`);
            return { ok: true };
        }, "Tautan undangan dibuat.");
    }

    const simple = async (url: string) => {
        const result = await sendCommunityRequest(url, "DELETE");
        return result.ok ? { ok: true } : { ok: false, message: result.message };
    };

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h3 className="text-sm font-semibold">Pengurus ({managers.length})</h3>
                {managers.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Belum ada pengurus. Pengurus dapat mengelola acara dan merchandise, tetapi tidak dapat mengubah profil atau pengurus lain.</p>
                ) : (
                    <ul className="mt-2 flex list-none flex-col divide-y divide-border rounded-xl border border-border p-0">
                        {managers.map((manager) => (
                            <li key={manager.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                                <span className="font-medium">{manager.displayName}</span>
                                {confirmTransfer === manager.userId ? (
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs">Jadikan {manager.displayName} pemilik? Anda menjadi pengurus.</span>
                                        <button type="button" disabled={pending} onClick={() => act(async () => {
                                            const result = await sendCommunityRequest(`/api/communities/${communityId}/owner`, "POST", { userId: manager.userId });
                                            if (result.ok) router.push(`/communities/${communityId}/manage/events`);
                                            return result.ok ? { ok: true } : { ok: false, message: result.message };
                                        }, `Kepemilikan diserahkan ke ${manager.displayName}.`)} className="min-h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">Ya, serahkan</button>
                                        <button type="button" onClick={() => setConfirmTransfer(null)} className="min-h-9 rounded-md border border-border px-3 text-xs font-semibold">Batal</button>
                                    </span>
                                ) : confirmRemove === manager.userId ? (
                                    <span className="flex items-center gap-2">
                                        <span className="text-xs text-destructive">Cabut akses pengurus?</span>
                                        <button type="button" disabled={pending} onClick={() => act(() => simple(`/api/communities/${communityId}/managers/${manager.userId}`), `${manager.displayName} tidak lagi menjadi pengurus.`)}
                                            className="min-h-9 rounded-md bg-destructive px-3 text-xs font-semibold text-white disabled:opacity-60">Ya, cabut</button>
                                        <button type="button" onClick={() => setConfirmRemove(null)} className="min-h-9 rounded-md border border-border px-3 text-xs font-semibold">Batal</button>
                                    </span>
                                ) : (
                                    <span className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => { setConfirmRemove(null); setConfirmTransfer(manager.userId); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold hover:bg-muted">
                                            <Crown aria-hidden="true" className="size-3.5" /> Jadikan pemilik
                                        </button>
                                        <button type="button" onClick={() => { setConfirmTransfer(null); setConfirmRemove(manager.userId); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/5">
                                            <UserMinus aria-hidden="true" className="size-3.5" /> Cabut
                                        </button>
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="rounded-xl bg-[#f1efe6] p-4">
                <h3 className="text-sm font-semibold">Undang pengurus</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Tautan berlaku {INVITE_TTL_DAYS} hari dan hanya bisa dipakai satu akun. Bagikan lewat pesan pribadi, bukan di tempat umum.
                </p>
                <button type="button" disabled={pending} onClick={createInvite} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                    <Link2 aria-hidden="true" className="size-4" /> Buat Tautan Undangan
                </button>
                {link && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input readOnly value={link} aria-label="Tautan undangan" onFocus={(event) => event.target.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-xs" />
                        <button type="button" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => undefined); setCopied(true); }}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">
                            {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />} {copied ? "Tersalin" : "Salin"}
                        </button>
                    </div>
                )}
                {link && <p className="mt-2 text-xs text-muted-foreground">Tautan ini hanya ditampilkan sekali. Buat tautan baru bila hilang.</p>}
            </div>

            {invites.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold">Undangan aktif ({invites.length})</h3>
                    <ul className="mt-2 flex list-none flex-col divide-y divide-border rounded-xl border border-border p-0">
                        {invites.map((invite) => (
                            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                                <span className="text-muted-foreground">Berlaku sampai {dateTime.format(new Date(invite.expiresAt))}</span>
                                <button type="button" disabled={pending} onClick={() => act(() => simple(`/api/communities/${communityId}/invites/${invite.id}`), "Undangan dicabut.")}
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-60">
                                    <X aria-hidden="true" className="size-3.5" /> Cabut tautan
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <FormAlert tone={message?.tone ?? "success"}>{message?.text}</FormAlert>
        </div>
    );
}

export function AcceptInviteButton({ token }: { token: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState("");
    return (
        <div className="flex flex-col gap-3">
            <button type="button" disabled={pending} onClick={() => startTransition(async () => {
                const result = await sendCommunityRequest<{ communityId: string }>("/api/community-invites/accept", "POST", { token });
                if (!result.ok) return setError(result.message);
                notify.success("Undangan diterima. Kamu sekarang pengurus komunitas ini.");
                router.push(`/communities/${result.data.communityId}/manage/events`);
            })} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {pending ? "Memproses..." : "Terima Undangan"}
            </button>
            <FormAlert>{error}</FormAlert>
        </div>
    );
}

/** Admin: confirm or dismiss a re-verification request; the community stays VERIFIED either way. */
export function ReverificationReview({ submissionId }: { submissionId: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    const decide = (decision: "CONFIRM" | "DISMISS") => startTransition(async () => {
        setError("");
        const result = await sendCommunityRequest(`/api/admin/community-submissions/${submissionId}`, "PATCH", { decision, note });
        if (!result.ok) return setError(result.fieldErrors.note ?? result.message);
        notify.success(decision === "CONFIRM" ? "Verifikasi ulang dikonfirmasi." : "Pengajuan verifikasi ulang ditutup.");
        router.refresh();
    });
    return (
        <div className="mt-3 flex flex-col gap-2">
            <label className="text-xs font-semibold" htmlFor={`note-${submissionId}`}>Catatan peninjau <span className="font-normal text-muted-foreground">(wajib bila diabaikan)</span></label>
            <textarea id={`note-${submissionId}`} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} rows={2} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => decide("CONFIRM")} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">Konfirmasi</button>
                <button type="button" disabled={pending} onClick={() => decide("DISMISS")} className="min-h-10 rounded-lg border border-border bg-card px-4 text-sm font-semibold disabled:opacity-60">Abaikan</button>
            </div>
            <FormAlert>{error}</FormAlert>
        </div>
    );
}
