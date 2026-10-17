"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

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

function Switch({ checked, onChange, labelledBy }: { checked: boolean; onChange: (value: boolean) => void; labelledBy: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={labelledBy}
            onClick={() => onChange(!checked)}
            className={`relative h-6 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${checked ? "bg-primary" : "bg-[#d9ddd8]"}`}
        >
            <span aria-hidden="true" className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${checked ? "left-[26px]" : "left-0.5"}`} />
        </button>
    );
}

const selectClass = "h-10 rounded-lg border border-input bg-card px-3 text-sm sm:w-56";

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
                    <select aria-labelledby={ids.primary} value={values.primaryProvider} onChange={(event) => set("primaryProvider", event.target.value as CatalogSettings["primaryProvider"])} className={selectClass}>
                        <option value="OPEN_LIBRARY">Open Library</option>
                        <option value="GOOGLE_BOOKS">Google Books</option>
                    </select>
                </Row>
                <Row label="Provider cadangan" description="Provider lain dipakai jika provider utama tidak punya data, gagal, atau membatasi permintaan." labelId={ids.fallback}>
                    <Switch checked={values.fallbackEnabled} onChange={(value) => set("fallbackEnabled", value)} labelledBy={ids.fallback} />
                </Row>
                <Row label="Tandai data usang setelah" description="Admin melihat label usang pada rekaman yang belum disinkronkan ulang selama periode ini." labelId={ids.stale}>
                    <select aria-labelledby={ids.stale} value={values.staleAfterDays} onChange={(event) => set("staleAfterDays", Number(event.target.value) as CatalogSettings["staleAfterDays"])} className={selectClass}>
                        {staleDayOptions.map((days) => <option key={days} value={days}>{days} hari</option>)}
                    </select>
                </Row>
                <Row label="Tampilkan atribusi provider" description="Sumber data tampil pada detail buku sesuai ketentuan provider." labelId={ids.attribution}>
                    <Switch checked={values.showAttribution} onChange={(value) => set("showAttribution", value)} labelledBy={ids.attribution} />
                </Row>
            </section>

            {message && (
                <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" : "mt-4 text-sm text-primary"}>
                    {message.text}
                </p>
            )}
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
