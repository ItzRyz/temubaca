import { z } from "zod";

import { displayNameSchema } from "./strings";

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .max(320)
    .pipe(z.email({ message: "Format email salah" }));

const passwordSchema = z
    .string()
    .min(8, { message: "Password minimal 8 karakter" })
    .max(128, { message: "Password maksimal 128 karakter" });

export const signInSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
}).strict();

export const signUpSchema = z.object({
    email: emailSchema,
    name: displayNameSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
}).strict().refine((data) => data.password === data.confirmPassword, {
    message: "Password dan konfirmasi password tidak sama",
    path: ["confirmPassword"],
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
