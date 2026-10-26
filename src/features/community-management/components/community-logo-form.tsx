"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { FormAlert } from "@/components/ui/form";
import { CommunityAvatar } from "@/features/communities/components/community-card";

import { sendCommunityRequest } from "../client";
import { MERCH_PHOTO_TYPES, merchPhotoError } from "../rules";

/** Community logo (TB-030): uploaded as soon as it is chosen, shown on the profile and community cards. */
export function CommunityLogoForm({ community }: { community: { id: string; name: string; logoPath: string | null } }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const hintId = useId();
    const [pending, setPending] = useState<"upload" | "remove" | null>(null);
    const [problem, setProblem] = useState("");

    async function upload(file: File) {
        const invalid = merchPhotoError(file, "Logo");
        if (invalid) return setProblem(invalid);
        setProblem("");
        setPending("upload");
        const form = new FormData();
        form.append("file", file);
        const result = await sendCommunityRequest<{ path: string }>(`/api/communities/${community.id}/logo`, "PUT", form);
        setPending(null);
        if (!result.ok) return setProblem(result.message);
        router.refresh();
    }

    async function remove() {
        setProblem("");
        setPending("remove");
        const result = await sendCommunityRequest<{ path: null }>(`/api/communities/${community.id}/logo`, "DELETE");
        setPending(null);
        if (!result.ok) return setProblem(result.message);
        router.refresh();
    }

    return (
        <section aria-labelledby={`${hintId}-title`} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
            <CommunityAvatar community={community} className="size-20 rounded-xl border border-border text-2xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h2 id={`${hintId}-title`} className="font-heading text-lg font-semibold">Logo komunitas</h2>
                <p id={hintId} className="text-sm text-muted-foreground">JPG, PNG, atau WebP, maksimal 2 MB. Tampil di profil dan kartu komunitas; tanpa logo, inisial nama yang tampil.</p>
                <div className="flex flex-wrap gap-2">
                    <input ref={inputRef} type="file" accept={MERCH_PHOTO_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void upload(file);
                        }} />
                    <button type="button" onClick={() => inputRef.current?.click()} disabled={pending !== null} aria-describedby={hintId}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">
                        {pending === "upload" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <ImagePlus aria-hidden="true" className="size-4" />}
                        {pending === "upload" ? "Mengunggah…" : community.logoPath ? "Ganti logo" : "Unggah logo"}
                    </button>
                    {community.logoPath && (
                        <button type="button" onClick={() => void remove()} disabled={pending !== null}
                            className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
                            <Trash2 aria-hidden="true" className="size-4" /> {pending === "remove" ? "Menghapus…" : "Hapus logo"}
                        </button>
                    )}
                </div>
                {problem && <FormAlert>{problem}</FormAlert>}
            </div>
        </section>
    );
}
