import "server-only";

import { env } from "@/env";

import { createGoogleBooksProvider } from "./google-books";
import { createOpenLibraryProvider } from "./open-library";
import type { BookCatalogProvider, ExternalBookProvider } from "./provider";

/** Both adapters (owner decision, see DEC-06); which one leads is an admin setting (`catalog` in app_settings). */
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
