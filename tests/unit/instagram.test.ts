import { describe, expect, mock, test } from "bun:test";

import { instagramFollowersLabel, instagramNeedsRefresh } from "@/features/communities/instagram";

mock.module("server-only", () => ({}));
mock.module("@/env", () => ({ env: { INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000", INSTAGRAM_ACCESS_TOKEN: "test-token" } }));
const { fetchInstagramFollowers, followersFromResponse } = await import("@/lib/external/instagram");

describe("Instagram follower counts (Business Discovery)", () => {
    test("reads followers_count and rejects anything else", () => {
        expect(followersFromResponse({ business_discovery: { followers_count: 1234, id: "1" }, id: "2" })).toBe(1234);
        expect(followersFromResponse({ error: { message: "Invalid user id" } })).toBeNull();
        expect(followersFromResponse({ business_discovery: { followers_count: "1234" } })).toBeNull();
        expect(followersFromResponse(null)).toBeNull();
    });

    test("asks the Graph API for the handle with the token in a header, not the URL", async () => {
        let called: { url: string; auth: string | null } | null = null;
        const fake = (async (url: URL, init: RequestInit) => {
            called = { url: String(url), auth: new Headers(init.headers).get("authorization") };
            return Response.json({ business_discovery: { followers_count: 980 } });
        }) as unknown as typeof fetch;
        expect(await fetchInstagramFollowers("komunitas.baca", fake)).toBe(980);
        expect(called!.url).toBe("https://graph.facebook.com/v25.0/17841400000000000?fields=business_discovery.username%28komunitas.baca%29%7Bfollowers_count%7D");
        expect(called!.auth).toBe("Bearer test-token");
    });

    test("a personal account, an API error, or a network failure gives no count", async () => {
        const failing = (async () => Response.json({ error: { code: 110 } }, { status: 400 })) as unknown as typeof fetch;
        const offline = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
        expect(await fetchInstagramFollowers("akun.pribadi", failing)).toBeNull();
        expect(await fetchInstagramFollowers("akun.pribadi", offline)).toBeNull();
        expect(await fetchInstagramFollowers("bukan handle!", offline)).toBeNull();
    });

    test("refreshes daily and labels counts compactly", () => {
        const now = new Date("2026-10-29T12:00:00Z");
        expect(instagramNeedsRefresh({ instagramHandle: "baca", instagramCheckedAt: null }, now)).toBe(true);
        expect(instagramNeedsRefresh({ instagramHandle: "baca", instagramCheckedAt: new Date("2026-10-29T01:00:00Z") }, now)).toBe(false);
        expect(instagramNeedsRefresh({ instagramHandle: "baca", instagramCheckedAt: new Date("2026-10-28T11:00:00Z") }, now)).toBe(true);
        expect(instagramNeedsRefresh({ instagramHandle: null, instagramCheckedAt: null }, now)).toBe(false);
        expect(instagramFollowersLabel(12_345)?.replace(/\s/g, " ")).toBe("12,3 rb pengikut Instagram");
        expect(instagramFollowersLabel(null)).toBeNull();
    });
});
