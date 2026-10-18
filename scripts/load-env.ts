/**
 * Env for scripts. The local Supabase stack (`.env.development.local`, written by `bun run db:local`)
 * wins over the cloud project in `.env`, so scripts never touch production by accident. Pass
 * `--cloud` to use `.env` only, e.g. `bun run db:migrate:dev -- --apply --cloud`.
 */
import { config } from "dotenv";

export const useCloud = process.argv.includes("--cloud");

config({ path: useCloud ? [".env"] : [".env.development.local", ".env"], quiet: true });
