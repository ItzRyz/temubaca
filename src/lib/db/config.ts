import "server-only";

import { env } from "@/env";

export const databaseConfig = {
    url: env.DATABASE_URL,

    maxConnections: 10,

    connectionTimeout: 10_000,

    idleTimeout: 20,

    prepare: true,
} as const;