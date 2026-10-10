import { isIP } from "node:net";
import type { ConnectionOptions } from "node:tls";
import { parse } from "pg-connection-string";

import { getDatabaseTlsConfig } from "./ssl";

const allowedSslModes = ["require", "allow", "prefer", "verify-full"] as const;
type DrizzleSsl = boolean | (typeof allowedSslModes)[number] | ConnectionOptions;

/** Parse a PostgreSQL URL while enforcing verified TLS for non-local migration targets. */
export function createDrizzlePostgresCredentials(
    connectionString: string,
    customCa?: string,
    nodeEnv: "development" | "test" | "production" = "development",
) {
    const {
        host,
        database,
        port,
        user,
        password,
        ssl: parsedSsl,
        ...connectionOptions
    } = parse(connectionString);

    if (typeof host !== "string" || !host || typeof database !== "string" || !database) {
        throw new Error("PostgreSQL connection URL must include a host and database.");
    }

    if (port) {
        const parsedPort = Number(port);
        if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
            throw new Error("PostgreSQL connection URL contains an invalid port.");
        }
    }

    const ipVersion = isIP(host);
    const isLocalConnection =
        host === "localhost" ||
        (ipVersion === 6 && host === "::1") ||
        (ipVersion === 4 && host.startsWith("127.")) ||
        host.startsWith("/");

    const localSsl: DrizzleSsl | undefined = typeof parsedSsl === "boolean"
        ? parsedSsl
        : typeof parsedSsl === "string" && allowedSslModes.includes(parsedSsl as (typeof allowedSslModes)[number])
            ? parsedSsl as (typeof allowedSslModes)[number]
            : parsedSsl && typeof parsedSsl === "object"
                ? parsedSsl as ConnectionOptions
                : undefined;
    const ssl: DrizzleSsl | undefined = isLocalConnection && nodeEnv !== "production"
        ? localSsl
        : getDatabaseTlsConfig("production", customCa);

    return {
        ...connectionOptions,
        host,
        ...(port ? { port: Number(port) } : {}),
        ...(user ? { user } : {}),
        ...(password ? { password } : {}),
        database,
        ssl,
    };
}
