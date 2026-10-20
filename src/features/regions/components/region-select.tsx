"use client";

import { useState } from "react";

import { describedBy, FieldError, Select } from "@/components/ui/form";

import { kabkotaOptions, provinceOptions, regionByCode } from "../regions";

const provinces = provinceOptions();

/**
 * Province, then kab/kota (Kemendagri codes, R-11). Controlled through `value`/`onChange`, or
 * uncontrolled with `name` so a server-action form posts the chosen code.
 */
export function RegionSelect({ id, label, value, defaultValue, onChange, name, error, hint, required, emptyLabel = "Pilih kabupaten/kota" }: {
    id: string;
    label: string;
    value?: string;
    defaultValue?: string;
    onChange?: (code: string) => void;
    name?: string;
    error?: string | null;
    hint?: string;
    required?: boolean;
    emptyLabel?: string;
}) {
    const [internal, setInternal] = useState(defaultValue ?? "");
    const code = value ?? internal;
    const [province, setProvince] = useState(() => regionByCode(code)?.provinceCode ?? "");
    const shownProvince = regionByCode(code)?.provinceCode ?? province;
    const options = shownProvince ? kabkotaOptions(shownProvince) : [];
    const kabkotaId = `${id}-kabkota`;
    const errorId = `${kabkotaId}-error`;

    function choose(next: string) {
        if (value === undefined) setInternal(next);
        onChange?.(next);
    }

    return (
        <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">
                {label}{required && <span aria-hidden="true" className="text-destructive"> *</span>}
            </legend>
            {hint && <p id={`${kabkotaId}-hint`} className="text-[13px] leading-5 text-muted-foreground">{hint}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
                <Select
                    id={`${id}-province`}
                    aria-label="Provinsi"
                    value={shownProvince}
                    onChange={(event) => {
                        setProvince(event.target.value);
                        choose("");
                    }}
                >
                    <option value="">Pilih provinsi</option>
                    {provinces.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                </Select>
                <Select
                    id={kabkotaId}
                    aria-label="Kabupaten/kota"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(kabkotaId, hint, error)}
                    value={code}
                    disabled={!shownProvince}
                    onChange={(event) => choose(event.target.value)}
                >
                    <option value="">{emptyLabel}</option>
                    {options.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                </Select>
            </div>
            {name && <input type="hidden" name={name} value={code} />}
            <FieldError id={errorId} message={error} />
        </fieldset>
    );
}
