"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { addUserInterest, removeUserInterest } from "@/lib/db/queries/interests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation/common";

const subjectSchema = z.string().trim().min(2, "Minat minimal 2 karakter.").max(80, "Minat maksimal 80 karakter.");

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
