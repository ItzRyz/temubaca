"use client";

import { ArrowLeft, Calendar, Clock, Link2, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, TextArea, TextInput } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { communityEventSchema } from "@/lib/validation/schemas/community-management.schema";

import { fieldErrorsOf, sendCommunityRequest, type FieldErrors } from "../client";
import { CountedLabel, ErrorSummary, FormSection } from "./form-parts";

export type EventValues = {
    title: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    locationType: "PHYSICAL" | "ONLINE";
    venueName: string;
    publicLocation: string;
    eventUrl: string;
    publicationStatus: "DRAFT" | "PUBLISHED";
};

export const emptyEvent: EventValues = { title: "", description: "", date: "", startTime: "", endTime: "", locationType: "PHYSICAL", venueName: "", publicLocation: "", eventUrl: "", publicationStatus: "DRAFT" };

/** Figma "Kelola Komunitas - Buat Acara" (293:2789); also used to edit and to finish drafts. */
export function EventForm({ communityId, eventId, initial }: { communityId: string; eventId?: string; initial: EventValues }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [values, setValues] = useState(initial);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [message, setMessage] = useState("");
    const set = <K extends keyof EventValues>(key: K, value: EventValues[K]) => setValues((current) => ({ ...current, [key]: value }));
    const listHref = `/communities/${communityId}/manage/events`;

    function submit(event: FormEvent) {
        event.preventDefault();
        const parsed = communityEventSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
        setErrors({});
        setMessage("");
        startTransition(async () => {
            const result = eventId
                ? await sendCommunityRequest(`/api/communities/${communityId}/events/${eventId}`, "PUT", values)
                : await sendCommunityRequest(`/api/communities/${communityId}/events`, "POST", values);
            if (!result.ok) {
                setErrors(result.fieldErrors);
                setMessage(result.message);
                return;
            }
            router.push(listHref);
            router.refresh();
        });
    }

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Link href={listHref} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                <ArrowLeft aria-hidden="true" className="size-4" /> Kembali ke daftar acara
            </Link>
            <ErrorSummary errors={errors} message={message} />
            <FormSection title={eventId ? "Ubah Acara" : "Buat Acara"} description="Acara berstatus Terbit tampil di halaman komunitas dan agenda publik.">
                <Field label={<CountedLabel label="Judul Acara" length={values.title.length} max={100} />} required error={errors.title}>
                    {(control) => <TextInput {...control} value={values.title} maxLength={100} onChange={(event) => set("title", event.target.value)} placeholder="Contoh: Lingkar Baca Akhir Pekan #15" />}
                </Field>
                <Field label={<CountedLabel label="Deskripsi" length={values.description.length} max={1000} />} required error={errors.description}>
                    {(control) => <TextArea {...control} rows={4} value={values.description} maxLength={1000} onChange={(event) => set("description", event.target.value)} placeholder="Ceritakan tentang acara ini: tema, siapa yang boleh hadir, dan apa yang perlu dibawa." />}
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Tanggal" required error={errors.date}>
                        {(control) => <IconWrap icon={<Calendar className="size-4" />}><TextInput {...control} type="date" value={values.date} onChange={(event) => set("date", event.target.value)} className="pl-9" /></IconWrap>}
                    </Field>
                    <Field label="Jam Mulai" required error={errors.startTime}>
                        {(control) => <IconWrap icon={<Clock className="size-4" />}><TextInput {...control} type="time" value={values.startTime} onChange={(event) => set("startTime", event.target.value)} className="pl-9" /></IconWrap>}
                    </Field>
                    <Field label="Jam Selesai" required error={errors.endTime}>
                        {(control) => <IconWrap icon={<Clock className="size-4" />}><TextInput {...control} type="time" value={values.endTime} onChange={(event) => set("endTime", event.target.value)} className="pl-9" /></IconWrap>}
                    </Field>
                </div>
                <p className="-mt-3 text-xs text-muted-foreground">Waktu ditampilkan dalam WIB. Draf boleh disimpan tanpa jadwal.</p>

                <fieldset className="flex flex-col gap-3">
                    <legend className="text-sm font-medium">Lokasi Acara</legend>
                    <div role="radiogroup" aria-label="Jenis lokasi" className="flex gap-2">
                        {([["PHYSICAL", "Lokasi fisik"], ["ONLINE", "Tautan daring"]] as const).map(([value, label]) => (
                            <button key={value} type="button" role="radio" aria-checked={values.locationType === value} onClick={() => set("locationType", value)}
                                className={cn("min-h-10 rounded-lg border px-4 text-sm font-semibold", values.locationType === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
                                {label}
                            </button>
                        ))}
                    </div>
                    {values.locationType === "PHYSICAL" ? (
                        <>
                            <Field label="Nama Tempat" required error={errors.venueName}>
                                {(control) => <IconWrap icon={<MapPin className="size-4" />}><TextInput {...control} value={values.venueName} maxLength={120} onChange={(event) => set("venueName", event.target.value)} placeholder="Contoh: Gazebo Barat, Taman Suropati" className="pl-9" /></IconWrap>}
                            </Field>
                            <Field label="Alamat atau Patokan" required error={errors.publicLocation} hint="Gunakan ruang publik. Jangan menulis alamat rumah pengurus atau anggota.">
                                {(control) => <TextInput {...control} value={values.publicLocation} maxLength={200} onChange={(event) => set("publicLocation", event.target.value)} placeholder="Contoh: Jl. Taman Suropati, Menteng, Jakarta Pusat" />}
                            </Field>
                        </>
                    ) : (
                        <Field label="Tautan Daring" required error={errors.eventUrl} hint="Tautan hanya dibuka bila diawali http:// atau https://.">
                            {(control) => <IconWrap icon={<Link2 className="size-4" />}><TextInput {...control} type="url" value={values.eventUrl} onChange={(event) => set("eventUrl", event.target.value)} placeholder="https://meet.example.com/lingkar-baca" className="pl-9" /></IconWrap>}
                        </Field>
                    )}
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                    <legend className="text-sm font-medium">Status Publikasi</legend>
                    {([["DRAFT", "Simpan sebagai draf", "Hanya terlihat oleh pengurus komunitas."], ["PUBLISHED", "Terbitkan", "Tampil untuk umum setelah disimpan."]] as const).map(([value, label, hint]) => (
                        <ChoiceOption key={value} type="radio" name="publicationStatus" checked={values.publicationStatus === value} onChange={() => set("publicationStatus", value)}
                            className="items-start rounded-xl border border-border p-4 has-checked:border-primary has-checked:bg-[#eef4ef]">
                            <span><span className="block font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
                        </ChoiceOption>
                    ))}
                </fieldset>

                <div className="flex justify-end gap-3">
                    <Link href={listHref} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-5 text-sm font-semibold hover:bg-muted">Batal</Link>
                    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {pending ? "Menyimpan..." : "Simpan Acara"}
                    </button>
                </div>
            </FormSection>
        </form>
    );
}

function IconWrap({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <span className="relative block">
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-muted-foreground">{icon}</span>
            {children}
        </span>
    );
}
