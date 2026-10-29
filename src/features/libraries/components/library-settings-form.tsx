"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

import { Field, FormAlert, Switch, TextArea, TextInput } from "@/components/ui/form";
import { sendLoanRequest } from "@/features/borrowing/client";
import { notify } from "@/lib/toast";

/** A library's manager decides whether readers can ask through TemuBaca, the rules, and the pick-up window. */
export function LibrarySettingsForm({ libraryId, initial }: { libraryId: string; initial: { accessEnabled: boolean; accessRules: string | null; pickupDays: number } }) {
    const router = useRouter();
    const switchId = useId();
    const [pending, startTransition] = useTransition();
    const [accessEnabled, setAccessEnabled] = useState(initial.accessEnabled);
    const [accessRules, setAccessRules] = useState(initial.accessRules ?? "");
    const [pickupDays, setPickupDays] = useState(String(initial.pickupDays));
    const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

    function submit(event: FormEvent) {
        event.preventDefault();
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/libraries/${libraryId}`, "PATCH", { accessEnabled, accessRules, pickupDays: Number(pickupDays) });
            if (result.ok) notify.success("Pengaturan disimpan.");
            setMessage(result.ok ? null : { tone: "error", text: result.message });
            if (result.ok) router.refresh();
        });
    }

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                <div>
                    <p id={switchId} className="text-sm font-semibold">Terima pengajuan lewat TemuBaca</p>
                    <p className="text-xs text-muted-foreground">Bila mati, pembaca hanya melihat bahwa buku tercatat di koleksi.</p>
                </div>
                <Switch checked={accessEnabled} onCheckedChange={setAccessEnabled} aria-labelledby={switchId} />
            </div>
            <Field label={<>Aturan akses <span className="font-normal text-muted-foreground">(opsional)</span></>} hint="Ditampilkan sebelum pembaca mengajukan, mis. bawa kartu anggota, baca di tempat saja.">
                {(control) => <TextArea {...control} value={accessRules} maxLength={500} onChange={(event) => setAccessRules(event.target.value)} />}
            </Field>
            <Field label="Batas ambil (hari)" hint="Setelah diterima, pengajuan lewat batas ini tampil sebagai kedaluwarsa.">
                {(control) => <TextInput {...control} inputMode="numeric" value={pickupDays} onChange={(event) => setPickupDays(event.target.value.replace(/\D/g, ""))} className="sm:w-32" />}
            </Field>
            <FormAlert tone={message?.tone}>{message?.text}</FormAlert>
            <button type="submit" disabled={pending} className="min-h-11 self-end rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {pending ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
        </form>
    );
}
