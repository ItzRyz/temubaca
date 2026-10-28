import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { env } from "@/env";
import { db } from "@/lib/db";
import { replaceOneSearchHoldings, oneSearchInstitutions } from "@/lib/db/queries/libraries";
import { books } from "@/lib/db/schema";
import { findOneSearchHoldings, isOneSearchEnabled, OneSearchError } from "@/lib/external/libraries/onesearch";

import { needsOneSearchRefresh } from "./access";
import { institutionKey } from "./onesearch";

const userAgent = () => `TemuBaca/0.1 (+${env.NEXT_PUBLIC_APP_URL}; pustaka)`;

/**
 * Asks OneSearch which libraries list a book and replaces its OneSearch holdings (TB-023). The book is
 * claimed first with a conditional update, so concurrent page views ask once; `force` (admin) skips the
 * 30-day wait. On failure the old holdings and the old check time stay, and only the failure kind is logged.
 */
export async function syncOneSearchForBook(bookId: string, options: { force?: boolean } = {}) {
    if (!isOneSearchEnabled()) return { status: "disabled" as const };
    const now = new Date();
    const [book] = await db.select({ isbn: books.isbn, checkedAt: books.librariesCheckedAt }).from(books).where(eq(books.id, bookId));
    if (!book) return { status: "not_found" as const };
    if (!options.force && !needsOneSearchRefresh(book.checkedAt, now)) return { status: "fresh" as const };
    // Only the request that moves the stamp from the value it read goes on.
    const [claimed] = await db
        .update(books)
        .set({ librariesCheckedAt: now })
        .where(and(eq(books.id, bookId), sql`${books.librariesCheckedAt} is not distinct from ${book.checkedAt?.toISOString() ?? null}::timestamptz`))
        .returning({ id: books.id });
    if (!claimed) return { status: "fresh" as const };

    try {
        const institutions = new Map([...(await oneSearchInstitutions())].map(([name, libraryId]) => [institutionKey(name), libraryId]));
        if (institutions.size === 0) return { status: "no_libraries" as const };
        const found = await findOneSearchHoldings(book.isbn, institutions, { userAgent: userAgent() });
        const result = await replaceOneSearchHoldings(bookId, found);
        return { status: "synced" as const, holdings: result.holdings };
    } catch (error) {
        const kind = error instanceof OneSearchError ? error.kind : "unavailable";
        // A book without an ISBN cannot be looked up; keep the stamp so it is not tried on every view.
        if (kind !== "no_isbn") await db.update(books).set({ librariesCheckedAt: book.checkedAt }).where(eq(books.id, bookId));
        console.error("[ONESEARCH_SYNC]", { kind });
        return { status: "failed" as const, kind };
    }
}
