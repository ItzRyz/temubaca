import type { ExternalBook } from "@/lib/validation/schemas/book.schema";

/** Catalog fields a provider may fill; identity (`provider`, `providerId`) never changes on sync. */
export const syncableBookFields = ["isbn", "title", "authors", "description", "publisher", "publishedAt", "language", "categories", "coverUrl"] as const;
export type SyncableBookField = (typeof syncableBookFields)[number];

export type StoredBookMetadata = {
    isbn: string | null;
    title: string;
    authors: string[];
    description: string | null;
    publisher: string | null;
    publishedAt: string | null;
    language: string | null;
    categories: string[];
    coverUrl: string | null;
};

type FieldValue = string | string[] | null | undefined;

function isEmpty(value: FieldValue) {
    return value === null || value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim() === "");
}

function sameValue(a: FieldValue, b: FieldValue) {
    if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
    return (a ?? null) === (b ?? null);
}

/**
 * Combine provider data into a stored record.
 * - `primary` is the record's own provider: its non-empty values replace stored ones.
 * - `complements` (other providers, matched by ISBN) only fill fields that are still empty,
 *   so Open Library and Google Books complete each other without fighting.
 * Manual records pass no primary, so curated values are never overwritten.
 */
export function mergeBookMetadata(current: StoredBookMetadata, sources: { primary?: ExternalBook | null; complements?: (ExternalBook | null)[] }) {
    const next: StoredBookMetadata = { ...current, authors: [...current.authors], categories: [...current.categories] };

    if (sources.primary) {
        for (const field of syncableBookFields) {
            const value = sources.primary[field] as FieldValue;
            if (!isEmpty(value)) (next as Record<SyncableBookField, FieldValue>)[field] = value;
        }
    }

    for (const complement of sources.complements ?? []) {
        if (!complement) continue;
        for (const field of syncableBookFields) {
            if (field === "title") continue;
            const value = complement[field] as FieldValue;
            if (isEmpty((next as Record<SyncableBookField, FieldValue>)[field]) && !isEmpty(value)) {
                (next as Record<SyncableBookField, FieldValue>)[field] = value;
            }
        }
    }

    const changedFields = syncableBookFields.filter((field) => !sameValue(current[field], next[field]));
    const patch = Object.fromEntries(changedFields.map((field) => [field, next[field]])) as Partial<StoredBookMetadata>;
    return { patch, changedFields };
}
