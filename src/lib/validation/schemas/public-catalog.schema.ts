import { z } from "zod";

import { paginationSchema } from "../pagination";

export const publicCommunityQuerySchema = paginationSchema.extend({
    q: z.string().trim().max(100).optional(),
}).strict();

export const publicEventQuerySchema = paginationSchema;
