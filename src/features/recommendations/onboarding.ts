import { z } from "zod";

import { regionCodeSchema } from "@/lib/validation/schemas/community-management.schema";

/**
 * "Pilih minat" after sign-up and, while an account has no interests, after each sign-in (owner's
 * decision 28 Okt 2026). At least three interests; skipping saves nothing, so the page comes back
 * on the next sign-in. The kab/kota is optional and only feeds community recommendations (R-11).
 */
export const MIN_ONBOARDING_INTERESTS = 3;

export const interestSubjectSchema = z.string().trim().min(2, "Minat minimal 2 karakter.").max(80, "Minat maksimal 80 karakter.");

export const interestOnboardingSchema = z.object({
    subjects: z.array(interestSubjectSchema).max(30, "Maksimal 30 minat sekaligus.")
        .refine((subjects) => new Set(subjects.map((subject) => subject.toLocaleLowerCase("id-ID"))).size === subjects.length, "Ada minat yang sama lebih dari sekali.")
        .refine((subjects) => subjects.length >= MIN_ONBOARDING_INTERESTS, `Pilih minimal ${MIN_ONBOARDING_INTERESTS} minat.`),
    regionCode: z.union([z.literal(""), regionCodeSchema]).optional().transform((value) => value || undefined),
}).strict();

export type InterestOnboardingInput = z.infer<typeof interestOnboardingSchema>;
