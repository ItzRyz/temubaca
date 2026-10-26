import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { MlServiceError, recommendBooks } from "../../src/lib/ml/books";
import { recommendCommunities } from "../../src/lib/ml/communities";
import { requestRoute } from "../../src/lib/ml/routes";

// Frozen request/response pairs from the ML Service repo (tests/contract/, ML-T10), copied here byte for byte.
// The ML Service test proves it gives exactly these replies; this one proves src/lib/ml sends exactly these
// requests and accepts these replies. After a contract change, regenerate there and copy the files over.
type Contract = { path: string; request: Record<string, unknown>; status: number; response: unknown };

const DIR = resolve(import.meta.dir, "../fixtures/ml-contract");
const contract = (name: string) => JSON.parse(readFileSync(resolve(DIR, `${name}.json`), "utf8")) as Contract;
const ML_URL = "https://ml.example.test";

/** Replies with the contract's response and records the request the client made. */
function serve(c: Contract) {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: URL | string, init?: RequestInit) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify(c.response), { status: c.status, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    return { calls, config: { url: ML_URL, fetchImpl } };
}

function expectSent(c: Contract, calls: { url: string; body: unknown }[]) {
    expect(calls).toEqual([{ url: `${ML_URL}${c.path}`, body: c.request }]);
}

describe("ML Service contract (ML-T10)", () => {
    test("every fixture is covered here", () => {
        expect(readdirSync(DIR).sort()).toEqual(["books.json", "communities-no-match.json", "communities.json", "route-out-of-coverage.json", "route.json"]);
    });

    test("book recommendations", async () => {
        const c = contract("books");
        const { calls, config } = serve(c);
        const result = await recommendBooks({ interests: ["Romansa", "Robot Luar Angkasa"], topN: 3 }, config);
        const response = c.response as { recommendations: unknown[]; unmatched_interests: string[] };

        expectSent(c, calls);
        expect(result).toEqual({ items: response.recommendations, unmatchedInterests: response.unmatched_interests } as never);
    });

    test("community recommendations, with and without a match", async () => {
        for (const [name, input] of [
            ["communities", { interests: ["Puisi"], regionCode: "36.74", topN: 3 }],
            ["communities-no-match", { interests: ["Robot Luar Angkasa"], regionCode: null, topN: 3 }],
        ] as const) {
            const c = contract(name);
            const { calls, config } = serve(c);
            const result = await recommendCommunities({ ...input, interests: [...input.interests] }, config);
            const response = c.response as { recommendations: unknown[]; unmatched_interests: string[]; notice: string | null };

            expectSent(c, calls);
            expect(result).toEqual({ items: response.recommendations, unmatchedInterests: response.unmatched_interests, notice: response.notice } as never);
        }
    });

    test("a route", async () => {
        const c = contract("route");
        const { calls, config } = serve(c);
        const route = await requestRoute({ origin: { latitude: -6.19, longitude: 106.83 }, destination: { latitude: -6.192, longitude: 106.832 }, mode: "drive" }, config);

        expectSent(c, calls);
        // The site does not use `algorithm`; the schema drops it and keeps every other field.
        const { algorithm, ...used } = c.response as Record<string, unknown>;
        expect(algorithm).toBe("dijkstra");
        expect(route).toEqual(used as never);
    });

    test("a routing error keeps its status and code", async () => {
        const c = contract("route-out-of-coverage");
        const { calls, config } = serve(c);
        const error = await requestRoute({ origin: { latitude: -6.19, longitude: 106.83 }, destination: { latitude: -6.9175, longitude: 107.6191 }, mode: "drive" }, config)
            .then(() => null, (reason: unknown) => reason);

        expectSent(c, calls);
        expect(error).toBeInstanceOf(MlServiceError);
        expect([(error as MlServiceError).status, (error as MlServiceError).code]).toEqual([c.status, "OUT_OF_COVERAGE"]);
    });
});
