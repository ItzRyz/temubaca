"use client";

import { Ban, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Field, FormAlert, TextArea } from "@/components/ui/form";
import { notify } from "@/lib/toast";

type Props = {
    userId: string;
    role: "MEMBER" | "ADMIN";
    suspended: boolean;
    isSelf: boolean;
};

/** Suspend/reinstate and change role (Figma "Tindakan Akun"); the server re-checks every rule. */
export function AccountActionPanel({ userId, role, suspended, isSelf }: Props) {
    const router = useRouter();
    const noteId = useId();
    const [note, setNote] = useState("");
    const [pending, setPending] = useState<"status" | "role" | null>(null);
    const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

    if (isSelf) {
        return (
            <div className="bg-[#f1f0ea] p-5 text-sm text-muted-foreground">
                Ini akunmu sendiri. Peran dan status akun admin hanya dapat diubah oleh admin lain.
            </div>
        );
    }

    async function send(kind: "status" | "role", body: object, success: string) {
        setPending(kind);
        setMessage(null);
        try {
            const response = await fetch(`/api/admin/users/${userId}/${kind}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
            if (!response.ok) {
                setMessage({ tone: "error", text: payload?.error?.message ?? "Tindakan belum dapat disimpan." });
                return;
            }
            setNote("");
            notify.success(success);
            router.refresh();
        } catch {
            setMessage({ tone: "error", text: "Koneksi terputus. Coba lagi." });
        } finally {
            setPending(null);
        }
    }

    function toggleSuspension() {
        if (!suspended && note.trim().length < 3) {
            setMessage({ tone: "error", text: "Alasan wajib diisi untuk menangguhkan akun." });
            return;
        }
        void send("status", { suspended: !suspended, reason: note.trim() || undefined }, suspended ? "Akun dipulihkan." : "Akun ditangguhkan.");
    }

    function toggleRole() {
        const next = role === "ADMIN" ? "MEMBER" : "ADMIN";
        const question = next === "ADMIN"
            ? "Jadikan akun ini admin? Admin dapat meninjau laporan, mengubah data, dan menangguhkan akun."
            : "Cabut peran admin dari akun ini?";
        if (!window.confirm(question)) return;
        void send("role", { role: next, note: note.trim() || undefined }, next === "ADMIN" ? "Akun kini admin." : "Peran admin dicabut.");
    }

    const suspendBlocked = !suspended && role === "ADMIN";

    return (
        <div className="flex flex-col gap-3 bg-[#f1f0ea] p-5">
            <Field id={noteId} label="Tindakan akun" labelClassName="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {(control) => (
                    <TextArea
                        {...control}
                        maxLength={500}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={suspended ? "Catatan pemulihan (opsional)." : "Wajib diisi untuk penangguhan. Alasan tampil ke pengguna di area akunnya."}
                    />
                )}
            </Field>
            <FormAlert tone={message?.tone === "error" ? "error" : "success"}>{message?.text}</FormAlert>
            <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={toggleRole} disabled={pending !== null}
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted disabled:opacity-60">
                    {role === "ADMIN" ? <ShieldOff aria-hidden="true" className="size-4" /> : <ShieldCheck aria-hidden="true" className="size-4" />}
                    {pending === "role" ? "Menyimpan…" : role === "ADMIN" ? "Cabut Admin" : "Jadikan Admin"}
                </button>
                <button type="button" onClick={toggleSuspension} disabled={pending !== null || suspendBlocked}
                    title={suspendBlocked ? "Cabut peran admin terlebih dahulu." : undefined}
                    className={suspended
                        ? "flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        : "flex h-11 items-center justify-center gap-2 rounded-lg bg-destructive text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-60"}>
                    {suspended ? <RotateCcw aria-hidden="true" className="size-4" /> : <Ban aria-hidden="true" className="size-4" />}
                    {pending === "status" ? "Menyimpan…" : suspended ? "Pulihkan Akun" : "Tangguhkan Akun"}
                </button>
            </div>
            {suspendBlocked && <p className="text-xs text-muted-foreground">Akun admin harus dicabut perannya sebelum dapat ditangguhkan.</p>}
            <p className="text-xs text-muted-foreground">
                Tindakan tercatat di jejak audit. Akun tertangguh tetap bisa masuk dan membaca, tetapi tidak dapat mengubah data, dan listingnya disembunyikan dari publik.
            </p>
        </div>
    );
}
