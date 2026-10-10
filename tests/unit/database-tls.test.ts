import { describe, expect, test } from "bun:test";

import { rootCertificates } from "node:tls";

import { getDatabaseTlsConfig } from "@/lib/db/ssl";
import { getPostgresTlsQueryParameters } from "@/lib/db/connection";
import { createDrizzlePostgresCredentials } from "@/lib/db/drizzle-connection";

describe("database TLS configuration", () => {
    test("requires certificate verification in production", () => {
        expect(getDatabaseTlsConfig("production")).toEqual({ rejectUnauthorized: true });
    });

    test("adds a supplied CA without dropping Node's default roots", () => {
        const customCa = "-----BEGIN CERTIFICATE-----\ncustom-root\n-----END CERTIFICATE-----";
        const config = getDatabaseTlsConfig("production", customCa);

        expect(config?.rejectUnauthorized).toBe(true);
        expect(config?.ca).toContain(customCa);
        expect(config?.ca).toContain(rootCertificates[0]);
    });

    test("does not force production TLS settings in development or tests", () => {
        expect(getDatabaseTlsConfig("development", "unused")).toBeUndefined();
        expect(getDatabaseTlsConfig("test")).toBeUndefined();
    });
});

describe("PostgreSQL TLS URL options", () => {
    test("detects query options that can override the explicit TLS configuration", () => {
        expect(getPostgresTlsQueryParameters("postgresql://user:pass@db.example/app?sslmode=disable&Application_Name=temubaca"))
            .toEqual(["sslmode"]);
        expect(getPostgresTlsQueryParameters("postgres://user:pass@db.example/app?sslrootcert=%2Fetc%2Froot.crt&sslkey=client.key"))
            .toEqual(["sslrootcert", "sslkey"]);
        expect(getPostgresTlsQueryParameters("postgresql://user:pass@db.example/app?application_name=temubaca"))
            .toEqual([]);
    });
});

describe("Drizzle migration connection security", () => {
    test("overrides insecure URL TLS modes for remote migration hosts", () => {
        const credentials = createDrizzlePostgresCredentials(
            "postgresql://user:pass@db.example/app?sslmode=disable&application_name=temubaca",
        );

        expect(credentials.ssl).toEqual({ rejectUnauthorized: true });
        expect(credentials.application_name).toBe("temubaca");
    });

    test("adds a custom CA while retaining default trust roots for migrations", () => {
        const customCa = "-----BEGIN CERTIFICATE-----\ncustom-root\n-----END CERTIFICATE-----";
        const credentials = createDrizzlePostgresCredentials(
            "postgresql://user:pass@db.example/app?sslmode=disable",
            customCa,
        );

        expect(credentials.ssl).toHaveProperty("rejectUnauthorized", true);
        expect((credentials.ssl as { ca: string[] }).ca).toContain(customCa);
        expect((credentials.ssl as { ca: string[] }).ca).toContain(rootCertificates[0]);
    });

    test("keeps localhost migration targets local", () => {
        const credentials = createDrizzlePostgresCredentials("postgresql://user:pass@localhost/app");
        expect(credentials.ssl).toBeUndefined();
    });

    test("enforces verified TLS for localhost in production", () => {
        const credentials = createDrizzlePostgresCredentials(
            "postgresql://user:pass@localhost/app?sslmode=disable",
            undefined,
            "production",
        );
        expect(credentials.ssl).toEqual({ rejectUnauthorized: true });
    });
});
