type ApiErrorLogEntry = {
    method: string;
    pathname: string;
    errorName: string;
};

/** Log only request metadata; never include error messages, stacks, or payloads. */
export function logApiError(entry: ApiErrorLogEntry) {
    console.error("[API_ERROR]", {
        method: entry.method,
        pathname: entry.pathname,
        errorName: entry.errorName,
    });
}
