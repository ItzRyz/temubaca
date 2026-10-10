import { z } from "zod";

const httpOriginSchema = z.url().refine((value) => {
    const url = new URL(value);
    return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
    );
}, "Must be an HTTP(S) origin without credentials, path, query, or fragment.");

export const httpsUrlSchema = z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
}, "Must use HTTPS and must not include URL credentials.");

export const postgresConnectionUrlSchema = z.string().trim().min(1).superRefine((value, context) => {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        context.addIssue({ code: "custom", message: "Must be a valid PostgreSQL connection URL." });
        return;
    }

    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
        context.addIssue({ code: "custom", message: "Must use the postgres:// or postgresql:// scheme." });
    }
    if (!url.hostname) {
        context.addIssue({ code: "custom", message: "Must include a PostgreSQL hostname." });
    }
    if (url.pathname.length < 2) {
        context.addIssue({ code: "custom", message: "Must include a PostgreSQL database name." });
    }
});

export const clientEnvironmentSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: httpOriginSchema,
    NEXT_PUBLIC_SUPABASE_URL: httpOriginSchema,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
}).superRefine((values, context) => {
    if (values.NODE_ENV !== "production") return;

    for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const) {
        const url = new URL(values[key]);
        const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

        if (url.protocol !== "https:" && !isLoopback) {
            context.addIssue({
                code: "custom",
                path: [key],
                message: "Must use HTTPS in production.",
            });
        }
    }
});
