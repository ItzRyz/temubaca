"use client";

import { AtSign, Link2, Mail, MapPin, Phone, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Field, FormAlert, TextArea, TextInput } from "@/components/ui/form";
import { communityApplicationSchema, communityProfileSchema, verificationSubmissionSchema } from "@/lib/validation/schemas/community-management.schema";

import { fieldErrorsOf, sendCommunityRequest, type FieldErrors } from "../client";
import { CountedLabel, ErrorSummary, EvidenceFilePicker, FormSection } from "./form-parts";

export type ProfileValues = {
    name: string;
    description: string;
    publicLocation: string;
    contactEmail: string;
    instagramHandle: string;
    whatsappNumber: string;
};

const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-semibold hover:bg-muted";

function IconInput({ icon, ...props }: { icon: ReactNode } & React.ComponentProps<typeof TextInput>) {
    return (
        <span className="relative block">
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">{icon}</span>
            <TextInput {...props} className="pl-9" />
        </span>
    );
}

function ProfileFields({ values, set, errors }: { values: ProfileValues; set: (key: keyof ProfileValues, value: string) => void; errors: FieldErrors }) {
    return (
        <>
            <Field label={<CountedLabel label="Nama Komunitas" length={values.name.length} max={50} />} required error={errors.name}>
                {(control) => <TextInput {...control} value={values.name} maxLength={50} onChange={(event) => set("name", event.target.value)} placeholder="mis. Klub Buku Menteng" />}
            </Field>
            <Field label={<CountedLabel label="Deskripsi" length={values.description.length} max={1000} />} required error={errors.description}>
                {(control) => <TextArea {...control} rows={4} value={values.description} maxLength={1000} onChange={(event) => set("description", event.target.value)} placeholder="Siapa kalian, seberapa sering berkumpul, dan siapa yang boleh ikut." />}
            </Field>
            <Field label="Wilayah dan Titik Pertemuan Publik" required error={errors.publicLocation} hint="Gunakan nama ruang publik, bukan alamat rumah. Pilih tempat yang mudah dijangkau transportasi umum.">
                {(control) => <IconInput {...control} icon={<MapPin className="size-4" />} value={values.publicLocation} maxLength={120} onChange={(event) => set("publicLocation", event.target.value)} placeholder="mis. Jakarta Pusat — Gazebo Taman Suropati" />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Surel Kontak Publik" required error={errors.contactEmail}>
                    {(control) => <IconInput {...control} icon={<Mail className="size-4" />} type="email" value={values.contactEmail} maxLength={254} onChange={(event) => set("contactEmail", event.target.value)} placeholder="halo@komunitas.org" />}
                </Field>
                <Field label={<CountedLabel label="Instagram" optional />} error={errors.instagramHandle}>
                    {(control) => <IconInput {...control} icon={<AtSign className="size-4" />} value={values.instagramHandle} maxLength={60} onChange={(event) => set("instagramHandle", event.target.value)} placeholder="namakomunitas" />}
                </Field>
            </div>
            <Field label={<CountedLabel label="Nomor WhatsApp" optional />} error={errors.whatsappNumber} hint="Tampil di halaman publik komunitas dan di halaman merchandise.">
                {(control) => <IconInput {...control} icon={<Phone className="size-4" />} type="tel" value={values.whatsappNumber} maxLength={20} onChange={(event) => set("whatsappNumber", event.target.value)} placeholder="0812 3456 7890" />}
            </Field>
        </>
    );
}

function EvidenceFields({ evidenceUrl, note, file, setEvidenceUrl, setNote, setFile, errors, setFileError }: {
    evidenceUrl: string; note: string; file: File | null;
    setEvidenceUrl: (value: string) => void; setNote: (value: string) => void; setFile: (file: File | null) => void;
    errors: FieldErrors; setFileError: (message: string | null) => void;
}) {
    return (
        <>
            <Field label="Tautan Bukti Aktivitas" required error={errors.evidenceUrl} hint="Tautan dokumentasi kegiatan komunitas, misalnya Instagram, arsip foto, atau situs.">
                {(control) => <IconInput {...control} icon={<Link2 className="size-4" />} type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://instagram.com/namakomunitas" />}
            </Field>
            <EvidenceFilePicker file={file} onChange={setFile} error={errors.file} onError={setFileError} />
            <Field label={<CountedLabel label="Catatan untuk Peninjau" optional length={note.length} max={500} />} error={errors.note}>
                {(control) => <TextArea {...control} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="mis. Kami rutin bertemu tiap Minggu pagi di Gazebo Suropati." />}
            </Field>
        </>
    );
}

function useProfile(initial: ProfileValues) {
    const [values, setValues] = useState(initial);
    return {
        values,
        set: (key: keyof ProfileValues, value: string) => setValues((current) => ({ ...current, [key]: value })),
        replace: setValues,
    };
}

function toFormData(fields: Record<string, string>, file: File | null) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    if (file) form.set("file", file);
    return form;
}

const emptyProfile: ProfileValues = { name: "", description: "", publicLocation: "", contactEmail: "", instagramHandle: "", whatsappNumber: "" };

/** "Ajukan Komunitas": profile + evidence; reviewed by an admin before the profile goes public (DEC-04). */
export function ApplyCommunityForm() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const { values, set } = useProfile(emptyProfile);
    const [evidenceUrl, setEvidenceUrl] = useState("");
    const [note, setNote] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [message, setMessage] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        const fields = { ...values, evidenceUrl, note };
        const parsed = communityApplicationSchema.safeParse(fields);
        if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
        setErrors({});
        setMessage("");
        startTransition(async () => {
            const result = await sendCommunityRequest<{ id: string }>("/api/communities", "POST", toFormData(fields, file));
            if (!result.ok) {
                setErrors(result.fieldErrors);
                setMessage(result.message);
                return;
            }
            router.push(`/communities/${result.data.id}/manage?baru=1`);
        });
    }

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <ErrorSummary errors={errors} message={message} />
            <FormSection title="Profil Komunitas" description="Informasi ini tampil di halaman profil komunitas setelah disetujui.">
                <ProfileFields values={values} set={set} errors={errors} />
            </FormSection>
            <FormSection title="Bukti Aktivitas" description="Tim TemuBaca meninjau bukti ini sebelum komunitas tampil untuk umum. Verifikasi bukan jaminan atas seluruh kegiatan komunitas.">
                <EvidenceFields evidenceUrl={evidenceUrl} note={note} file={file} setEvidenceUrl={setEvidenceUrl} setNote={setNote} setFile={setFile} errors={errors}
                    setFileError={(problem) => setErrors((current) => { const next = { ...current }; if (problem) next.file = problem; else delete next.file; return next; })} />
            </FormSection>
            <div className="flex justify-end gap-3">
                <button type="button" onClick={() => router.back()} className={secondaryButton}>Batal</button>
                <button type="submit" disabled={pending} className={primaryButton}><Send aria-hidden="true" className="size-4" /> {pending ? "Mengirim..." : "Kirim untuk Ditinjau"}</button>
            </div>
        </form>
    );
}

/** Figma 25:5622 "Profil Komunitas" card (owner only). */
export function CommunityProfileForm({ communityId, initial }: { communityId: string; initial: ProfileValues }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const { values, set, replace } = useProfile(initial);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

    function reset() {
        replace(initial);
        setErrors({});
        setMessage(null);
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        const parsed = communityProfileSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
        setErrors({});
        startTransition(async () => {
            const result = await sendCommunityRequest(`/api/communities/${communityId}`, "PATCH", values);
            if (!result.ok) {
                setErrors(result.fieldErrors);
                setMessage({ tone: "error", text: result.message });
                return;
            }
            setMessage({ tone: "success", text: "Profil komunitas tersimpan." });
            router.refresh();
        });
    }

    return (
        <form onSubmit={submit} noValidate>
            <FormSection title="Profil Komunitas" description="Informasi ini tampil di halaman profil komunitas yang bisa dilihat pembaca.">
                <ErrorSummary errors={errors} />
                <ProfileFields values={values} set={set} errors={errors} />
                <FormAlert tone={message?.tone ?? "success"}>{message?.text}</FormAlert>
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={reset} className={secondaryButton}>Batal</button>
                    <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Menyimpan..." : "Simpan Perubahan"}</button>
                </div>
            </FormSection>
        </form>
    );
}

/** "Ajukan Pembaruan Verifikasi" (verified) or "Ajukan Ulang" (rejected). */
export function VerificationRequestForm({ communityId, mode }: { communityId: string; mode: "renew" | "retry" }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [evidenceUrl, setEvidenceUrl] = useState("");
    const [note, setNote] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

    function submit(event: FormEvent) {
        event.preventDefault();
        const fields = { evidenceUrl, note };
        const parsed = verificationSubmissionSchema.safeParse(fields);
        if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
        setErrors({});
        startTransition(async () => {
            const result = await sendCommunityRequest(`/api/communities/${communityId}/submissions`, "POST", toFormData(fields, file));
            if (!result.ok) {
                setErrors(result.fieldErrors);
                setMessage({ tone: "error", text: result.message });
                return;
            }
            setEvidenceUrl("");
            setNote("");
            setFile(null);
            setMessage({ tone: "success", text: mode === "renew" ? "Pengajuan terkirim. Status verifikasi tidak berubah selama ditinjau." : "Pengajuan ulang terkirim dan menunggu ditinjau." });
            router.refresh();
        });
    }

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5 border-t border-border pt-5">
            <h3 className="font-heading text-base font-semibold">{mode === "renew" ? "Ajukan Pembaruan Verifikasi" : "Ajukan Ulang Verifikasi"}</h3>
            <EvidenceFields evidenceUrl={evidenceUrl} note={note} file={file} setEvidenceUrl={setEvidenceUrl} setNote={setNote} setFile={setFile} errors={errors}
                setFileError={(problem) => setErrors((current) => { const next = { ...current }; if (problem) next.file = problem; else delete next.file; return next; })} />
            <FormAlert tone={message?.tone ?? "success"}>{message?.text}</FormAlert>
            <button type="submit" disabled={pending} className={`${primaryButton} self-end`}>{pending ? "Mengirim..." : "Kirim untuk Ditinjau"}</button>
        </form>
    );
}
