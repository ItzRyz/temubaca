import { hasE2eAccounts } from "./support/accounts";
import { cleanE2eData } from "./support/db";

export default async function globalTeardown() {
    if (hasE2eAccounts) await cleanE2eData();
}
