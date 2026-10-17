"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

import { FormAlert, Select, Switch } from "@/components/ui/form";

import { staleDayOptions, type CatalogSettings } from "../catalog-settings";

function Row({ label, description, labelId, children }: { label: string; description: string; labelId: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-t border-border py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p id={labelId} className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {children}
        </div>
    );
}

const selectClass = "sm:w-56";

/** Figma "Pengaturan → Katalog Buku" (161:859). Saved values apply to everyone on the next request. */
export function CatalogSettingsForm({ initial }: { initial: CatalogSettings }) {
    const router = useRouter();
    const ids = { primary: useId(), fallback: useId(), stale: useId(), attribution: useId() };
    const [values, setValues] = useState(initial);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
    const dirty = (Object.keys(values) as (keyof CatalogSettings)[]).some((key) => values[key] !== initial[key]);

    const set = <Key extends keyof CatalogSettings>(key: Key, value: CatalogSettings[Key]) => {
        setValues((current) => ({ ...current, [key]: value }));
        setMessage(null);
    };

    async function save() {
        setPending(true);
        setMessage(null);
        try {
            const response = await fetch("/api/admin/settings/catalog", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(values),
            });
            const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
            if (!response.ok) {
                setMessage({ tone: "error", text: payload?.error?.message ?? "Pengaturan belum dapat disimpan." });
                return;
            }
            setMessage({ tone: "ok", text: "Pengaturan disimpan dan tercatat di jejak audit." });
            router.refresh();
        } catch {
            setMessage({ tone: "error", text: "Koneksi terputus. Coba lagi." });
        } finally {
            setPending(false);
        }
    }

    return (
        <>
            <section aria-labelledby="catalog-settings-title" className="rounded-xl border border-border bg-card px-6 pt-6 pb-2">
                <h2 id="catalog-settings-title" className="font-heading text-xl font-semibold">Katalog Buku</h2>
                <p className="mt-1 mb-4 text-sm text-muted-foreground">Sumber data buku dan aturan pembaruan data tersimpan.</p>

                <Row label="Provider utama" description="Dicoba lebih dulu saat mencocokkan dan melengkapi rekaman buku." labelId={ids.primary}>
                    <Select aria-labelledby={ids.primary} value={values.primaryProvider} onChange={(event) => set("primaryProvider", event.target.value as CatalogSettings["primaryProvider"])} className={selectClass}>
                        <option value="OPEN_LIBRARY">Open Library</option>
                        <option value="GOOGLE_BOOKS">Google Books</option>
                    </Select>
                </Row>
                <Row label="Provider cadangan" description="Provider lain dipakai jika provider utama tidak punya data, gagal, atau membatasi permintaan." labelId={ids.fallback}>
                    <Switch checked={values.fallbackEnabled} onCheckedChange={(value) => set("fallbackEnabled", value)} aria-labelledby={ids.fallback} />
                </Row>
                <Row label="Tandai data usang setelah" description="Admin melihat label usang pada rekaman yang belum disinkronkan ulang selama periode ini." labelId={ids.stale}>
                    <Select aria-labelledby={ids.stale} value={values.staleAfterDays} onChange={(event) => set("staleAfterDays", Number(event.target.value) as CatalogSettings["staleAfterDays"])} className={selectClass}>
                        {staleDayOptions.map((days) => <option key={days} value={days}>{days} hari</option>)}
                    </Select>
                </Row>
                <Row label="Tampilkan atribusi provider" description="Sumber data tampil pada detail buku sesuai ketentuan provider." labelId={ids.attribution}>
                    <Switch checked={values.showAttribution} onCheckedChange={(value) => set("showAttribution", value)} aria-labelledby={ids.attribution} />
                </Row>
            </section>

            <FormAlert className="mt-4" tone={message?.tone === "error" ? "error" : "success"}>{message?.text}</FormAlert>
            <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => { setValues(initial); setMessage(null); }} disabled={!dirty || pending}
                    className="h-11 rounded-lg border border-border bg-card px-5 text-sm font-semibold hover:bg-muted disabled:opacity-50">
                    Batalkan
                </button>
                <button type="button" onClick={save} disabled={!dirty || pending}
                    className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    <Check aria-hidden="true" className="size-4" /> {pending ? "Menyimpan…" : "Simpan Perubahan"}
                </button>
            </div>
        </>
    );
}
