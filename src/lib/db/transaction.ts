import "server-only";

import { db } from "./client";

export function transaction<T>(
    callback: (
        tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    ) => Promise<T>,
) {
    return db.transaction(callback);
}