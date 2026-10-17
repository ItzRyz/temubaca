import { BookProviderError, type ExternalBookProvider } from "./provider";

const DEFAULT_TIMEOUT_MS = 8_000;

/** GET a provider JSON endpoint with a timeout, mapping transport failures to `BookProviderError`. */
export async function fetchProviderJson(
    provider: ExternalBookProvider,
    url: URL,
    init: { headers?: Record<string, string>; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<unknown | null> {
    const fetchImpl = init.fetchImpl ?? fetch;
    let response: Response;
    try {
        response = await fetchImpl(url, {
            headers: { accept: "application/json", ...init.headers },
            signal: AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
            cache: "no-store",
        });
    } catch (error) {
        const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new BookProviderError(provider, timedOut ? "timeout" : "unavailable", `${provider} request failed.`, { cause: error });
    }

    if (response.status === 404) return null;
    if (response.status === 429) throw new BookProviderError(provider, "rate_limit", `${provider} rate limit reached.`);
    if (!response.ok) throw new BookProviderError(provider, "unavailable", `${provider} responded with ${response.status}.`);

    try {
        return await response.json();
    } catch (error) {
        throw new BookProviderError(provider, "invalid_response", `${provider} returned invalid JSON.`, { cause: error });
    }
}
