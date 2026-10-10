import type { ZodType } from "zod";

import { ValidationError } from "./errors";
import { parseJsonBody } from "./request";

export function validate<T>(
    schema: ZodType<T>,
    input: unknown,
): T {
    const result = schema.safeParse(input);

    if (!result.success) {
        throw new ValidationError(
            "Request validation failed.",
            result.error.flatten(),
        );
    }

    return result.data;
}

export async function parseBody<T>(
    request: Request,
    schema: ZodType<T>,
): Promise<T> {
    const body = await parseJsonBody(request);

    return validate(schema, body);
}

export function parseQuery<T>(
    request: Request,
    schema: ZodType<T>,
): T {
    const url = new URL(request.url);

    const query: Record<string, string | string[]> = {};

    for (const [key, value] of url.searchParams.entries()) {
        const existing = query[key];

        if (existing === undefined) {
            query[key] = value;
            continue;
        }

        if (Array.isArray(existing)) {
            existing.push(value);
            continue;
        }

        query[key] = [existing, value];
    }

    return validate(schema, query);
}

export async function parseParams<
    TParams extends Record<string, string>,
    TResult,
>(
    params: Promise<TParams>,
    schema: ZodType<TResult>,
): Promise<TResult> {
    const resolvedParams = await params;

    return validate(
        schema,
        resolvedParams,
    );
}

export function parseInput<T>(
    input: unknown,
    schema: ZodType<T>,
): T {
    return validate(schema, input);
}

export function parseQueryParam<T>(
    request: Request,
    name: string,
    schema: ZodType<T>,
): T {
    const url = new URL(request.url);

    const value = url.searchParams.get(name);

    return validate(schema, value);
}

export async function parseRouteParam<
    TParams extends Record<string, string>,
    TResult,
>(
    params: Promise<TParams>,
    name: keyof TParams,
    schema: ZodType<TResult>,
): Promise<TResult> {
    const resolvedParams = await params;

    return validate(
        schema,
        resolvedParams[name],
    );
}