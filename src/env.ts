import "server-only";

import { z } from "zod";
import {
    clientEnvironmentSchema,
    httpsUrlSchema,
    postgresConnectionUrlSchema,
} from "@/lib/validation/schemas/environment.schema";
import { getPostgresTlsQueryParameters } from "@/lib/db/connection";

const serverSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),

    DATABASE_URL: postgresConnectionUrlSchema,

    DATABASE_SSL_CA: z.string().trim().min(1).optional(),

    DIRECT_URL: postgresConnectionUrlSchema.optional(),

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

    UPSTASH_REDIS_REST_URL: httpsUrlSchema.optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
}).superRefine((values, context) => {
    if (values.NODE_ENV !== "production") {
        return;
    }

    const tlsQueryParameters = getPostgresTlsQueryParameters(values.DATABASE_URL);
    if (tlsQueryParameters.length > 0) {
        context.addIssue({
            code: "custom",
            path: ["DATABASE_URL"],
            message: `Remove PostgreSQL TLS query options (${tlsQueryParameters.join(", ")}) from DATABASE_URL in production; TLS is configured and verified by the application.`,
        });
    }

    if (!values.UPSTASH_REDIS_REST_URL) {
        context.addIssue({
            code: "custom",
            path: ["UPSTASH_REDIS_REST_URL"],
            message: "Required in production because API routes use rate limiting.",
        });
    }

    if (!values.UPSTASH_REDIS_REST_TOKEN) {
        context.addIssue({
            code: "custom",
            path: ["UPSTASH_REDIS_REST_TOKEN"],
            message: "Required in production because API routes use rate limiting.",
        });
    }
});

const serverEnv = serverSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,

    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_SSL_CA: process.env.DATABASE_SSL_CA,
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

    UPSTASH_REDIS_REST_URL:
        process.env.UPSTASH_REDIS_REST_URL,

    UPSTASH_REDIS_REST_TOKEN:
        process.env.UPSTASH_REDIS_REST_TOKEN,
});

const clientEnv = clientEnvironmentSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
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
