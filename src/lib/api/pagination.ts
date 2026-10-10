import { paginationSchema } from "@/lib/validation";

import type { PaginationInput } from "./types";

export function parsePagination(
    searchParams: URLSearchParams,
): PaginationInput {
    const parsed = paginationSchema.parse({
        page: searchParams.get("page") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
    });

    return {
        page: parsed.page,
        limit: parsed.limit,
        offset: (parsed.page - 1) * parsed.limit,
    };
}

export function createPaginationMeta(
    page: number,
    limit: number,
    total: number,
) {
    const totalPages = Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
}