"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ReactNode } from "react";

import { FormAlert } from "@/components/ui/form";
import { CommunityAvatar } from "@/features/communities/components/community-card";
import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { notify } from "@/lib/toast";

import { sendCommunityRequest } from "../client";
import { MERCH_PHOTO_TYPES, merchPhotoError } from "../rules";

/**
 * One image field: uploaded as soon as it is chosen, with replace and remove. `endpoint` takes PUT
 * (multipart `file`) and DELETE; `label` names the image in buttons and messages.
 */
export function ImageUploadField({ endpoint, label, hint, hasImage, preview, className }: {
    endpoint: string;
    label: string;
    hint: string;
    hasImage: boolean;
    preview: ReactNode;
    className?: string;
}) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const hintId = useId();
    const [pending, setPending] = useState<"upload" | "remove" | null>(null);
    const [problem, setProblem] = useState("");
    const noun = label.toLowerCase();

    async function upload(file: File) {
        const invalid = merchPhotoError(file, label);
        if (invalid) return setProblem(invalid);
        setProblem("");
        setPending("upload");
        const form = new FormData();
        form.append("file", file);
        const result = await sendCommunityRequest<{ path: string }>(endpoint, "PUT", form);
        setPending(null);
        if (!result.ok) return setProblem(result.message);
        notify.success(`${label} disimpan.`);
        router.refresh();
    }

    async function remove() {
        setProblem("");
        setPending("remove");
        const result = await sendCommunityRequest<{ path: null }>(endpoint, "DELETE");
        setPending(null);
        if (!result.ok) return setProblem(result.message);
        notify.success(`${label} dihapus.`);
        router.refresh();
    }

    return (
        <section aria-labelledby={`${hintId}-title`} className={className ?? "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:p-6"}>
            {preview}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h2 id={`${hintId}-title`} className="font-heading text-lg font-semibold">{label}</h2>
                <p id={hintId} className="text-sm text-muted-foreground">{hint}</p>
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
                        {pending === "upload" ? "Mengunggah…" : hasImage ? `Ganti ${noun}` : `Unggah ${noun}`}
                    </button>
                    {hasImage && (
                        <button type="button" onClick={() => void remove()} disabled={pending !== null}
                            className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
                            <Trash2 aria-hidden="true" className="size-4" /> {pending === "remove" ? "Menghapus…" : `Hapus ${noun}`}
                        </button>
                    )}
                </div>
                {problem && <FormAlert>{problem}</FormAlert>}
            </div>
        </section>
    );
}

/** Community logo (TB-030), shown on the profile and community cards. */
export function CommunityLogoForm({ community }: { community: { id: string; name: string; logoPath: string | null } }) {
    return (
        <ImageUploadField endpoint={`/api/communities/${community.id}/logo`} label="Logo" hasImage={Boolean(community.logoPath)}
            hint="JPG, PNG, atau WebP, maksimal 2 MB. Tampil di profil dan kartu komunitas; tanpa logo, inisial nama yang tampil."
            preview={<CommunityAvatar community={community} className="size-20 shrink-0 rounded-xl border border-border text-2xl" />} />
    );
}

/** Profile banner (29 Okt 2026), the wide image at the top of the public profile. */
export function CommunityBannerForm({ community }: { community: { id: string; bannerPath: string | null } }) {
    return (
        <ImageUploadField endpoint={`/api/communities/${community.id}/banner`} label="Banner" hasImage={Boolean(community.bannerPath)}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6"
            hint="JPG, PNG, atau WebP, maksimal 2 MB, disarankan 1600×400 piksel. Tampil di atas profil komunitas; tanpa banner, latar hijau TemuBaca yang tampil."
            preview={<CommunityBanner bannerPath={community.bannerPath} className="h-28 rounded-xl sm:h-36" />} />
    );
}

/** The banner image, or the brand gradient when there is none. */
export function CommunityBanner({ bannerPath, className }: { bannerPath: string | null; className?: string }) {
    return bannerPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- public storage URL, sized by CSS like the logo
        <img src={merchandisePhotoUrl(bannerPath)} alt="" className={`w-full object-cover ${className ?? ""}`} />
    ) : (
        <div aria-hidden="true" className={`bg-[linear-gradient(135deg,#1b4d37,#3d7a5c_55%,#a9c7b2)] ${className ?? ""}`} />
    );
}
