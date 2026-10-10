import "server-only";

import {
    ApiError,
    InternalServerError,
} from "./errors";
import { apiError } from "./response";
import { logApiError } from "@/lib/logging";

type RouteContext<
    TParams extends Record<string, string> = Record<
        string,
        string
    >,
> = {
    params: Promise<TParams>;
};

type RouteHandler<
    TParams extends Record<string, string> = Record<
        string,
        string
    >,
> = (
    request: Request,
    context: RouteContext<TParams>,
) => Promise<Response> | Response;

export function withApiHandler<
    TParams extends Record<string, string> = Record<
        string,
        string
    >,
>(
    handler: RouteHandler<TParams>,
): RouteHandler<TParams> {
    return async (request, context) => {
        try {
            return await handler(request, context);
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                return apiError(error);
            }

            logApiError({
                method: request.method,
                pathname: new URL(request.url).pathname,
                errorName:
                    error instanceof Error
                        ? error.name
                        : "UnknownError",
            });

            return apiError(new InternalServerError());
        }
    };
}
