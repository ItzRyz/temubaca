import {
    apiSuccess,
    createPaginationMeta,
    parseQuery,
    withApiHandler,
} from "@/lib/api";
import {
    countBooksMatchingQuery,
    searchBooks,
} from "@/lib/db/queries/books";
import { bookSearchQuerySchema } from "@/lib/validation/schemas/book.schema";

export const GET = withApiHandler(async (request) => {
    const query = parseQuery(request, bookSearchQuerySchema);
    const offset = (query.page - 1) * query.limit;

    const [books, total] = await Promise.all([
        searchBooks(query.q, query.limit, offset),
        countBooksMatchingQuery(query.q),
    ]);

    return apiSuccess(
        books,
        200,
        createPaginationMeta(query.page, query.limit, total),
    );
});
