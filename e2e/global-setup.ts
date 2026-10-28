import { mkdir } from "node:fs/promises";

import { chromium, type FullConfig } from "@playwright/test";

import { e2eAccounts, hasE2eAccounts, storageStatePath, type E2eRole } from "./support/accounts";
import { cleanE2eData } from "./support/db";

/** Signs both E2E accounts in once and saves their sessions; also clears data left by a failed run. */
export default async function globalSetup(config: FullConfig) {
    if (!hasE2eAccounts) return;
    await cleanE2eData();
    await mkdir("e2e/.auth", { recursive: true });

    const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
    const browser = await chromium.launch();
    try {
        for (const role of ["owner", "borrower"] as E2eRole[]) {
            const account = e2eAccounts[role];
            const page = await browser.newPage({ baseURL });
            await page.goto("/login?next=%2Fdashboard");
            await page.getByLabel("Email").fill(account.email!);
            await page.locator("input[type=password]").fill(account.password!);
            await page.getByRole("button", { name: "Masuk", exact: true }).click();
            // An account without interests is asked to pick some first (/minat); the suites skip it.
            await page.waitForURL(/\/(dashboard|minat)/, { timeout: 60_000 });
            if (new URL(page.url()).pathname === "/minat") {
                await page.getByRole("button", { name: "Lewati dulu" }).click();
                await page.waitForURL("**/dashboard", { timeout: 60_000 });
            }
            await page.context().storageState({ path: storageStatePath(role) });
            await page.close();
        }
    } finally {
        await browser.close();
    }
}
