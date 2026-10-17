"use client";

import { useId, useState, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormAlert, Select, Switch, TextArea, TextInput } from "@/components/ui/form";

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <section aria-labelledby={`${title}-title`} className="rounded-2xl border border-border bg-card p-6">
            <h2 id={`${title}-title`} className="font-heading text-xl font-semibold">{title}</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
            <div className="grid gap-5 md:grid-cols-2">{children}</div>
        </section>
    );
}

export function ComponentCatalog() {
    const switchLabel = useId();
    const [name, setName] = useState("");
    const [offered, setOffered] = useState(true);
    const [agreed, setAgreed] = useState(false);
    const nameError = name.length > 0 && name.trim().length < 2 ? "Nama minimal 2 karakter." : null;

    return (
        <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-10 sm:px-6">
            <header>
                <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Khusus development</p>
                <h1 className="mt-1 font-heading text-[32px] font-semibold text-primary">Katalog Komponen Form</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                    Komponen bersama di <code className="font-mono text-sm">src/components/ui/form.tsx</code>. Semua kontrol setinggi 44px, memakai cincin fokus yang sama,
                    dan menghubungkan petunjuk serta pesan kesalahan lewat <code className="font-mono text-sm">aria-describedby</code>.
                </p>
            </header>

            <Section title="Field + TextInput" description="Label selalu terlihat. Petunjuk di bawah kontrol, error menggantikan warna garis dan diumumkan pembaca layar.">
                <Field label="Nama lengkap" hint="Ketik satu huruf untuk melihat error." error={nameError} required>
                    {(control) => <TextInput {...control} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama lengkapmu" />}
                </Field>
                <Field label="Email" error="Format email belum benar.">
                    {(control) => <TextInput {...control} type="email" defaultValue="bukan-email" />}
                </Field>
                <Field label="Dinonaktifkan" hint="Kontrol nonaktif tetap terbaca.">
                    {(control) => <TextInput {...control} disabled defaultValue="Tidak dapat diubah" />}
                </Field>
            </Section>

            <Section title="Select dan TextArea" description="Ukuran, garis, dan fokus sama dengan TextInput.">
                <Field label="Kondisi buku">
                    {(control) => (
                        <Select {...control} defaultValue="GOOD">
                            <option value="NEW">Baru</option>
                            <option value="GOOD">Baik</option>
                            <option value="FAIR">Cukup baik</option>
                        </Select>
                    )}
                </Field>
                <Field label="Catatan" hint="Maksimal 500 karakter.">
                    {(control) => <TextArea {...control} maxLength={500} placeholder="Tulis catatan…" />}
                </Field>
            </Section>

            <Section title="Switch dan Checkbox" description="Switch untuk on/off yang langsung berlaku; checkbox untuk persetujuan dalam form.">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                    <span id={switchLabel} className="text-sm font-medium">Ditawarkan ke publik</span>
                    <Switch checked={offered} onCheckedChange={setOffered} aria-labelledby={switchLabel} />
                </div>
                <div className="flex items-start gap-2.5 rounded-lg border border-border p-4">
                    <Checkbox id="catalog-agree" className="mt-0.5" checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} />
                    <label htmlFor="catalog-agree" className="cursor-pointer text-sm text-muted-foreground">Saya menyetujui aturan peminjaman.</label>
                </div>
            </Section>

            <Section title="FormAlert" description="Pesan tingkat form. Error diumumkan segera (role=alert), sukses dan info secara sopan (role=status).">
                <FormAlert>Perubahan belum dapat disimpan. Coba lagi.</FormAlert>
                <FormAlert tone="success">Perubahan berhasil disimpan.</FormAlert>
                <FormAlert tone="info">Perubahan berlaku untuk seluruh pengguna setelah disimpan.</FormAlert>
            </Section>
        </main>
    );
}
