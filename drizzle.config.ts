import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    out: "./src/drizzle/migrations",
    schema: "./src/drizzle/schema.ts",

    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },

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