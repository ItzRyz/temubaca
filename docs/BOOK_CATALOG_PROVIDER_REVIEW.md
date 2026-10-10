# TemuBaca Book Catalog Provider Review

**Status:** evaluation in progress; no provider selected  
**Reviewed:** 2026-10-09  
**Decision:** `DEC-06` remains open

## Scope

This review compares the Open Library and Google Books API candidates named in the project documents. It does not authorize production integration or make a product decision. The `/books` experience continues to search TemuBaca's local catalog until the provider is selected and its terms, sample coverage, and fallback behavior are reviewed.

## Candidate comparison

| Candidate | Documented capabilities and operating constraints | Open questions for TemuBaca |
|---|---|---|
| Open Library | Search and lookup APIs support public book discovery. Open Library asks applications to identify themselves with a `User-Agent` and contact, cache responses, and keep requests human-facing. Its published default rate is 1 request/second, or 3 requests/second for identified requests. It says the API is not intended as a third-party data backend or high-traffic commercial infrastructure. | A small live title sample found multiple Indonesian-language matches (see below); ISBN coverage, metadata quality, caching requirements, and acceptable production traffic still need review. Cover guidance asks public-facing pages to point directly at `covers.openlibrary.org` and appreciates a link back. |
| Google Books | Public volume search and lookup do not require user OAuth. Search supports paging, with up to 40 results per request. An API key can be used for public data. The response includes structured metadata and may include viewability or sales fields that TemuBaca does not need. | The anonymous sample requests returned HTTP 429, so Indonesian catalog coverage remains unmeasured. Review current quota, API-key restrictions, display/attribution requirements, cover URL behavior, content removal obligations, and which response fields may be retained in PostgreSQL. Google also states that its Books API is not intended to replace commercial services; whether TemuBaca's eventual scope fits requires owner review. |

## Live title sample

Four public title searches were run on 2026-10-09, requesting at most ten records per query. `Title match` counts returned titles containing the query phrase (case-insensitive). `Language id` counts returned Open Library records tagged with the Indonesian language code `ind`; it is an API metadata field, not a manual language-quality review.

| Query | Open Library total reported | Returned | Title match | Language `ind` | Google Books |
|---|---:|---:|---:|---:|---|
| Laskar Pelangi | 8 | 8 | 5 | 6 | HTTP 429 |
| Bumi Manusia | 40 | 10 | 7 | 7 | HTTP 429 |
| Cantik Itu Luka | 4 | 4 | 2 | 2 | HTTP 429 |
| Negeri 5 Menara | 4 | 4 | 2 | 2 | HTTP 429 |

This is a small title-only smoke sample, not a representative coverage benchmark. Google Books' 429 responses do not demonstrate lack of catalog coverage; quota/key conditions need to be checked before comparing it with Open Library.

## Evidence and limits

- Open Library documents its API scope, caching and identification guidance, and request rates in its [API usage guidelines](https://openlibrary.org/developers/api).
- The Open Library [Search API documentation](https://openlibrary.org/dev/docs/api/search) describes `search.json` and its search response.
- Open Library's [cover-use guidance](https://openlibrary.org/dev/docs/api/covers) describes the public cover URL and courtesy-link expectations; its [licensing page](https://openlibrary.org/developers/licensing) notes that existing rights issues may apply to contributions.
- Google documents public volume search and pagination in the [Volumes: list reference](https://developers.google.com/books/docs/v1/reference/volumes/list) and [API usage guide](https://developers.google.com/books/docs/v1/using).
- Google's [Books API terms](https://developers.google.com/books/terms) and [branding guidance](https://developers.google.com/books/branding) require a separate review of application fees, content removal, attribution, and display behavior before integration.
- These sample results do not establish contractual suitability, full Indonesian-title/ISBN coverage, metadata quality, or production quotas. Those checks remain part of `DEC-06`.

## Required evaluation before selecting a provider

1. Run the same Indonesian test set against each candidate (including ISBNs, title-only entries, author names, and alternate spellings) and record hit rate and metadata completeness.
2. Review current provider terms, attribution, caching, key handling, cover use, and retention rules with the project owner.
3. Confirm expected traffic, quota behavior, timeout handling, and a usable local-catalog fallback.
4. Record the chosen provider, rejected options, owner, date, and consequences in `DECISIONS.md` before adding provider credentials or enabling external requests.

## Code preparation

The provider-neutral interface and canonical metadata validator live in `src/lib/external/books/`. They do not issue network requests, select a provider, or write provider data to the database.
