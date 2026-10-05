import { z } from "zod";

const serverSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),

    DATABASE_URL: z
        .string()
        .min(1, "DATABASE_URL is required"),

    DIRECT_URL: z
        .string()
        .min(1, "DIRECT_URL is required")
        .optional(),

    SUPABASE_SERVICE_ROLE_KEY: z
        .string()
        .min(1, "SUPABASE_SERVICE_ROLE_KEY is required")
        .optional(),

    GOOGLE_BOOKS_API_KEY: z
        .string()
        .optional(),

    OPEN_LIBRARY_BASE_URL: z
        .url()
        .default("https://openlibrary.org"),

    RECOMMENDATION_API_URL: z
        .url()
        .optional(),

    RECOMMENDATION_API_KEY: z
        .string()
        .optional(),

    INTERNAL_API_SECRET: z
        .string()
        .min(32, "INTERNAL_API_SECRET must be at least 32 characters")
        .optional(),
});

const clientSchema = z.object({
    NEXT_PUBLIC_APP_URL: z.url(),

    NEXT_PUBLIC_SUPABASE_URL: z.url(),

    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
        .string()
        .min(
            1,
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required",
        ),
});

const serverEnv = serverSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,

    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,

    SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY,

    GOOGLE_BOOKS_API_KEY:
        process.env.GOOGLE_BOOKS_API_KEY,

    OPEN_LIBRARY_BASE_URL:
        process.env.OPEN_LIBRARY_BASE_URL,

    RECOMMENDATION_API_URL:
        process.env.RECOMMENDATION_API_URL,

    RECOMMENDATION_API_KEY:
        process.env.RECOMMENDATION_API_KEY,

    INTERNAL_API_SECRET:
        process.env.INTERNAL_API_SECRET,
});

const clientEnv = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL:
        process.env.NEXT_PUBLIC_APP_URL,

    NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL,

    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!serverEnv.success) {
    console.error(
        "Invalid server environment variables:",
        z.treeifyError(serverEnv.error),
    );

    throw new Error(
        "Invalid server environment variables",
    );
}

if (!clientEnv.success) {
    console.error(
        "Invalid client environment variables:",
        z.treeifyError(clientEnv.error),
    );

    throw new Error(
        "Invalid client environment variables",
    );
}

export const env = {
    ...serverEnv.data,
    ...clientEnv.data,
};