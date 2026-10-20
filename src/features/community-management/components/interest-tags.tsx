"use client";

import { Check } from "lucide-react";

import { FieldError } from "@/components/ui/form";
import { genres } from "@/features/books/genres";
import { cn } from "@/lib/utils";
import { COMMUNITY_INTEREST_LIMIT } from "@/lib/validation/schemas/community-management.schema";

/** Site genre labels a community reads (ML-04); readers pick from the same list, so recommendations match. */
export function InterestTags({ id, value, onChange, error }: { id: string; value: string[]; onChange: (next: string[]) => void; error?: string | null }) {
    const full = value.length >= COMMUNITY_INTEREST_LIMIT;
    const errorId = `${id}-error`;

    function toggle(label: string) {
        onChange(value.includes(label) ? value.filter((item) => item !== label) : [...value, label]);
    }

    return (
        <fieldset id={id} className="grid gap-2" aria-describedby={[`${id}-hint`, error ? errorId : null].filter(Boolean).join(" ")}>
            <legend className="text-sm font-medium">Minat Bacaan<span aria-hidden="true" className="text-destructive"> *</span></legend>
            <p id={`${id}-hint`} className="text-[13px] leading-5 text-muted-foreground">
                Pilih 1–{COMMUNITY_INTEREST_LIMIT} genre yang paling sering dibaca. Dipakai untuk merekomendasikan komunitas ke pembaca dengan minat yang sama. Terpilih {value.length}/{COMMUNITY_INTEREST_LIMIT}.
            </p>
            <div className="flex flex-wrap gap-2">
                {genres.map((genre) => {
                    const selected = value.includes(genre.label);
                    return (
                        <button
                            key={genre.slug}
                            type="button"
                            aria-pressed={selected}
                            disabled={!selected && full}
                            onClick={() => toggle(genre.label)}
                            className={cn(
                                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                            )}
                        >
                            {selected && <Check aria-hidden="true" className="size-3.5" />}
                            {genre.label}
                        </button>
                    );
                })}
            </div>
            <FieldError id={errorId} message={error} />
        </fieldset>
    );
}
