import type { ApiErrorCode } from "./errors";

export interface ApiSuccess<T> {
    success: true;
    data: T;
    meta?: ApiMeta;
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: ApiErrorCode;
        message: string;
        details?: unknown;
    };
}

export type ApiResponse<T> =
    | ApiSuccess<T>
    | ApiErrorResponse;

export interface ApiMeta {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
}

export interface PaginationInput {
    page: number;
    limit: number;
    offset: number;
}

export interface RouteContext<
    TParams extends Record<string, string> = Record<
        string,
        string
    >,
> {
    params: Promise<TParams>;
}

export type ApiHandler<
    TParams extends Record<string, string> = Record<
        string,
        string
    >,
> = (
    request: Request,
    context: RouteContext<TParams>,
) => Response | Promise<Response>;