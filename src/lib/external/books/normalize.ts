import {
    externalBookSchema,
    type ExternalBook,
} from "@/lib/validation/schemas/book.schema";

/** Validate the canonical shape produced by a provider-specific adapter. */
export function normalizeExternalBook(input: unknown): ExternalBook {
    return externalBookSchema.parse(input);
}

/** Like `normalizeExternalBook`, but drops records a provider returned in an unusable shape. */
export function tryNormalizeExternalBook(input: unknown): ExternalBook | null {
    const parsed = externalBookSchema.safeParse(input);
    return parsed.success ? parsed.data : null;
}

export function normalizeExternalBooks(input: unknown[]): ExternalBook[] {
    return input.map(normalizeExternalBook);
}
