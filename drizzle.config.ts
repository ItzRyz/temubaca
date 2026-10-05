import { env } from "@/env";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    out: "./src/drizzle/migrations",
    schema: "./src/lib/db/schema.ts",

    dialect: "postgresql",

    dbCredentials: {
        url: env.DATABASE_URL,
    },

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