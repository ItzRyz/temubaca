import { describe, expect, test } from "bun:test";

import {
    BadRequestError,
    PayloadTooLargeError,
} from "../../src/lib/api/errors";
import {
    MAX_JSON_BODY_BYTES,
    parseJsonBody,
} from "../../src/lib/api/request";

describe("parseJsonBody", () => {
    test("parses application/json", async () => {
        const request = new Request("https://temubaca.test/api", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: "Laut Bercerita" }),
        });

        await expect(parseJsonBody(request)).resolves.toEqual({
            title: "Laut Bercerita",
        });
    });

    test("allows JSON media type parameters", async () => {
        const request = new Request("https://temubaca.test/api", {
            method: "POST",
            headers: { "content-type": "application/json; charset=utf-8" },
            body: JSON.stringify({ ok: true }),
        });

        await expect(parseJsonBody(request)).resolves.toEqual({ ok: true });
    });

    test("rejects a different media type", async () => {
        const request = new Request("https://temubaca.test/api", {
            method: "POST",
            headers: { "content-type": "application/jsonp" },
            body: "{}",
        });

        await expect(parseJsonBody(request)).rejects.toBeInstanceOf(BadRequestError);
    });

    test("rejects malformed JSON", async () => {
        const request = new Request("https://temubaca.test/api", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
        });

        await expect(parseJsonBody(request)).rejects.toBeInstanceOf(BadRequestError);
    });

    test("rejects a body larger than the streaming limit", async () => {
        const request = new Request("https://temubaca.test/api", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ data: "x".repeat(MAX_JSON_BODY_BYTES) }),
        });

        await expect(parseJsonBody(request)).rejects.toBeInstanceOf(PayloadTooLargeError);
    });

    test("rejects an oversized declared body before reading it", async () => {
        const request = new Request("https://temubaca.test/api", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "content-length": String(MAX_JSON_BODY_BYTES + 1),
            },
            body: "{}",
        });

        await expect(parseJsonBody(request)).rejects.toBeInstanceOf(PayloadTooLargeError);
    });
});
