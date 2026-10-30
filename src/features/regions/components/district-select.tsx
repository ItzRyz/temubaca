"use client";

import { useEffect, useState } from "react";

import { Select } from "@/components/ui/form";

/**
 * Optional kecamatan within the chosen kab/kota (30 Okt 2026). The list comes from the regions API; the
 * value is posted as `name`. Changing kab/kota drops a kecamatan that no longer belongs to it.
 */
export function DistrictSelect({ id, cityCode, name, defaultValue }: { id: string; cityCode: string; name: string; defaultValue?: string }) {
    const [options, setOptions] = useState<{ code: string; name: string }[]>([]);
    const [value, setValue] = useState(defaultValue ?? "");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!cityCode) return;
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        fetch(`/api/regions/${cityCode}/districts`)
            .then((response) => response.json() as Promise<{ data?: { code: string; name: string }[] }>)
            .then((payload) => { if (!cancelled) setOptions(payload.data ?? []); })
            .catch(() => { if (!cancelled) setOptions([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [cityCode]);

    const current = cityCode && value.startsWith(`${cityCode}.`) ? value : "";
    return (
        <div className="grid gap-1.5">
            <label htmlFor={id} className="text-sm font-medium">Kecamatan <span className="font-normal text-muted-foreground">(opsional)</span></label>
            <Select id={id} name={name} value={current} disabled={!cityCode || loading} onChange={(event) => setValue(event.target.value)}>
                <option value="">{!cityCode ? "Pilih kabupaten/kota dulu" : loading ? "Memuat…" : "Tidak diisi"}</option>
                {options.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
            </Select>
        </div>
    );
}
