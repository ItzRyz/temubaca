import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { databaseConfig } from "./config";
import * as schema from "./schema";

const globalForDatabase = globalThis as unknown as {
    postgresPool?: Pool;
    db?: ReturnType<typeof drizzle<typeof schema>>;
};

const pool =
    globalForDatabase.postgresPool ??
    new Pool({
        connectionString: databaseConfig.url,
        max: databaseConfig.maxConnections,
        connectionTimeoutMillis: databaseConfig.connectionTimeout,
        idleTimeoutMillis: databaseConfig.idleTimeout * 1000,
        ssl: databaseConfig.ssl,
    });

if (!globalForDatabase.postgresPool) {
    pool.on("error", (error: Error) => {
        console.error("[DATABASE_POOL_ERROR]", {
            errorName: error.name,
        });
    });
}

export const db =
    globalForDatabase.db ??
    drizzle({ client: pool, schema });

if (process.env.NODE_ENV !== "production") {
    globalForDatabase.postgresPool = pool;
    globalForDatabase.db = db;
}
