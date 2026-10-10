import {
    externalBookSchema,
    type ExternalBook,
} from "@/lib/validation/schemas/book.schema";

/** Validate the canonical shape produced by a provider-specific adapter. */
export function normalizeExternalBook(input: unknown): ExternalBook {
    return externalBookSchema.parse(input);
}

export function normalizeExternalBooks(input: unknown[]): ExternalBook[] {
    return input.map(normalizeExternalBook);
}
