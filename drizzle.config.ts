import "dotenv/config";
import { defineConfig } from "drizzle-kit";

import { createDrizzlePostgresCredentials } from "./src/lib/db/drizzle-connection";

const databaseUrl =
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
    throw new Error(
        "Set DIRECT_URL (recommended for migrations) or DATABASE_URL before running Drizzle Kit.",
    );
}

const dbCredentials = createDrizzlePostgresCredentials(
    databaseUrl,
    process.env.DATABASE_SSL_CA,
    process.env.NODE_ENV === "production" ? "production" : "development",
);

export default defineConfig({
    out: "./drizzle/migrations",
    schema: "./src/lib/db/schema.ts",

    dialect: "postgresql",

    dbCredentials,

    strict: true,
    extensionsFilters: ["postgis"],
    schemaFilter: "public",
    tablesFilter: "*",

    introspect: {
        casing: "camel",
    },

    migrations: {
        table: "__drizzle_migrations__",
        schema: "drizzle",
    },

    entities: {
        roles: {
            provider: 'supabase',
            exclude: [],
            include: []
        }
    },

    breakpoints: true,
    verbose: true,
});
