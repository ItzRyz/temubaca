import { describe, expect, test } from "bun:test";

import { describedBy } from "../../src/components/ui/form";

describe("shared form components", () => {
    test("wire hint and error ids only when they are shown", () => {
        expect(describedBy("name")).toBeUndefined();
        expect(describedBy("name", "Petunjuk")).toBe("name-hint");
        expect(describedBy("name", undefined, "Salah")).toBe("name-error");
        expect(describedBy("name", "Petunjuk", "Salah")).toBe("name-hint name-error");
        expect(describedBy("name", "Petunjuk", null)).toBe("name-hint");
    });
});
