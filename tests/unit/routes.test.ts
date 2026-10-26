import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { routeOutcomeOf } from "../../src/features/places/route";
import { MlServiceError } from "../../src/lib/ml/request";
import { requestRoute } from "../../src/lib/ml/routes";
import { routeRequestSchema } from "../../src/lib/validation/schemas/place.schema";

const ML = { url: "https://ml.example.test", apiKey: "k".repeat(64) };
const MONAS = { latitude: -6.176, longitude: 106.8225 };
const BLOK_M = { latitude: -6.2443, longitude: 106.8007 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
// The ML Service's frozen reply (ML-T10), so this test and the service agree on one route.
const route = JSON.parse(readFileSync(resolve(import.meta.dir, "../fixtures/ml-contract/route.json"), "utf8")).response;

function capture(response: Response) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: URL | string, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return response;
    }) as typeof fetch;
    return { calls, fetchImpl };
}

describe("ML route client (TB-064)", () => {
    test("sends only the two points and the mode, with the internal token", async () => {
        const { calls, fetchImpl } = capture(json(200, route));
        const result = await requestRoute({ origin: MONAS, destination: BLOK_M, mode: "drive" }, { ...ML, fetchImpl });

        expect(result.distance_m).toBe(route.distance_m);
        expect(calls[0].url).toBe("https://ml.example.test/api/routing/route");
        expect(JSON.parse(String(calls[0].init.body))).toEqual({
            origin: { lat: -6.176, lng: 106.8225 }, destination: { lat: -6.2443, lng: 106.8007 }, mode: "drive",
        });
        expect((calls[0].init.headers as Record<string, string>)["x-internal-token"]).toBe(ML.apiKey);
    });

    test("a routing refusal keeps the service's status and code", async () => {
        const { fetchImpl } = capture(json(422, { error: { code: "OUT_OF_COVERAGE", message: "Titik berada di luar cakupan rute.", point: "origin" } }));
        const error = await requestRoute({ origin: MONAS, destination: BLOK_M, mode: "walk" }, { ...ML, fetchImpl }).catch((caught) => caught);

        expect(error).toBeInstanceOf(MlServiceError);
        expect([error.kind, error.status, error.code]).toEqual(["unavailable", 422, "OUT_OF_COVERAGE"]);
    });

    test("a reply that breaks the contract is invalid, not a route", async () => {
        const { fetchImpl } = capture(json(200, { ...route, geometry: { type: "LineString", coordinates: [[106.8, -6.2]] } }));
        const error = await requestRoute({ origin: MONAS, destination: BLOK_M, mode: "drive" }, { ...ML, fetchImpl }).catch((caught) => caught);
        expect(error.kind).toBe("invalid_response");
    });

    test("ML codes map to map states; anything else is unavailable", () => {
        expect(routeOutcomeOf("OUT_OF_COVERAGE")).toBe("OUT_OF_COVERAGE");
        expect(routeOutcomeOf("SNAP_TOO_FAR")).toBe("SNAP_TOO_FAR");
        expect(routeOutcomeOf("NO_PATH")).toBe("NO_PATH");
        expect(routeOutcomeOf("ROUTING_UNAVAILABLE")).toBe("UNAVAILABLE");
        expect(routeOutcomeOf("UNAUTHORIZED")).toBe("UNAVAILABLE");
        expect(routeOutcomeOf(undefined)).toBe("UNAVAILABLE");
    });
});

describe("route request body", () => {
    test("accepts a point in Indonesia and a mode", () => {
        expect(routeRequestSchema.safeParse({ origin: MONAS, mode: "walk" }).success).toBe(true);
    });

    test("rejects points outside Indonesia, unknown modes, and extra fields", () => {
        expect(routeRequestSchema.safeParse({ origin: { latitude: 51.5, longitude: -0.12 }, mode: "drive" }).success).toBe(false);
        expect(routeRequestSchema.safeParse({ origin: MONAS, mode: "bus" }).success).toBe(false);
        expect(routeRequestSchema.safeParse({ origin: MONAS, mode: "drive", userId: "x" }).success).toBe(false);
        expect(routeRequestSchema.safeParse({ origin: { ...MONAS, accuracy: 5 }, mode: "drive" }).success).toBe(false);
    });
});
