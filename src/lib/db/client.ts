import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseConfig } from "./config";
import * as schema from "./schema";

const globalForDatabase = globalThis as unknown as {
    postgresClient?: ReturnType<typeof postgres>;
    db?: ReturnType<typeof drizzle<typeof schema>>;
};

const client =
    globalForDatabase.postgresClient ??
    postgres(databaseConfig.url, {
        max: databaseConfig.maxConnections,
        connect_timeout: Math.floor(
            databaseConfig.connectionTimeout / 1000,
        ),
        idle_timeout: databaseConfig.idleTimeout,
        prepare: databaseConfig.prepare,
    });

export const db =
    globalForDatabase.db ??
    drizzle(client, {
        schema,
    });

if (process.env.NODE_ENV !== "production") {
    globalForDatabase.postgresClient = client;
    globalForDatabase.db = db;
}