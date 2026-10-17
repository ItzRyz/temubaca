"use client";

import { useActionState } from "react";

import { Field, FormAlert, TextInput } from "@/components/ui/form";

import { updateProfile, type ProfileActionState } from "../actions";

const initialState: ProfileActionState = { success: false };

export function ProfileSettingsForm({ displayName }: { displayName: string }) {
    const [state, action, pending] = useActionState(updateProfile, initialState);

    return (
        <form action={action} className="mt-6 grid max-w-xl gap-4 rounded-2xl border border-border/70 bg-card p-6">
            <Field id="displayName" label="Nama tampilan" hint="2–100 karakter. Tampil di profil dan listing bukumu." error={state.fieldError} required>
                {(control) => (
                    <TextInput {...control} name="displayName" defaultValue={displayName} required minLength={2} maxLength={100} autoComplete="nickname" />
                )}
            </Field>
            <button type="submit" disabled={pending} className="min-h-11 justify-self-start rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {pending ? "Menyimpan…" : "Simpan perubahan"}
            </button>
            <FormAlert tone={state.success ? "success" : "error"}>{state.fieldError ? null : state.message}</FormAlert>
        </form>
    );
}
