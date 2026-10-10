import { z } from "zod";

import {
    limitedInteger,
} from "./numbers";

export const paginationSchema =
    z
        .object({
            page: limitedInteger(1, 10_000)
                .default(1),

            limit: limitedInteger(1, 100)
                .default(20),
        })
        .strict();

export const offsetPaginationSchema =
    z
        .object({
            offset: limitedInteger(
                0,
                1_000_000,
            ).default(0),

            limit: limitedInteger(
                1,
                100,
            ).default(20),
        })
        .strict();

export type PaginationInput =
    z.infer<
        typeof paginationSchema
    >;

export function getPaginationOffset(
    input: PaginationInput,
) {
    return (input.page - 1) * input.limit;
}

export function getOffsetPagination(
    input: z.infer<
        typeof offsetPaginationSchema
    >,
) {
    return {
        offset: input.offset,
        limit: input.limit,
    };
}