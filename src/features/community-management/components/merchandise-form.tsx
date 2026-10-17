"use client";

import { ArrowLeft, ImageOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, Select, Switch, TextArea, TextInput } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { communityMerchandiseSchema } from "@/lib/validation/schemas/community-management.schema";

import { fieldErrorsOf, sendCommunityRequest, type FieldErrors } from "../client";
import { merchandiseCategories } from "../rules";
import { CountedLabel, ErrorSummary, FormSection } from "./form-parts";

export type MerchandiseValues = {
    title: string;
    category: string;
    description: string;
    priceMode: "FIXED" | "FLEXIBLE";
    priceAmount: string;
    priceNote: string;
    availability: "AVAILABLE" | "UNAVAILABLE";
    stockNote: string;
    contactMode: "COMMUNITY" | "CUSTOM";
    contactOverride: string;
    visible: boolean;
};

export const emptyMerchandise: MerchandiseValues = {
    title: "", category: "", description: "", priceMode: "FIXED", priceAmount: "", priceNote: "",
    availability: "AVAILABLE", stockNote: "", contactMode: "COMMUNITY", contactOverride: "", visible: true,
};

function Divider({ title }: { title: string }) {
    return <h3 className="border-t border-border pt-5 font-heading text-base font-semibold">{title}</h3>;
}

/** Figma "Tambah Merchandise" (309:2922) with the validation state of 309:3271. */
export function MerchandiseForm({ communityId, itemId, initial, communityContact }: { communityId: string; itemId?: string; initial: MerchandiseValues; communityContact: string | null }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [values, setValues] = useState(initial);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [message, setMessage] = useState("");
    const set = <K extends keyof MerchandiseValues>(key: K, value: MerchandiseValues[K]) => setValues((current) => ({ ...current, [key]: value }));
    const listHref = `/communities/${communityId}/manage/merchandise`;

    function submit(event: FormEvent) {
        event.preventDefault();
        // Prices are typed as plain digits; "75.000" is a common slip, so say so instead of guessing.
        if (values.priceMode === "FIXED" && values.priceAmount && !/^\d+$/.test(values.priceAmount.trim())) {
            return setErrors({ priceAmount: "Tulis angka saja, tanpa titik atau huruf. Contoh: 75000." });
        }
        const parsed = communityMerchandiseSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
        setErrors({});
        setMessage("");
        startTransition(async () => {
            const result = itemId
                ? await sendCommunityRequest(`/api/communities/${communityId}/merchandise/${itemId}`, "PUT", values)
                : await sendCommunityRequest(`/api/communities/${communityId}/merchandise`, "POST", values);
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
                <ArrowLeft aria-hidden="true" className="size-4" /> Kembali ke daftar merchandise
            </Link>
            <ErrorSummary errors={errors} message={message} />
            <FormSection title={itemId ? "Ubah Merchandise" : "Tambah Merchandise"} description={'Isian tanpa label "opsional" wajib diisi. Item tampil di halaman komunitas setelah disimpan.'}>
                <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">Foto <span className="font-normal text-muted-foreground">(opsional)</span></span>
                        {/* Photo uploads need a public image bucket and moderation rules that are not set up yet. */}
                        <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-[#faf8f2] p-3 text-center text-xs text-muted-foreground">
                            <ImageOff aria-hidden="true" className="size-5" /> Unggah foto belum tersedia
                        </div>
                    </div>
                    <div className="flex flex-col gap-4">
                        <Field label={<CountedLabel label="Nama item" length={values.title.length} max={80} />} required error={errors.title}>
                            {(control) => <TextInput {...control} value={values.title} maxLength={80} onChange={(event) => set("title", event.target.value)} placeholder="Mis. Tote Bag Kanvas Pramoedya" />}
                        </Field>
                        <Field label={<CountedLabel label="Kategori" optional />} error={errors.category}>
                            {(control) => (
                                <Select {...control} value={values.category} onChange={(event) => set("category", event.target.value)}>
                                    <option value="">Pilih kategori</option>
                                    {merchandiseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                                </Select>
                            )}
                        </Field>
                    </div>
                </div>
                <Field label={<CountedLabel label="Deskripsi" optional length={values.description.length} max={300} />} error={errors.description}>
                    {(control) => <TextArea {...control} value={values.description} maxLength={300} onChange={(event) => set("description", event.target.value)} placeholder="Ukuran, bahan, atau cerita singkat tentang item ini." />}
                </Field>

                <Divider title="Harga" />
                <div role="radiogroup" aria-label="Jenis harga" className="flex flex-wrap gap-2">
                    {([["FIXED", "Harga tetap"], ["FLEXIBLE", "Tanpa harga tetap"]] as const).map(([value, label]) => (
                        <button key={value} type="button" role="radio" aria-checked={values.priceMode === value} onClick={() => set("priceMode", value)}
                            className={cn("min-h-10 rounded-lg border px-4 text-sm font-semibold", values.priceMode === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
                            {label}
                        </button>
                    ))}
                </div>
                {values.priceMode === "FIXED" ? (
                    <Field label="Harga" required error={errors.priceAmount} hint={'Pilih "Tanpa harga tetap" bila memakai donasi sukarela atau keterangan lain.'} className="sm:max-w-xs">
                        {(control) => (
                            <span className="flex items-stretch">
                                <span aria-hidden="true" className="flex items-center rounded-l-lg border border-r-0 border-input bg-[#faf8f2] px-3 text-sm text-muted-foreground">Rp</span>
                                <TextInput {...control} inputMode="numeric" value={values.priceAmount} onChange={(event) => set("priceAmount", event.target.value)} placeholder="75000" className="rounded-l-none" />
                            </span>
                        )}
                    </Field>
                ) : (
                    <Field label={<CountedLabel label="Keterangan harga" optional />} error={errors.priceNote}>
                        {(control) => <TextInput {...control} value={values.priceNote} maxLength={120} onChange={(event) => set("priceNote", event.target.value)} placeholder="Mis. Donasi sukarela mulai Rp10.000" />}
                    </Field>
                )}

                <Divider title="Ketersediaan" />
                <div className="grid gap-2 sm:grid-cols-2">
                    {([["AVAILABLE", "Tersedia", "Pembeli bisa menghubungi komunitas."], ["UNAVAILABLE", "Habis", "Tombol kontak dinonaktifkan di halaman publik."]] as const).map(([value, label, hint]) => (
                        <ChoiceOption key={value} type="radio" name="availability" checked={values.availability === value} onChange={() => set("availability", value)}
                            className="items-start rounded-xl border border-border p-4 has-checked:border-primary has-checked:bg-[#eef4ef]">
                            <span><span className="block font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
                        </ChoiceOption>
                    ))}
                </div>
                <Field label={<CountedLabel label="Keterangan" optional />} error={errors.stockNote} hint="Tampil di daftar Anda dan di halaman item.">
                    {(control) => <TextInput {...control} value={values.stockNote} maxLength={80} onChange={(event) => set("stockNote", event.target.value)} placeholder="Mis. Menunggu cetak ulang" />}
                </Field>

                <Divider title="Cara membeli" />
                <div className="flex flex-col gap-2">
                    <ChoiceOption type="radio" name="contactMode" checked={values.contactMode === "COMMUNITY"} onChange={() => set("contactMode", "COMMUNITY")}
                        className="items-start rounded-xl border border-border p-4 has-checked:border-primary has-checked:bg-[#eef4ef]">
                        <span>
                            <span className="block font-semibold">Pakai kontak komunitas</span>
                            <span className="block text-xs text-muted-foreground">{communityContact ? `${communityContact}. Diatur di Profil Komunitas.` : "Kontak diatur di Profil Komunitas."}</span>
                        </span>
                    </ChoiceOption>
                    <ChoiceOption type="radio" name="contactMode" checked={values.contactMode === "CUSTOM"} onChange={() => set("contactMode", "CUSTOM")}
                        className="items-start rounded-xl border border-border p-4 has-checked:border-primary has-checked:bg-[#eef4ef]">
                        <span className="font-semibold">Kontak khusus untuk item ini</span>
                    </ChoiceOption>
                    {values.contactMode === "CUSTOM" && (
                        <Field label="Kontak khusus" required error={errors.contactOverride} hint="Mis. akun Instagram atau nomor penjual item ini. Jangan cantumkan alamat rumah.">
                            {(control) => <TextInput {...control} value={values.contactOverride} maxLength={120} onChange={(event) => set("contactOverride", event.target.value)} placeholder="Mis. DM Instagram @komunitas" />}
                        </Field>
                    )}
                </div>

                <Divider title="Tampilan" />
                <div className="flex items-start gap-3">
                    <Switch id="merch-visible" checked={values.visible} onCheckedChange={(checked) => set("visible", checked)} aria-labelledby="merch-visible-label" />
                    <span>
                        <span id="merch-visible-label" className="block text-sm font-semibold">Tampilkan di halaman komunitas</span>
                        <span className="block text-xs text-muted-foreground">Matikan untuk menyembunyikan item sementara tanpa menghapusnya.</span>
                    </span>
                </div>

                <div className="flex justify-end gap-3 border-t border-border pt-5">
                    <Link href={listHref} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-5 text-sm font-semibold hover:bg-muted">Batal</Link>
                    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {pending ? "Menyimpan..." : "Simpan Merchandise"}
                    </button>
                </div>
            </FormSection>
        </form>
    );
}
