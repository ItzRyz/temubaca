import { config } from "dotenv";

config({ path: [".env.e2e", ".env.development.local", ".env.local", ".env"], quiet: true });

export type E2eRole = "owner" | "borrower";

/** Credentials from `.env.e2e` (see scripts/e2e-accounts.ts). Missing values skip the member suite. */
export const e2eAccounts = {
    owner: { email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_OWNER_PASSWORD, name: "E2E Pemilik" },
    borrower: { email: process.env.E2E_BORROWER_EMAIL, password: process.env.E2E_BORROWER_PASSWORD, name: "E2E Peminjam" },
} as const;

export const hasE2eAccounts = Object.values(e2eAccounts).every((account) => account.email && account.password);

export const storageStatePath = (role: E2eRole) => `e2e/.auth/${role}.json`;
