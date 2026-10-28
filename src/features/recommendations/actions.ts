"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { addUserInterest, removeUserInterest, saveOnboardingInterests } from "@/lib/db/queries/interests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation/common";

import { interestOnboardingSchema, interestSubjectSchema as subjectSchema } from "./onboarding";

export async function addInterest(formData: FormData) {
    const user = await requireUser();
    const parsed = subjectSchema.safeParse(formData.get("subject"));
    if (!parsed.success) return { success: false as const, message: parsed.error.issues[0]?.message ?? "Minat tidak valid." };

    try {
        const limit = await enforceRateLimit(`interest-write:${user.id}`, 20, 60);
        if (!limit.success) return { success: false as const, message: "Terlalu banyak perubahan. Coba lagi sebentar lagi." };
        await addUserInterest(user.id, parsed.data);
        revalidatePath("/recommendations");
        return { success: true as const, message: "Minat disimpan." };
    } catch {
        return { success: false as const, message: "Minat belum dapat disimpan saat ini." };
    }
}

export async function deleteInterest(interestId: string) {
    const user = await requireUser();
    const parsed = uuidSchema.safeParse(interestId);
    if (!parsed.success) return { success: false as const, message: "Minat tidak valid." };

    try {
        const limit = await enforceRateLimit(`interest-write:${user.id}`, 20, 60);
        if (!limit.success) return { success: false as const, message: "Terlalu banyak perubahan. Coba lagi sebentar lagi." };
        await removeUserInterest(user.id, parsed.data);
        revalidatePath("/recommendations");
        return { success: true as const };
    } catch {
        return { success: false as const, message: "Minat belum dapat dihapus saat ini." };
    }
}

/** "Pilih minat" (`/minat`): at least three interests and an optional kab/kota, saved together. */
export async function saveInterestOnboarding(input: unknown) {
    const user = await requireUser();
    const parsed = interestOnboardingSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, message: parsed.error.issues[0]?.message ?? "Pilihan minat tidak valid." };

    try {
        const limit = await enforceRateLimit(`interest-write:${user.id}`, 20, 60);
        if (!limit.success) return { success: false as const, message: "Terlalu banyak perubahan. Coba lagi sebentar lagi." };
        await saveOnboardingInterests(user.id, parsed.data.subjects, parsed.data.regionCode);
        revalidatePath("/recommendations");
        revalidatePath("/bookmarks");
        return { success: true as const };
    } catch {
        return { success: false as const, message: "Minat belum dapat disimpan saat ini. Coba lagi." };
    }
}
