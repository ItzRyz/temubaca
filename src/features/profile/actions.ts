"use server";

import { revalidatePath } from "next/cache";

import { updateUserProfile } from "@/lib/db/queries/users";
import { enforceRateLimit } from "@/lib/rate-limit";
import { profileUpdateSchema } from "@/lib/validation/common";
import { requireUser } from "@/lib/auth";

export type ProfileActionState = {
    success: boolean;
    message?: string;
    fieldError?: string;
};

export async function updateProfile(
    _previousState: ProfileActionState,
    formData: FormData,
): Promise<ProfileActionState> {
    const user = await requireUser();
    const parsed = profileUpdateSchema.safeParse({
        displayName: formData.get("displayName"),
    });

    if (!parsed.success || !parsed.data.displayName) {
        return {
            success: false,
            fieldError: parsed.success
                ? "Nama tampilan wajib diisi."
                : parsed.error.issues[0]?.message ?? "Nama tampilan tidak valid.",
        };
    }

    try {
        const rateLimit = await enforceRateLimit(`profile-update:${user.id}`, 5, 60);
        if (!rateLimit.success) {
            return {
                success: false,
                message: "Terlalu banyak perubahan profil. Tunggu sebentar lalu coba lagi.",
            };
        }

        const updated = await updateUserProfile(user.id, {
            displayName: parsed.data.displayName,
        });
        if (!updated) {
            return { success: false, message: "Profil tidak ditemukan. Muat ulang halaman lalu coba lagi." };
        }
    } catch {
        return {
            success: false,
            message: "Profil belum dapat diperbarui saat ini. Coba lagi nanti.",
        };
    }

    revalidatePath("/profile");
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { success: true, message: "Nama tampilan berhasil diperbarui." };
}
