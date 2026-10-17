import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import type { manualBookSchema } from "@/lib/validation/schemas/book.schema";
import type { z } from "zod";

type ManualBook = z.infer<typeof manualBookSchema>;

/**
 * Add a reader-entered book (Figma "Tambah Buku (Manual)" 159:833). An existing record with the same
 * ISBN, or the same title and first author ignoring case, is reused instead of creating a duplicate.
 */
export async function createManualBook(input: ManualBook) {
    if (input.isbn) {
        const sameIsbn = await db.query.books.findFirst({ where: eq(books.isbn, input.isbn), columns: { id: true } });
        if (sameIsbn) return { bookId: sameIsbn.id, created: false };
    }
    const sameTitle = await db.query.books.findFirst({
        where: and(
            sql`lower(${books.title}) = lower(${input.title})`,
            sql`lower(coalesce(${books.authors}[1], '')) = lower(${input.author})`,
        ),
        columns: { id: true },
    });
    if (sameTitle) return { bookId: sameTitle.id, created: false };

    const now = new Date();
    const [inserted] = await db.insert(books).values({
        provider: "MANUAL",
        providerId: `manual-${randomUUID()}`,
        isbn: input.isbn ?? null,
        title: input.title,
        authors: [input.author],
        publisher: input.publisher || null,
        publishedAt: input.publishedAt ?? null,
        categories: [input.category],
        createdAt: now,
        updatedAt: now,
    }).returning({ id: books.id });
    return { bookId: inserted.id, created: true };
}
