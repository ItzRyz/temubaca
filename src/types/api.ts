export type ApiResponseSuccess<T> = {
    success: true;
    data: T;
    timestamp: string;
}

export type ApiResponseError = {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    },
    timestamp: string;
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;