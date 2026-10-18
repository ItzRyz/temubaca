/**
 * Env for scripts. The local Supabase stack (`.env.development.local`, written by `bun run db:local`)
 * wins over the cloud project in `.env`, so scripts never touch production by accident. Pass
 * `--cloud` to use `.env` only, e.g. `bun run db:migrate:dev -- --apply --cloud`.
 *
 * Bun loads `.env.development.local` into process.env by itself, so `--cloud` must replace those
 * values explicitly, and drop keys (such as DIRECT_URL) that only the local file sets.
 */
import { existsSync, readFileSync } from "node:fs";

import { config, parse } from "dotenv";

export const useCloud = process.argv.includes("--cloud");

if (useCloud) {
    const cloud = parse(readFileSync(".env"));
    const local = existsSync(".env.development.local") ? parse(readFileSync(".env.development.local")) : {};
    for (const key of Object.keys(local)) if (!(key in cloud)) delete process.env[key];
    Object.assign(process.env, cloud);
} else {
    config({ path: [".env.development.local", ".env"], quiet: true });
}
