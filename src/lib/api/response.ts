// src/lib/api/response.ts

import { NextResponse } from "next/server";

import type {
    ApiErrorResponse,
    ApiMeta,
    ApiSuccess,
} from "./types";

import { ApiError } from "./errors";

export function apiSuccess<T>(
    data: T,
    status = 200,
    meta?: ApiMeta,
) {
    const response: ApiSuccess<T> = {
        success: true,
        data,
        ...(meta ? { meta } : {}),
    };

    return NextResponse.json(response, {
        status,
    });
}

export function apiCreated<T>(
    data: T,
    meta?: ApiMeta,
) {
    return apiSuccess(data, 201, meta);
}

export function apiNoContent() {
    return new Response(null, {
        status: 204,
    });
}

export function apiError(
    error: ApiError,
) {
    const response: ApiErrorResponse = {
        success: false,
        error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined
                ? {
                    details: error.details,
                }
                : {}),
        },
    };

    return NextResponse.json(response, {
        status: error.status,
    });
}