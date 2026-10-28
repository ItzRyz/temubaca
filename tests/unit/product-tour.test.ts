import { describe, expect, test } from "bun:test";

import { publicNavigation } from "../../src/config/navigation";
import { TOUR_TARGETS, tourSteps, withTourFlag } from "../../src/features/onboarding/tour-steps";

describe("Panduan TemuBaca (28 Okt 2026)", () => {
    test("steps are unique, start and end in the middle of the screen, and point at targets that exist", () => {
        expect(new Set(tourSteps.map((step) => step.id)).size).toBe(tourSteps.length);
        expect(tourSteps[0].target).toBeUndefined();
        expect(tourSteps.at(-1)?.target).toBeUndefined();
        const navTargets = publicNavigation.flatMap((item) => ("tour" in item ? [item.tour] : []));
        // The account menu button carries "account-menu" (src/components/navigation/profile-menu.tsx).
        for (const step of tourSteps) if (step.target) expect([...navTargets, "account-menu"]).toContain(step.target);
        expect([...TOUR_TARGETS].sort() as string[]).toEqual([...navTargets, "account-menu"].sort());
    });

    test("the tour flag is added to the next page, keeping its own query", () => {
        expect(withTourFlag("/")).toBe("/?panduan=1");
        expect(withTourFlag("/dashboard")).toBe("/dashboard?panduan=1");
        expect(withTourFlag("/my-listings?tab=peminjaman")).toBe("/my-listings?tab=peminjaman&panduan=1");
    });
});
