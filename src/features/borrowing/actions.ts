"use server";

import { requireUser } from "@/lib/auth";
import { markLoansSeen as saveLoansSeen } from "@/lib/db/queries/users";

/** Clears the "kabar baru" dot once the reader has opened Pinjam & pinjamkan (30 Okt 2026). */
export async function markLoansSeen() {
    const user = await requireUser();
    try {
        await saveLoansSeen(user.id);
        return { success: true as const };
    } catch {
        return { success: false as const };
    }
}
