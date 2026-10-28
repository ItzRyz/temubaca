import "server-only";

import { institutionKey, parseRecordLocation, parseSearchRss, repositoryOf, toIsbn13 } from "@/features/libraries/onesearch";

/**
 * Indonesia OneSearch lookups for TB-023: which libraries list a book, by ISBN-13. Off unless
 * ONESEARCH_ENABLED is true, which waits for Perpusnas's written permission (docs/LIBRARY_SOURCES_RESEARCH.md).
 * Requests identify TemuBaca, carry no user data, stay small (one search page, a few record pages, one at a
 * time), and run on the server only. A failure keeps what was known before.
 */

const BASE_URL = "https://onesearch.id";
const TIMEOUT_MS = 8_000;
/** Record pages fetched per lookup: one per repository, the busiest first. */
const MAX_RECORD_PAGES = 8;
const PAUSE_MS = 400;

export class OneSearchError extends Error {
    constructor(readonly kind: "disabled" | "no_isbn" | "timeout" | "blocked" | "unavailable", message: string) {
        super(message);
        this.name = "OneSearchError";
    }
}

export function isOneSearchEnabled() {
    return process.env.ONESEARCH_ENABLED === "true";
}

async function fetchText(url: string, userAgent: string, fetchImpl: typeof fetch) {
    let response: Response;
    try {
        response = await fetchImpl(url, { headers: { "user-agent": userAgent, accept: "text/html,application/rss+xml" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new OneSearchError(timedOut ? "timeout" : "unavailable", "OneSearch tidak dapat dihubungi.");
    }
    if (response.status === 403 || response.status === 429) throw new OneSearchError("blocked", `OneSearch menolak permintaan (${response.status}).`);
    if (!response.ok) throw new OneSearchError("unavailable", `OneSearch menjawab ${response.status}.`);
    return response.text();
}

/**
 * Libraries (by id) that OneSearch lists for this ISBN. `institutions` maps `institutionKey(name)` to a
 * TemuBaca library id; a record matches on its building or its institution.
 */
export async function findOneSearchHoldings(
    isbn: string | null,
    institutions: Map<string, string>,
    options: { userAgent: string; fetchImpl?: typeof fetch; pauseMs?: number },
) {
    if (!isOneSearchEnabled()) throw new OneSearchError("disabled", "Integrasi OneSearch belum diaktifkan.");
    const isbn13 = toIsbn13(isbn);
    if (!isbn13) throw new OneSearchError("no_isbn", "Buku ini tidak punya ISBN.");
    const fetchImpl = options.fetchImpl ?? fetch;

    const rss = await fetchText(`${BASE_URL}/Search/Results?lookfor=${isbn13}&type=ISN&view=rss`, options.userAgent, fetchImpl);
    const { recordIds } = parseSearchRss(rss);
    const byRepository = new Map<string, string[]>();
    for (const recordId of recordIds) byRepository.set(repositoryOf(recordId), [...(byRepository.get(repositoryOf(recordId)) ?? []), recordId]);
    const sample = [...byRepository.values()].sort((a, b) => b.length - a.length).slice(0, MAX_RECORD_PAGES).map((ids) => ids[0]);

    const found = new Map<string, { libraryId: string; sourceRecordId: string; sourceUrl: string }>();
    for (const [index, recordId] of sample.entries()) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, options.pauseMs ?? PAUSE_MS));
        const url = `${BASE_URL}/Record/${encodeURIComponent(recordId)}`;
        const location = parseRecordLocation(await fetchText(url, options.userAgent, fetchImpl));
        const libraryId = [location.building, location.institution].map((name) => name && institutions.get(institutionKey(name))).find(Boolean);
        if (libraryId && !found.has(libraryId)) found.set(libraryId, { libraryId, sourceRecordId: recordId, sourceUrl: url });
    }
    return [...found.values()];
}
