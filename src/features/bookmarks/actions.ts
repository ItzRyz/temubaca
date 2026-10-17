"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { clearBookmarksAndInterests } from "@/lib/db/queries/bookmarks";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Figma "Hapus bookmark dan minat" (209:1097): removes the reader's own bookmarks and interests only. */
export async function clearMyBookmarksAndInterests() {
    const user = await requireUser();

    try {
        const limit = await enforceRateLimit(`bookmark-clear:${user.id}`, 3, 60);
        if (!limit.success) return { success: false as const, message: "Terlalu banyak percobaan. Coba lagi sebentar lagi." };
        const removed = await clearBookmarksAndInterests(user.id);
        revalidatePath("/bookmarks");
        revalidatePath("/recommendations");
        revalidatePath("/profile");
        return { success: true as const, ...removed };
    } catch {
        return { success: false as const, message: "Bookmark dan minat belum dapat dihapus saat ini." };
    }
}
