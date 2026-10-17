import { describe, expect, test } from "bun:test";

import { signInSchema, signUpSchema } from "../../src/lib/validation/auth";
import {
    forgotPasswordSchema,
    otpTokenSchema,
    pendingOtpSchema,
    resetPasswordSchema,
} from "../../src/lib/validation/schemas/auth.schema";

describe("authentication input validation", () => {
    test("normalizes the sign-in email", () => {
        expect(signInSchema.parse({
            email: "  READER@EXAMPLE.COM ",
            password: "correct-horse-battery",
        }).email).toBe("reader@example.com");
    });

    test("rejects passwords longer than the provider input limit", () => {
        const result = signInSchema.safeParse({
            email: "reader@example.com",
            password: "x".repeat(129),
        });

        expect(result.success).toBe(false);
    });

    test("rejects unexpected sign-up fields", () => {
        const result = signUpSchema.safeParse({
            email: "reader@example.com",
            name: "Pembaca Baru",
            password: "correct-horse-battery",
            role: "ADMIN",
        });

        expect(result.success).toBe(false);
    });

    test("enforces shared reset-password and email bounds", () => {
        expect(resetPasswordSchema.safeParse({ password: "x".repeat(128) }).success).toBe(true);
        expect(resetPasswordSchema.safeParse({ password: "x".repeat(129) }).success).toBe(false);
        expect(forgotPasswordSchema.safeParse({ email: `${"x".repeat(310)}@example.com` }).success).toBe(false);
        expect(forgotPasswordSchema.safeParse({ email: "  READER@EXAMPLE.COM " }).data?.email).toBe("reader@example.com");
    });

    test("accepts only six-digit numeric verification codes", () => {
        expect(otpTokenSchema.safeParse(" 074211 ").data).toBe("074211");
        expect(otpTokenSchema.safeParse("12345").success).toBe(false);
        expect(otpTokenSchema.safeParse("1234567").success).toBe(false);
        expect(otpTokenSchema.safeParse("12a456").success).toBe(false);
    });

    test("rejects tampered pending verification cookies", () => {
        expect(pendingOtpSchema.safeParse({ email: "reader@example.com", purpose: "recovery", sentAt: 1 }).success).toBe(true);
        expect(pendingOtpSchema.safeParse({ email: "reader@example.com", purpose: "invite", sentAt: 1 }).success).toBe(false);
        expect(pendingOtpSchema.safeParse({ email: "not-an-email", purpose: "signup", sentAt: 1 }).success).toBe(false);
        expect(pendingOtpSchema.safeParse({ email: "reader@example.com", purpose: "signup", sentAt: 1, role: "ADMIN" }).success).toBe(false);
    });
});
