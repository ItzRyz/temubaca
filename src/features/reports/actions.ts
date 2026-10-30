"use server";

import { requireUser } from "@/lib/auth";
import { markReportsSeen as saveReportsSeen } from "@/lib/db/queries/users";

/** Clears the decision dot once the reporter has opened Laporan saya (30 Okt 2026). */
export async function markReportsSeen() {
    const user = await requireUser();
    try {
        await saveReportsSeen(user.id);
        return { success: true as const };
    } catch {
        return { success: false as const };
    }
}
