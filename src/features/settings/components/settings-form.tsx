"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { FormAlert, Select, Switch } from "@/components/ui/form";
import { notify } from "@/lib/toast";

import { settingFields, type SettingField, type SettingsSection } from "../platform-settings";

type Values = Record<string, string | number | boolean>;

function FieldRow({ field, value, onChange }: { field: SettingField; value: string | number | boolean; onChange: (value: string | number | boolean) => void }) {
    const labelId = useId();
    const descriptionId = useId();
    return (
        <div className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
                <p id={labelId} className="text-sm font-semibold">{field.label}</p>
                <p id={descriptionId} className="text-xs text-muted-foreground">{field.description}</p>
            </div>
            {field.kind === "switch" ? (
                <Switch checked={Boolean(value)} onCheckedChange={onChange} aria-labelledby={labelId} aria-describedby={descriptionId} />
            ) : (
                <Select aria-labelledby={labelId} aria-describedby={descriptionId} className="shrink-0 sm:w-56" value={String(value)}
                    onChange={(event) => {
                        const option = field.options.find((item) => String(item.value) === event.target.value);
                        if (option) onChange(option.value);
                    }}>
                    {field.options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
                </Select>
            )}
        </div>
    );
}

/**
 * One section of "Pengaturan" (Figma, 30 Okt 2026): label, explanation and a select or switch per row,
 * Batalkan / Simpan Perubahan. Saved values apply to everyone on the next request and are audited.
 */
export function SettingsForm({ section, initial }: { section: SettingsSection; initial: Values }) {
    const router = useRouter();
    const [values, setValues] = useState<Values>(initial);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const fields = settingFields[section];
    const dirty = fields.some((field) => values[field.key] !== initial[field.key]);

    async function save() {
        setPending(true);
        setError("");
        try {
            const response = await fetch(`/api/admin/settings/${section}`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(values),
            });
            const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
            if (!response.ok) {
                setError(payload?.error?.message ?? "Pengaturan belum dapat disimpan.");
                return;
            }
            notify.success("Pengaturan disimpan dan tercatat di jejak audit.");
            router.refresh();
        } catch {
            setError("Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <>
            <div className="divide-y divide-border">
                {fields.map((field) => (
                    <FieldRow key={field.key} field={field} value={values[field.key]}
                        onChange={(value) => { setValues((current) => ({ ...current, [field.key]: value })); setError(""); }} />
                ))}
            </div>
            <FormAlert className="mt-4" tone="error">{error}</FormAlert>
            <div className="mt-4 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
                <p role="status" className="text-xs text-muted-foreground sm:mr-auto">{dirty ? "Ada perubahan yang belum disimpan." : "Tidak ada perubahan."}</p>
                <button type="button" onClick={() => { setValues(initial); setError(""); }} disabled={!dirty || pending}
                    className="h-11 rounded-lg border border-border bg-card px-5 text-sm font-semibold hover:bg-muted disabled:opacity-50">
                    Batalkan
                </button>
                <button type="button" onClick={save} disabled={!dirty || pending}
                    className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    <Check aria-hidden="true" className="size-4" /> {pending ? "Menyimpan…" : "Simpan Perubahan"}
                </button>
            </div>
        </>
    );
}
