"use client";

import { AlertCircle, FileText, Upload, X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { EVIDENCE_TYPES, evidenceFileError } from "../rules";

/** Figma 309:3271: "N isian perlu diperbaiki sebelum disimpan" above the form. */
export function ErrorSummary({ errors, message }: { errors: Record<string, string>; message?: string }) {
    const count = Object.keys(errors).length;
    if (count === 0 && !message) return null;
    return (
        <div role="alert" className="flex gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <span>
                <span className="block font-semibold">{count > 0 ? `${count} isian perlu diperbaiki sebelum disimpan` : "Perubahan belum tersimpan"}</span>
                <span className="text-foreground/80">{count > 0 ? "Data yang sudah Anda isi tidak hilang." : message}</span>
            </span>
        </div>
    );
}

/** Label with an optional "(opsional)" marker and a live character counter. */
export function CountedLabel({ label, optional, required, length, max }: { label: string; optional?: boolean; required?: boolean; length?: number; max?: number }) {
    return (
        <span className="flex items-center justify-between gap-2">
            <span>
                {label}
                {required && <span aria-hidden="true" className="text-destructive"> *</span>}
                {optional && <span className="font-normal text-muted-foreground"> (opsional)</span>}
            </span>
            {max !== undefined && <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">{length ?? 0}/{max}</span>}
        </span>
    );
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
    return (
        <section className={cn("rounded-2xl border border-border bg-card p-5 sm:p-6", className)}>
            <h2 className="font-heading text-xl font-semibold text-primary">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            <div className="mt-5 flex flex-col gap-5">{children}</div>
        </section>
    );
}

function formatSize(bytes: number) {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Optional evidence file (PDF/JPG/PNG ≤5 MB); the type and size are checked again on the server. */
export function EvidenceFilePicker({ file, onChange, error, onError }: { file: File | null; onChange: (file: File | null) => void; error?: string; onError: (message: string | null) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const id = useId();
    return (
        <div className="flex flex-col gap-2">
            <span id={`${id}-label`} className="text-sm font-medium">Berkas pendukung <span className="font-normal text-muted-foreground">(opsional)</span></span>
            <label
                htmlFor={id}
                className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center text-sm focus-within:ring-2 focus-within:ring-ring",
                    error ? "border-destructive bg-destructive/5" : "border-border bg-[#faf8f2] hover:bg-muted/60",
                )}
            >
                <Upload aria-hidden="true" className="size-5 text-foreground/70" />
                <span className="font-semibold">Pilih berkas</span>
                <span className="text-xs text-muted-foreground">PDF, JPG, atau PNG, maksimal 5 MB</span>
                <input
                    ref={inputRef}
                    id={id}
                    type="file"
                    accept={EVIDENCE_TYPES.join(",")}
                    aria-labelledby={`${id}-label`}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="sr-only"
                    onChange={(event) => {
                        const next = event.target.files?.[0] ?? null;
                        const problem = next ? evidenceFileError(next) : null;
                        onError(problem);
                        onChange(problem ? null : next);
                        if (problem && inputRef.current) inputRef.current.value = "";
                    }}
                />
            </label>
            {file && (
                <p className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                    <button type="button" aria-label={`Hapus ${file.name}`} onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }} className="flex size-8 items-center justify-center rounded hover:bg-muted">
                        <X aria-hidden="true" className="size-4" />
                    </button>
                </p>
            )}
            {error && <p id={`${id}-error`} role="alert" className="text-[13px] text-destructive">{error}</p>}
        </div>
    );
}
