import { describe, expect, test } from "bun:test";

import { accountActionBlocker, accountLabel, maskEmail } from "../../src/features/admin-users/account-rules";
import { userRoleChangeSchema, userSuspensionSchema } from "../../src/lib/validation/schemas/user.schema";

describe("admin user directory rules", () => {
    test("masks emails to a recognisable minimum", () => {
        expect(maskEmail("andi.pratama@gmail.com")).toBe("an***@gmail.com");
        expect(maskEmail("ab@x.id")).toBe("a***@x.id");
        expect(maskEmail("a@x.id")).toBe("a***@x.id");
        expect(maskEmail("not-an-email")).toBe("***");
        expect(maskEmail(null)).toBeNull();
    });

    test("labels accounts by role, then by what they do", () => {
        expect(accountLabel({ role: "ADMIN", managedCommunityCount: 2, listingCount: 3 })).toBe("ADMIN");
        expect(accountLabel({ role: "MEMBER", managedCommunityCount: 1, listingCount: 3 })).toBe("COMMUNITY_MANAGER");
        expect(accountLabel({ role: "MEMBER", managedCommunityCount: 0, listingCount: 1 })).toBe("BOOK_OWNER");
        expect(accountLabel({ role: "MEMBER", managedCommunityCount: 0, listingCount: 0 })).toBe("READER");
    });

    test("admins cannot act on themselves or suspend another admin", () => {
        expect(accountActionBlocker("suspend", { actorId: "a", targetId: "a", targetRole: "MEMBER" })).toBe("self");
        expect(accountActionBlocker("role", { actorId: "a", targetId: "a", targetRole: "ADMIN" })).toBe("self");
        expect(accountActionBlocker("suspend", { actorId: "a", targetId: "b", targetRole: "ADMIN" })).toBe("admin_target");
        expect(accountActionBlocker("role", { actorId: "a", targetId: "b", targetRole: "ADMIN" })).toBeNull();
        expect(accountActionBlocker("suspend", { actorId: "a", targetId: "b", targetRole: "MEMBER" })).toBeNull();
    });

    test("suspension needs a reason and roles are limited to known values", () => {
        expect(userSuspensionSchema.safeParse({ suspended: true }).success).toBe(false);
        expect(userSuspensionSchema.safeParse({ suspended: true, reason: "Spam berulang" }).success).toBe(true);
        expect(userSuspensionSchema.safeParse({ suspended: false }).success).toBe(true);
        expect(userRoleChangeSchema.safeParse({ role: "SUPERADMIN" }).success).toBe(false);
        expect(userRoleChangeSchema.safeParse({ role: "ADMIN" }).success).toBe(true);
    });
});
