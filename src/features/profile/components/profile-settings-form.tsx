"use client";

import { useActionState, useEffect, useState } from "react";

import { Field, FormAlert, TextInput } from "@/components/ui/form";
import { DistrictSelect } from "@/features/regions/components/district-select";
import { RegionSelect } from "@/features/regions/components/region-select";

import { updateProfile, type ProfileActionState } from "../actions";
import { notify } from "@/lib/toast";

const initialState: ProfileActionState = { success: false };

export function ProfileSettingsForm({ displayName, regionCode, districtCode }: { displayName: string; regionCode: string | null; districtCode: string | null }) {
    const [city, setCity] = useState(regionCode ?? "");
    const [state, action, pending] = useActionState(updateProfile, initialState);
    // Each submission returns a new state object, so a repeated save toasts again.
    useEffect(() => {
        if (state.success && state.message) notify.success(state.message);
    }, [state]);

    return (
        <form action={action} className="mt-6 grid max-w-xl gap-4 rounded-2xl border border-border/70 bg-card p-6">
            <Field id="displayName" label="Nama tampilan" hint="2–100 karakter. Tampil di profil dan listing bukumu." error={state.fieldError} required>
                {(control) => (
                    <TextInput {...control} name="displayName" defaultValue={displayName} required minLength={2} maxLength={100} autoComplete="nickname" />
                )}
            </Field>
            <RegionSelect id="profile-region" label="Wilayah (opsional)" name="regionCode" value={city} onChange={setCity} error={state.regionError} emptyLabel="Tidak diisi"
                hint="Dipakai untuk merekomendasikan komunitas di sekitarmu. Pemberi pinjam yang menerima permintaanmu melihat wilayah umumnya saja (tingkatnya diatur admin), tidak pernah alamat." />
            <DistrictSelect id="profile-district" cityCode={city} name="districtCode" defaultValue={districtCode ?? ""} />
            <button type="submit" disabled={pending} className="min-h-11 justify-self-start rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {pending ? "Menyimpan…" : "Simpan perubahan"}
            </button>
            <FormAlert tone="error">{state.success || state.fieldError || state.regionError ? null : state.message}</FormAlert>
        </form>
    );
}
