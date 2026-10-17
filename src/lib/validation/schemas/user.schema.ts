import { z } from "zod";

import { userRoles } from "@/lib/db/schema";

export const userSuspensionSchema =
    z
        .object({
            suspended: z.boolean(),

            reason:
                z.string().trim().max(500).optional(),
        })
        .strict()
        .refine((input) => !input.suspended || (input.reason?.length ?? 0) >= 3, {
            message: "Alasan wajib diisi (minimal 3 karakter) untuk menangguhkan akun.",
            path: ["reason"],
        });

export const userRoleChangeSchema =
    z
        .object({
            role: z.enum(userRoles),

            note:
                z.string().trim().max(500).optional(),
        })
        .strict();
