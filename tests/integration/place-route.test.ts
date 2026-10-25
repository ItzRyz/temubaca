import { afterAll, beforeAll, beforeEach, describe, expect, mock, setDefaultTimeout, spyOn, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";
import { MlServiceError } from "../../src/lib/ml/request";

// POST /api/places/[placeId]/route against an in-memory Postgres with every migration applied;
// only the ML Service, the rate limiter, and the client address are stubbed (TB-064).
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));
mock.module(resolve(import.meta.dir, "../../src/features/catalog/client-ip.ts"), () => ({ clientIp: async () => "203.0.113.9" }));

const limiter = { allow: true };
mock.module(resolve(import.meta.dir, "../../src/lib/rate-limit/provider.ts"), () => ({
    enforceRateLimit: async () => ({ success: limiter.allow, limit: 30, remaining: 0, reset: 0 }),
    rateLimitProvider: { limit: async () => ({ success: true }) },
}));

type RouteInput = { origin: { latitude: number; longitude: number }; destination: { latitude: number; longitude: number }; mode: string };
const ml = { configured: true, calls: [] as RouteInput[], respond: async (): Promise<unknown> => route };
mock.module(resolve(import.meta.dir, "../../src/lib/ml/client.ts"), () => ({
    ML_MAX_TOP_N: 20,
    MlServiceError,
    isMlServiceConfigured: () => ml.configured,
    recommendBooks: async () => ({ items: [], unmatchedInterests: [] }),
    recommendCommunities: async () => ({ items: [], notice: null }),
    routeBetween: async (input: RouteInput) => {
        ml.calls.push(input);
        return ml.respond();
    },
}));

setDefaultTimeout(60_000);

const LIBRARY = "00000000-0000-4000-8000-000000000301";
const HIDDEN = "00000000-0000-4000-8000-000000000302";
const READER = { latitude: -6.176, longitude: 106.8225 };
const route = {
    mode: "drive", distance_m: 9040, duration_s_estimate: 1140,
    geometry: { type: "LineString", coordinates: [[106.822759, -6.174613], [106.800827, -6.243235]] },
    via_streets: ["Jalan Mohammad Husni Thamrin"], snap: { origin_offset_m: 156, destination_offset_m: 119 },
    warnings: ["ESTIMATE_NO_TRAFFIC"], algorithm: "dijkstra", graph_version: "jakarta-tangerang-drive-2026-10-25",
};

let POST: typeof import("../../src/app/api/places/[placeId]/route/route").POST;

async function ask(placeId: string, body: unknown) {
    const response = await POST(
        new Request(`http://localhost/api/places/${placeId}/route`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
        { params: Promise.resolve({ placeId }) },
    );
    return { status: response.status, json: await response.json() as { success: boolean; data?: Record<string, unknown>; error?: { code: string } } };
}

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
            await pg.exec(statement);
        }
    }
    await testDb.insert(schema.places).values([
        { id: LIBRARY, type: "LIBRARY", name: "Perpustakaan Nasional", addressPublic: "Jl. Medan Merdeka Selatan", regionCode: "31.71", latitude: -6.1815, longitude: 106.8272 },
        { id: HIDDEN, type: "LIBRARY", name: "Titik keliru", addressPublic: "Tempat umum", regionCode: "31.71", latitude: -6.2, longitude: 106.8, hiddenAt: new Date(), hiddenReason: "Alamat keliru" },
    ]);
    ({ POST } = await import("../../src/app/api/places/[placeId]/route/route"));
});

afterAll(async () => {
    await pg.close();
});

beforeEach(() => {
    ml.configured = true;
    ml.calls = [];
    ml.respond = async () => route;
    limiter.allow = true;
});

describe("POST /api/places/[placeId]/route (TB-064)", () => {
    test("routes from the reader's point to the public place and links Google Maps", async () => {
        const { status, json } = await ask(LIBRARY, { origin: READER, mode: "walk" });

        expect(status).toBe(200);
        expect(json.data).toEqual({
            outcome: "ROUTE",
            externalUrl: "https://www.google.com/maps/search/?api=1&query=-6.1815%2C106.8272",
            route: {
                mode: "drive", distanceM: 9040, durationS: 1140, coordinates: route.geometry.coordinates,
                viaStreets: ["Jalan Mohammad Husni Thamrin"], warnings: ["ESTIMATE_NO_TRAFFIC"], graphVersion: "jakarta-tangerang-drive-2026-10-25",
            },
        });
        // The destination comes from the database, never from the request.
        expect(ml.calls).toEqual([{ origin: READER, destination: { latitude: -6.1815, longitude: 106.8272 }, mode: "walk" }]);
    });

    test("a point the graph does not cover is an outcome with a message, not an error", async () => {
        ml.respond = async () => {
            throw new MlServiceError("unavailable", "ML Service responded with 422.", { status: 422, code: "OUT_OF_COVERAGE" });
        };
        const { status, json } = await ask(LIBRARY, { origin: READER, mode: "drive" });

        expect(status).toBe(200);
        expect(json.data?.outcome).toBe("OUT_OF_COVERAGE");
        expect(json.data?.message).toContain("Jakarta dan Tangerang");
        expect(json.data?.externalUrl).toContain("google.com/maps");
    });

    test("a timeout is unavailable, and the log names the failure without the reader's point", async () => {
        ml.respond = async () => {
            throw new MlServiceError("timeout", "ML Service request failed.");
        };
        const logged = spyOn(console, "error").mockImplementation(() => {});
        const { json } = await ask(LIBRARY, { origin: READER, mode: "drive" });
        const lines = JSON.stringify(logged.mock.calls);
        logged.mockRestore();

        expect(json.data?.outcome).toBe("UNAVAILABLE");
        expect(lines).toContain("timeout");
        expect(lines).not.toContain("6.176");
        expect(lines).not.toContain("106.8225");
        expect(JSON.stringify(json)).not.toContain("106.8225");
    });

    test("without a configured ML Service it answers unavailable and sends nothing", async () => {
        ml.configured = false;
        const { json } = await ask(LIBRARY, { origin: READER, mode: "drive" });

        expect(json.data?.outcome).toBe("UNAVAILABLE");
        expect(ml.calls).toEqual([]);
    });

    test("a hidden place is not on the map, so it has no route", async () => {
        const { status, json } = await ask(HIDDEN, { origin: READER, mode: "drive" });
        expect([status, json.error?.code]).toEqual([404, "NOT_FOUND"]);
        expect(ml.calls).toEqual([]);
    });

    test("rejects points outside Indonesia, extra fields, and a bad place id", async () => {
        expect((await ask(LIBRARY, { origin: { latitude: 51.5, longitude: -0.12 }, mode: "drive" })).status).toBe(400);
        expect((await ask(LIBRARY, { origin: READER, mode: "drive", userId: "u1" })).status).toBe(400);
        expect((await ask("not-a-uuid", { origin: READER, mode: "drive" })).status).toBe(400);
        expect(ml.calls).toEqual([]);
    });

    test("over the rate limit it answers 429 before calling the ML Service", async () => {
        limiter.allow = false;
        const { status } = await ask(LIBRARY, { origin: READER, mode: "drive" });
        expect(status).toBe(429);
        expect(ml.calls).toEqual([]);
    });
});
