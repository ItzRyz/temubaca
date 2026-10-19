import { z } from "zod";

import { newPasswordSchema } from "./schemas/auth.schema";

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .max(320, { message: "Email terlalu panjang." })
    .pipe(z.email({ message: "Format email belum benar." }));

const passwordSchema = z
    .string()
    .min(8, { message: "Kata sandi minimal 8 karakter." })
    .max(128, { message: "Kata sandi maksimal 128 karakter." });

const nameSchema = z
    .string()
    .trim()
    .min(2, { message: "Nama minimal 2 karakter." })
    .max(100, { message: "Nama maksimal 100 karakter." });

export const signInSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
}).strict();

/** DEC-09: TemuBaca is for readers aged 13 and over. */
export const MINIMUM_AGE = 13;

export const signUpSchema = z.object({
    email: emailSchema,
    name: nameSchema,
    password: newPasswordSchema,
    ageConfirmed: z.literal(true, { error: `Konfirmasi bahwa usiamu ${MINIMUM_AGE} tahun atau lebih.` }),
}).strict();

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
