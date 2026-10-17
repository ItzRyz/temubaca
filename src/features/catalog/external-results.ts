import type { ExternalBook } from "@/lib/validation/schemas/book.schema";

export type ExternalSearchFailure = "timeout" | "rate_limit" | "unavailable" | "invalid_response";

function normalized(value: string | undefined) {
    return (value ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Same ISBN, or same main title and first author, counts as the same book. */
export function sameExternalBook(a: Pick<ExternalBook, "isbn" | "title" | "authors">, b: Pick<ExternalBook, "isbn" | "title" | "authors">) {
    if (a.isbn && b.isbn) return a.isbn === b.isbn;
    return normalized(a.title.split(":")[0]) === normalized(b.title.split(":")[0])
        && normalized(a.authors[0]) === normalized(b.authors[0]);
}

/**
 * Primary results first; a secondary result is kept only when it adds a book the primary did not
 * return. Duplicates inside one provider are dropped too.
 */
export function mergeExternalResults(primary: ExternalBook[], secondary: ExternalBook[], limit: number) {
    const merged: ExternalBook[] = [];
    for (const book of [...primary, ...secondary]) {
        if (!merged.some((existing) => sameExternalBook(existing, book))) merged.push(book);
        if (merged.length >= limit) break;
    }
    return merged;
}

/** What the catalog page says when nothing usable came back. */
export function externalSearchNotice(input: { itemCount: number; failures: ExternalSearchFailure[]; providerCount: number }) {
    if (input.itemCount > 0) return null;
    if (input.failures.length === 0) return "empty" as const;
    if (input.failures.length < input.providerCount) return "empty" as const;
    if (input.failures.every((failure) => failure === "rate_limit")) return "rate_limit" as const;
    if (input.failures.every((failure) => failure === "timeout")) return "timeout" as const;
    return "unavailable" as const;
}
