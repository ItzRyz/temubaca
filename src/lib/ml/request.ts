/**
 * Shared ML Service HTTP core without env access, so tests can drive it directly.
 * App code imports `./client`, which supplies the configured URL and key.
 */
import type { z } from "zod";

const DEFAULT_TIMEOUT_MS = 3_000;
/** The ML Service accepts at most 20 results per request (DEC-08). */
export const ML_MAX_TOP_N = 20;

export type MlServiceErrorKind = "not_configured" | "timeout" | "unavailable" | "invalid_response";

export class MlServiceError extends Error {
    constructor(readonly kind: MlServiceErrorKind, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "MlServiceError";
    }
}

export type MlServiceConfig = {
    url?: string;
    apiKey?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
};

/** POSTs `body` to an ML Service path and validates the reply; throws `MlServiceError` so callers can fall back. */
export async function postToMlService<T>(path: string, body: unknown, schema: z.ZodType<T>, config: MlServiceConfig): Promise<T> {
    if (!config.url) throw new MlServiceError("not_configured", "RECOMMENDATION_API_URL is not set.");

    const fetchImpl = config.fetchImpl ?? fetch;
    const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
    if (config.apiKey) headers["x-internal-token"] = config.apiKey;

    let response: Response;
    try {
        response = await fetchImpl(new URL(path, config.url), {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
            cache: "no-store",
        });
    } catch (error) {
        const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new MlServiceError(timedOut ? "timeout" : "unavailable", "ML Service request failed.", { cause: error });
    }

    if (!response.ok) throw new MlServiceError("unavailable", `ML Service responded with ${response.status}.`);

    let json: unknown;
    try {
        json = await response.json();
    } catch (error) {
        throw new MlServiceError("invalid_response", "ML Service returned invalid JSON.", { cause: error });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new MlServiceError("invalid_response", "ML Service response did not match the contract.");
    return parsed.data;
}
