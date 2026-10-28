"use server";

import { requireUser } from "@/lib/auth";
import { markTourSeen as saveTourSeen } from "@/lib/db/queries/users";

/** Records that the account has seen "Panduan TemuBaca", so it no longer opens on its own. */
export async function markTourSeen() {
    const user = await requireUser();
    try {
        await saveTourSeen(user.id);
        return { success: true as const };
    } catch {
        return { success: false as const };
    }
}
