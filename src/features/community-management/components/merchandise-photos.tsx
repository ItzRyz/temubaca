"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { merchandisePhotoUrl } from "@/features/merchandise/format";

import { sendCommunityRequest } from "../client";
import { MERCH_PHOTO_LIMIT, MERCH_PHOTO_TYPES, merchPhotoError } from "../rules";

/**
 * Up to three product photos (DEC-12). Each file is uploaded as soon as it is chosen; the item only
 * shows it once the form is saved with its path. The first photo is the cover on catalog cards.
 */
export function MerchandisePhotos({ communityId, paths, onChange, error }: {
    communityId: string;
    paths: string[];
    onChange: (paths: string[]) => void;
    error?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const hintId = useId();
    const [uploading, setUploading] = useState(false);
    const [problem, setProblem] = useState("");

    async function upload(file: File) {
        const invalid = merchPhotoError(file);
        if (invalid) return setProblem(invalid);
        setProblem("");
        setUploading(true);
        const form = new FormData();
        form.append("file", file);
        const result = await sendCommunityRequest<{ path: string }>(`/api/communities/${communityId}/merchandise/photos`, "POST", form);
        setUploading(false);
        if (!result.ok) return setProblem(result.message.includes("5 MB") ? "Ukuran foto maksimal 2 MB." : result.message);
        onChange([...paths, result.data.path]);
    }

    const message = problem || error;
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Foto <span className="font-normal text-muted-foreground">(opsional, maks. {MERCH_PHOTO_LIMIT})</span></span>
            <ul className="grid list-none grid-cols-3 gap-2 p-0">
                {paths.map((path, index) => (
                    <li key={path} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-[#faf8f2]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={merchandisePhotoUrl(path)} alt={`Foto ${index + 1}`} className="size-full object-cover" />
                        {index === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Sampul</span>}
                        <button type="button" onClick={() => onChange(paths.filter((item) => item !== path))} aria-label={`Hapus foto ${index + 1}`}
                            className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-ring">
                            <X aria-hidden="true" className="size-4" />
                        </button>
                    </li>
                ))}
                {paths.length < MERCH_PHOTO_LIMIT && (
                    <li className="aspect-square">
                        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} aria-describedby={hintId}
                            className="flex size-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-[#faf8f2] p-2 text-center text-xs text-muted-foreground hover:bg-muted disabled:opacity-60">
                            {uploading ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <ImagePlus aria-hidden="true" className="size-5" />}
                            {uploading ? "Mengunggah..." : "Tambah foto"}
                        </button>
                    </li>
                )}
            </ul>
            <input ref={inputRef} type="file" accept={MERCH_PHOTO_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void upload(file);
                }} />
            <p id={hintId} className="text-xs text-muted-foreground">JPG, PNG, atau WebP, maks. 2 MB. Foto pertama jadi sampul. Foto tampil publik setelah disimpan.</p>
            {message && <p role="alert" className="text-xs font-medium text-destructive">{message}</p>}
        </div>
    );
}
