import { z } from "zod";

import {
    bookIdParamSchema,
} from "../common";

export const createBookmarkSchema =
    z
        .object({
            bookId: z.uuid(),
        })
        .strict();

export const bookmarkBookIdSchema =
    bookIdParamSchema;