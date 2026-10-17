export {
    BookProviderError,
    type BookCatalogProvider,
    type BookCatalogSearchResult,
    type BookProviderFailureKind,
    type ExternalBookProvider,
    type SearchBookCatalogInput,
} from "./provider";

export {
    normalizeExternalBook,
    normalizeExternalBooks,
} from "./normalize";

export { mergeBookMetadata, syncableBookFields, type StoredBookMetadata, type SyncableBookField } from "./merge";
export { languageLabel } from "./language";
export { createOpenLibraryProvider, mapOpenLibraryDoc } from "./open-library";
export { createGoogleBooksProvider, mapGoogleVolume } from "./google-books";
