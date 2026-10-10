import type { bookProviderValues } from "@/lib/db/schema";
import type { ExternalBook } from "@/lib/validation/schemas/book.schema";

export type ExternalBookProvider = Exclude<
    (typeof bookProviderValues)[number],
    "MANUAL" | "OTHER"
>;

export type SearchBookCatalogInput = {
    query: string;
    limit: number;
    offset: number;
};

export type BookCatalogSearchResult = {
    items: ExternalBook[];
    total: number;
};

/** Provider adapters return only normalized, validated book metadata. */
export interface BookCatalogProvider {
    readonly id: ExternalBookProvider;
    search(input: SearchBookCatalogInput): Promise<BookCatalogSearchResult>;
    getById(providerId: string): Promise<ExternalBook | null>;
}

export type BookProviderFailureKind =
    | "timeout"
    | "rate_limit"
    | "unavailable"
    | "invalid_response";

export class BookProviderError extends Error {
    constructor(
        readonly provider: ExternalBookProvider,
        readonly kind: BookProviderFailureKind,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = "BookProviderError";
    }
}
