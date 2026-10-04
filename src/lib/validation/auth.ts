import { z } from "zod";

export const signInSchema = z.object({
    email: z.string().trim().pipe(z.email({ message: "Format email salah" })),
    password: z.string().min(8, { message: "Password minimal 8 karakter" })
})

export const signUpSchema = z.object({
    email: z.string().trim().pipe(z.email({ message: "Format email salah" })),
    name: z.string().trim().min(3, { message: "Nama minimal 3 karakter" }),
    password: z.string().min(8, { message: "Password minimal 8 karakter" }),
    confirmPassword: z.string().min(8, { message: "Konfirmasi password minimal 8 karakter" })
}).refine((data) => data.password === data.confirmPassword, {
    message: "Password dan konfirmasi password tidak sama",
    path: ["confirmPassword"],
})

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
