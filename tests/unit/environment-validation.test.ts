import { describe, expect, test } from "bun:test";

import {
    clientEnvironmentSchema,
    httpsUrlSchema,
    postgresConnectionUrlSchema,
} from "@/lib/validation/schemas/environment.schema";

const base = {
    NODE_ENV: "production" as const,
    NEXT_PUBLIC_APP_URL: "https://temubaca.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
};

describe("client environment validation", () => {
    test("accepts HTTPS origins in production", () => {
        expect(clientEnvironmentSchema.safeParse(base).success).toBe(true);
    });

    test("rejects insecure remote origins and non-origin URLs", () => {
        expect(clientEnvironmentSchema.safeParse({ ...base, NEXT_PUBLIC_APP_URL: "http://temubaca.example" }).success).toBe(false);
        expect(clientEnvironmentSchema.safeParse({ ...base, NEXT_PUBLIC_SUPABASE_URL: "https://user:secret@project.supabase.co" }).success).toBe(false);
        expect(clientEnvironmentSchema.safeParse({ ...base, NEXT_PUBLIC_APP_URL: "https://temubaca.example/path" }).success).toBe(false);
    });

    test("permits loopback HTTP for local production builds", () => {
        expect(clientEnvironmentSchema.safeParse({
            ...base,
            NEXT_PUBLIC_APP_URL: "http://localhost:3000",
            NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        }).success).toBe(true);
    });
});

describe("Upstash transport URL validation", () => {
    test("requires HTTPS and rejects embedded credentials", () => {
        expect(httpsUrlSchema.safeParse("https://global-redis.upstash.io").success).toBe(true);
        expect(httpsUrlSchema.safeParse("http://global-redis.upstash.io").success).toBe(false);
        expect(httpsUrlSchema.safeParse("https://user:secret@global-redis.upstash.io").success).toBe(false);
    });
});

describe("PostgreSQL connection URL validation", () => {
    test("accepts supported PostgreSQL URLs and rejects invalid schemes or missing targets", () => {
        expect(postgresConnectionUrlSchema.safeParse("postgresql://user:pass@db.example:5432/temubaca").success).toBe(true);
        expect(postgresConnectionUrlSchema.safeParse("postgres://user:pass@localhost/app").success).toBe(true);
        expect(postgresConnectionUrlSchema.safeParse("https://db.example/temubaca").success).toBe(false);
        expect(postgresConnectionUrlSchema.safeParse("postgresql://user:pass@/temubaca").success).toBe(false);
        expect(postgresConnectionUrlSchema.safeParse("postgresql://user:pass@db.example").success).toBe(false);
    });
});
