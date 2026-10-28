import { describe, expect, test } from "bun:test";

import { afterSignInPath } from "../../src/features/auth/safe-next-path";
import { interestOnboardingSchema } from "../../src/features/recommendations/onboarding";

describe("Pilih minat (28 Okt 2026)", () => {
    const three = ["Sastra Indonesia", "Puisi", "Sejarah"];

    test("at least three distinct interests, an optional known kab/kota", () => {
        expect(interestOnboardingSchema.safeParse({ subjects: three.slice(0, 2) }).success).toBe(false);
        expect(interestOnboardingSchema.safeParse({ subjects: [...three.slice(0, 2), "puisi"] }).success).toBe(false);
        expect(interestOnboardingSchema.safeParse({ subjects: [...three.slice(0, 2), "X"] }).success).toBe(false);
        expect(interestOnboardingSchema.safeParse({ subjects: three, regionCode: "99.99" }).success).toBe(false);
        expect(interestOnboardingSchema.parse({ subjects: three, regionCode: "" })).toEqual({ subjects: three, regionCode: undefined });
        expect(interestOnboardingSchema.parse({ subjects: three, regionCode: "31.71" }).regionCode).toBe("31.71");
    });

    test("a sign-in without interests goes to /minat first, keeping only a safe next page", () => {
        expect(afterSignInPath("/dashboard", true)).toBe("/minat?next=%2Fdashboard");
        expect(afterSignInPath("/dashboard", false)).toBe("/dashboard");
        expect(afterSignInPath("//evil.example", true)).toBe("/minat?next=%2F");
        expect(afterSignInPath(undefined, false)).toBe("/");
    });
});
