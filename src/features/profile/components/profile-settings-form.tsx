"use client";

import { useActionState } from "react";

import { updateProfile, type ProfileActionState } from "../actions";

const initialState: ProfileActionState = { success: false };

export function ProfileSettingsForm({ displayName }: { displayName: string }) {
    const [state, action, pending] = useActionState(updateProfile, initialState);

    return (
        <form action={action} className="mt-6 grid max-w-xl gap-4 rounded-2xl border border-border/70 bg-card p-6">
            <div className="grid gap-2">
                <label htmlFor="displayName" className="text-sm font-medium">Nama tampilan</label>
                <input
                    id="displayName"
                    name="displayName"
                    defaultValue={displayName}
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="nickname"
                    aria-invalid={Boolean(state.fieldError)}
                    aria-describedby={state.fieldError ? "displayName-error" : undefined}
                    className="min-h-11 rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {state.fieldError && <p id="displayName-error" className="text-sm text-destructive">{state.fieldError}</p>}
            </div>
            <button type="submit" disabled={pending} className="min-h-11 justify-self-start rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {pending ? "Menyimpan…" : "Simpan perubahan"}
            </button>
            <p aria-live="polite" className={state.success ? "text-sm text-primary" : "text-sm text-destructive"}>
                {state.message}
            </p>
        </form>
    );
}
