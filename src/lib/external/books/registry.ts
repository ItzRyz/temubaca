import "server-only";

import { env } from "@/env";

import { createGoogleBooksProvider } from "./google-books";
import { createOpenLibraryProvider } from "./open-library";
import type { BookCatalogProvider, ExternalBookProvider } from "./provider";

/** Open Library is the primary catalog; Google Books complements it (owner decision, see DEC-06). */
export const PRIMARY_BOOK_PROVIDER: ExternalBookProvider = "OPEN_LIBRARY";

let providers: Record<ExternalBookProvider, BookCatalogProvider> | undefined;

export function getBookProviders() {
    providers ??= {
        OPEN_LIBRARY: createOpenLibraryProvider({
            baseUrl: env.OPEN_LIBRARY_BASE_URL,
            userAgent: `TemuBaca/0.1 (+${env.NEXT_PUBLIC_APP_URL})`,
        }),
        GOOGLE_BOOKS: createGoogleBooksProvider({ apiKey: env.GOOGLE_BOOKS_API_KEY }),
    };
    return providers;
}

export function hasGoogleBooksKey() {
    return Boolean(env.GOOGLE_BOOKS_API_KEY);
}
