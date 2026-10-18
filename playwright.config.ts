import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E for guest-visible flows (TB-050 groundwork). Files are `*.e2e.ts` so `bun test`
 * does not pick them up. Against a running dev server: `bun run test:e2e`; set `E2E_BASE_URL`
 * to point at staging once DEC-01 is decided.
 */
export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/*.e2e.ts",
    timeout: 90_000,
    expect: { timeout: 15_000 },
    retries: process.env.CI ? 1 : 0,
    reporter: [["list"]],
    use: {
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
        trace: "retain-on-failure",
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile", use: { ...devices["Pixel 7"] } },
    ],
    webServer: process.env.E2E_BASE_URL ? undefined : {
        command: "bun run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 180_000,
    },
});
