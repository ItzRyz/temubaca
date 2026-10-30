"use server";

import { revalidatePath } from "next/cache";

import { updateUserProfile } from "@/lib/db/queries/users";
import { enforceRateLimit } from "@/lib/rate-limit";
import { profileUpdateSchema } from "@/lib/validation/common";
import { requireUser } from "@/lib/auth";
import { isDistrictOf } from "@/features/regions/districts";

export type ProfileActionState = {
    success: boolean;
    message?: string;
    fieldError?: string;
    regionError?: string;
};

export async function updateProfile(
    _previousState: ProfileActionState,
    formData: FormData,
): Promise<ProfileActionState> {
    const user = await requireUser();
    const parsed = profileUpdateSchema.safeParse({
        displayName: formData.get("displayName"),
        regionCode: formData.get("regionCode") ?? undefined,
        districtCode: formData.get("districtCode") ?? undefined,
    });

    if (!parsed.success || !parsed.data.displayName) {
        const regionIssue = parsed.success ? undefined : parsed.error.issues.find((issue) => issue.path[0] === "regionCode" || issue.path[0] === "districtCode");
        if (regionIssue) return { success: false, regionError: regionIssue.message };
        return {
            success: false,
            fieldError: parsed.success
                ? "Nama tampilan wajib diisi."
                : parsed.error.issues[0]?.message ?? "Nama tampilan tidak valid.",
        };
    }

    // A kecamatan must lie in the chosen kab/kota; without a kab/kota there is no kecamatan.
    const districtCode = parsed.data.regionCode && parsed.data.districtCode ? parsed.data.districtCode : null;
    if (districtCode && !isDistrictOf(districtCode, parsed.data.regionCode!)) {
        return { success: false, regionError: "Kecamatan tidak berada di kabupaten/kota yang dipilih." };
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
            regionCode: parsed.data.regionCode,
            ...(parsed.data.regionCode !== undefined ? { districtCode } : {}),
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
    return { success: true, message: "Profil berhasil diperbarui." };
}
