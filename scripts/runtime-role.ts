/**
 * TB-049: give the least-privilege runtime role `temubaca_app` (migration 0012) a fresh password and
 * point the app at it. Migrations keep using the owner role (`DIRECT_URL`, or `DATABASE_URL` in `.env`).
 *
 *   bun scripts/runtime-role.ts                  # local stack: rewrite DATABASE_URL in .env.development.local
 *   bun scripts/runtime-role.ts --cloud --vercel # cloud: set DATABASE_URL for Vercel production + preview
 *
 * The password is random on every run and never printed. Running it again rotates the password.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { Pool } from "pg";

import { useCloud } from "./load-env";

const ROLE = "temubaca_app";
const LOCAL_ENV = ".env.development.local";

/** Supavisor expects `<role>.<project ref>`; a direct connection uses the bare role name. */
function runtimeUrl(ownerUrl: string, password: string) {
    const url = new URL(ownerUrl);
    const [, projectRef] = decodeURIComponent(url.username).split(".");
    url.username = projectRef ? `${ROLE}.${projectRef}` : ROLE;
    url.password = password;
    return url.toString();
}

async function main() {
    const ownerUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
    if (!ownerUrl) throw new Error("Set DATABASE_URL first.");
    const pushToVercel = process.argv.includes("--vercel");
    if (pushToVercel && !useCloud) throw new Error("--vercel needs --cloud.");

    const password = randomBytes(24).toString("base64url");
    const owner = new Pool({ connectionString: ownerUrl, max: 1 });
    try {
        const exists = (await owner.query(`select 1 from pg_roles where rolname = $1`, [ROLE])).rowCount;
        if (!exists) throw new Error(`Role ${ROLE} is missing; apply migration 0012 first.`);
        const statement = (await owner.query<{ sql: string }>(`select format('alter role %I with login password %L', $1::text, $2::text) as sql`, [ROLE, password])).rows[0].sql;
        await owner.query(statement);
    } finally {
        await owner.end();
    }

    const url = runtimeUrl(ownerUrl, password);
    // Supavisor can take a moment to see a new password.
    let checked = false;
    for (let attempt = 0; attempt < 6 && !checked; attempt += 1) {
        const app = new Pool({ connectionString: url, max: 1 });
        try {
            const row = (await app.query<{ user: string; books: number }>(`select current_user as user, (select count(*)::int from public.books) as books`)).rows[0];
            console.log(`connected as ${row.user}; books visible: ${row.books}`);
            checked = true;
        } catch (error) {
            if (attempt === 5) throw error;
            await new Promise((resolve) => setTimeout(resolve, 5_000));
        } finally {
            await app.end();
        }
    }

    if (pushToVercel) {
        for (const target of ["production", "preview"]) {
            const result = spawnSync("bunx", ["vercel", "env", "add", "DATABASE_URL", target, "--yes", "--force", "--sensitive"], { input: url, encoding: "utf8", shell: true });
            if (result.status !== 0) throw new Error(`vercel env add DATABASE_URL ${target} failed.`);
            console.log(`Vercel DATABASE_URL (${target}) now uses ${ROLE}; redeploy to apply.`);
        }
    } else if (!useCloud) {
        const lines = (await readFile(LOCAL_ENV, "utf8")).split("\n").filter((line) => !line.startsWith("DATABASE_URL="));
        lines.splice(1, 0, `DATABASE_URL=${url}`);
        await writeFile(LOCAL_ENV, lines.join("\n"));
        console.log(`${LOCAL_ENV}: DATABASE_URL now uses ${ROLE}; DIRECT_URL keeps the owner for migrations.`);
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
