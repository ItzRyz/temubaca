import { describe, expect, test } from "bun:test";

import { MlServiceError, recommendBooks } from "../../src/lib/ml/books";

const BOOK = "00000000-0000-4000-8000-000000000101";
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const valid = {
    recommendations: [{ book_id: BOOK, title: "Rumah Kaca", score: 0.42, reason: "Sesuai dengan minat: sejarah", source: "interest" as const }],
    unmatched_interests: ["horor"],
};

function capture(response: () => Response | Promise<Response>) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: URL | string, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return response();
    }) as typeof fetch;
    return { calls, fetchImpl };
}

async function kindOf(promise: Promise<unknown>) {
    try {
        await promise;
    } catch (error) {
        return error instanceof MlServiceError ? error.kind : "other";
    }
    return "none";
}

describe("ML Service client (TB-056)", () => {
    test("posts only the interests and top_n, and parses the contract", async () => {
        const { calls, fetchImpl } = capture(() => ok(valid));
        const result = await recommendBooks({ interests: ["Sejarah"], topN: 50 }, { url: "https://ml.example.test", fetchImpl });

        expect(calls[0].url).toBe("https://ml.example.test/api/recommendations/books");
        expect(calls[0].init.method).toBe("POST");
        expect(JSON.parse(String(calls[0].init.body))).toEqual({ user_interests: ["Sejarah"], top_n: 20 });
        expect(result).toEqual({ items: valid.recommendations, unmatchedInterests: ["horor"] });
    });

    test("sends the internal token only when a key is set", async () => {
        const withKey = capture(() => ok(valid));
        await recommendBooks({ interests: ["a"], topN: 5 }, { url: "https://ml.example.test", apiKey: "k".repeat(32), fetchImpl: withKey.fetchImpl });
        expect((withKey.calls[0].init.headers as Record<string, string>)["x-internal-token"]).toBe("k".repeat(32));

        const withoutKey = capture(() => ok(valid));
        await recommendBooks({ interests: ["a"], topN: 5 }, { url: "https://ml.example.test", fetchImpl: withoutKey.fetchImpl });
        expect(withoutKey.calls[0].init.headers as Record<string, string>).not.toHaveProperty("x-internal-token");
    });

    test("maps failures to error kinds", async () => {
        const call = (fetchImpl: typeof fetch, timeoutMs?: number) =>
            recommendBooks({ interests: ["a"], topN: 5 }, { url: "https://ml.example.test", fetchImpl, timeoutMs });

        expect(await kindOf(recommendBooks({ interests: ["a"], topN: 5 }, {}))).toBe("not_configured");
        expect(await kindOf(call(capture(() => new Response("down", { status: 503 })).fetchImpl))).toBe("unavailable");
        expect(await kindOf(call((async () => { throw new TypeError("network"); }) as unknown as typeof fetch))).toBe("unavailable");
        expect(await kindOf(call(capture(() => new Response("not json", { status: 200 })).fetchImpl))).toBe("invalid_response");
        expect(await kindOf(call(capture(() => ok({ recommendations: [{ ...valid.recommendations[0], book_id: 4712 }] })).fetchImpl))).toBe("invalid_response");

        const slow = ((_url: URL | string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        })) as typeof fetch;
        expect(await kindOf(call(slow, 20))).toBe("timeout");
    });
});
