import { describe, expect, test } from "bun:test";

import { communityReason, locationScore, rankCommunities, sharedInterests } from "../../src/features/recommendations/community-matching";
import { MlServiceError, recommendBooks } from "../../src/lib/ml/books";
import { recommendCommunities } from "../../src/lib/ml/communities";

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

describe("ML Service community client (TB-060)", () => {
    const COMMUNITY = "00000000-0000-4000-8000-000000000201";
    const community = {
        community_id: COMMUNITY, name: "Lingkar Puisi", region_code: "36.74", region_name: "Kota Tangerang Selatan",
        interest_score: 0.5, location_score: 1, score: 0.65, reason: "Sesuai dengan minat: puisi dan berada di Kota Tangerang Selatan",
    };

    test("posts only interests, a known kab/kota, and top_n, and parses the contract", async () => {
        const { calls, fetchImpl } = capture(() => ok({ recommendations: [community], unmatched_interests: [], notice: null }));
        const result = await recommendCommunities({ interests: ["Puisi"], regionCode: "36.74", topN: 50 }, { url: "https://ml.example.test", fetchImpl });

        expect(calls[0].url).toBe("https://ml.example.test/api/recommendations/communities");
        expect(JSON.parse(String(calls[0].init.body))).toEqual({ user_interests: ["Puisi"], user_region_code: "36.74", top_n: 20 });
        expect(result).toEqual({ items: [community], unmatchedInterests: [], notice: null });
    });

    test("leaves out a missing or unknown region code instead of failing the request", async () => {
        for (const regionCode of [null, "36.99", "36"]) {
            const { calls, fetchImpl } = capture(() => ok({ recommendations: [], notice: "NO_MATCH" }));
            const result = await recommendCommunities({ interests: ["Puisi"], regionCode, topN: 3 }, { url: "https://ml.example.test", fetchImpl });
            expect(JSON.parse(String(calls[0].init.body))).toEqual({ user_interests: ["Puisi"], top_n: 3 });
            expect(result.notice).toBe("NO_MATCH");
        }
    });

    test("rejects demo ids and unknown notices", async () => {
        const call = (body: unknown) => recommendCommunities({ interests: ["Puisi"], regionCode: null, topN: 3 }, { url: "https://ml.example.test", fetchImpl: capture(() => ok(body)).fetchImpl });
        expect(await kindOf(call({ recommendations: [{ ...community, community_id: "C001" }] }))).toBe("invalid_response");
        expect(await kindOf(call({ recommendations: [], notice: "SOMETHING_ELSE" }))).toBe("invalid_response");
    });
});

describe("community matching rules (TB-060)", () => {
    test("location follows the kab/kota, then the province", () => {
        expect(locationScore("36.74", "36.74")).toBe(1);
        expect(locationScore("36.74", "36.71")).toBe(0.5);
        expect(locationScore("36.74", "32.73")).toBe(0);
        expect(locationScore(null, "36.74")).toBe(0);
        expect(locationScore("36.99", "36.74")).toBe(0);
    });

    test("reasons name shared tags and only the community's region", () => {
        expect(sharedInterests([" sastra  indonesia", "Puisi"], ["Puisi", "Sastra Indonesia", "Sejarah"])).toEqual(["Puisi", "Sastra Indonesia"]);
        expect(communityReason(["Puisi"], 1, "36.74")).toBe("Sesuai minat: Puisi · Di Kota Tangerang Selatan");
        expect(communityReason([], 0.5, "36.71")).toBe("Di provinsi Banten");
        expect(communityReason(["Puisi"], 0, "32.73")).toBe("Sesuai minat: Puisi");
    });

    test("ranking weighs tags 0.7 and location 0.3 and drops zero scores", () => {
        const ranked = rankCommunities(["Puisi", "Sejarah"], "36.74", [
            { id: "b", interests: ["Romansa"], regionCode: "36.71" },
            { id: "a", interests: ["Puisi"], regionCode: "32.73" },
            { id: "c", interests: ["Romansa"], regionCode: "32.73" },
            { id: "d", interests: ["Puisi", "Sejarah"], regionCode: "36.74" },
        ]);
        expect(ranked.map((item) => [item.community.id, Number(item.score.toFixed(4))])).toEqual([["d", 1], ["a", 0.495], ["b", 0.15]]);
    });
});
