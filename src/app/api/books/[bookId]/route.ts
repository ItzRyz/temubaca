import {
    apiSuccess,
    NotFoundError,
    parseParams,
    withApiHandler,
} from "@/lib/api";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { publicBookColumns } from "@/lib/db/queries/books";
import { bookIdSchema } from "@/lib/validation/schemas/book.schema";
import { eq } from "drizzle-orm";

type RouteContext = {
    params: Promise<{ bookId: string }>;
};

export const GET = withApiHandler(async (_request, context: RouteContext) => {
    const { bookId } = await parseParams(
        context.params,
        bookIdSchema,
    );
    const [book] = await db
        .select(publicBookColumns)
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);

    if (!book) {
        throw new NotFoundError("Book not found.");
    }

    return apiSuccess(book);
});
