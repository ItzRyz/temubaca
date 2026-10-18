import "server-only";

import { env } from "@/env";
import { getDatabaseTlsConfig } from "./ssl";

export const databaseConfig = {
    url: env.DATABASE_URL,

    maxConnections: env.DATABASE_POOL_MAX,

    connectionTimeout: 10_000,

    idleTimeout: 20,
    ssl: getDatabaseTlsConfig(env.NODE_ENV, env.DATABASE_SSL_CA),
} as const;
