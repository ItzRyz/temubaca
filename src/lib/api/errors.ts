import { API_ERROR_CODES } from "./error-codes";
import type { ApiErrorCode } from "./error-codes";

export type { ApiErrorCode } from "./error-codes";

export class ApiError extends Error {
    readonly code: ApiErrorCode;
    readonly status: number;
    readonly details?: unknown;

    constructor(
        code: ApiErrorCode,
        message: string,
        status: number,
        details?: unknown,
    ) {
        super(message);

        this.name = "ApiError";
        this.code = code;
        this.status = status;
        this.details = details;

        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class BadRequestError extends ApiError {
    constructor(
        message = "Bad request.",
        details?: unknown,
    ) {
        super(
            API_ERROR_CODES.BAD_REQUEST,
            message,
            400,
            details,
        );
    }
}

export class PayloadTooLargeError extends ApiError {
    constructor(
        message = "Request body is too large.",
    ) {
        super(
            API_ERROR_CODES.PAYLOAD_TOO_LARGE,
            message,
            413,
        );
    }
}

export class UnauthorizedError extends ApiError {
    constructor(
        message = "Authentication required.",
        details?: unknown,
    ) {
        super(
            API_ERROR_CODES.UNAUTHORIZED,
            message,
            401,
            details,
        );
    }
}

export class ForbiddenError extends ApiError {
    constructor(
        message = "You do not have permission to perform this action.",
        details?: unknown,
    ) {
        super(
            API_ERROR_CODES.FORBIDDEN,
            message,
            403,
            details,
        );
    }
}

export class NotFoundError extends ApiError {
    constructor(
        message = "Resource not found.",
        details?: unknown,
    ) {
        super(
            API_ERROR_CODES.NOT_FOUND,
            message,
            404,
            details,
        );
    }
}

export class ConflictError extends ApiError {
    constructor(
        message = "Resource conflict.",
        details?: unknown,
    ) {
        super(
            API_ERROR_CODES.CONFLICT,
            message,
            409,
            details,
        );
    }
}

export class ValidationError extends ApiError {
    constructor(
        message = "Request validation failed.",
        details?: unknown,
    ) {
        super(
            API_ERROR_CODES.BAD_REQUEST,
            message,
            400,
            details,
        );
    }
}

export class RateLimitError extends ApiError {
    constructor(
        message = "Too many requests.",
        details?: unknown,
    ) {
        super(
            API_ERROR_CODES.TOO_MANY_REQUESTS,
            message,
            429,
            details,
        );
    }
}

export class InternalServerError extends ApiError {
    constructor(
        message = "Internal server error.",
        details?: unknown,
    ) {
        super(
            API_ERROR_CODES.INTERNAL_SERVER_ERROR,
            message,
            500,
            details,
        );
    }
}

export function isApiError(
    error: unknown,
): error is ApiError {
    return error instanceof ApiError;
}
