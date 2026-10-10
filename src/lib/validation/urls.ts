import { z } from "zod";

const HTTP_PROTOCOLS = [
    "http:",
    "https:",
] as const;

export const httpUrlSchema =
    z
        .string()
        .trim()
        .max(2_048)
        .url()
        .refine(
            (value) => {
                const url = new URL(value);

                return HTTP_PROTOCOLS.includes(
                    url.protocol as
                    (typeof HTTP_PROTOCOLS)[number],
                );
            },
            {
                error:
                    "URL must use HTTP or HTTPS.",
            },
        );

export const optionalHttpUrlSchema =
    httpUrlSchema.optional();

export const nullableHttpUrlSchema =
    httpUrlSchema.nullable();

export const imageUrlSchema =
    httpUrlSchema.refine(
        (value) => {
            const url = new URL(value);

            return [
                "http:",
                "https:",
            ].includes(url.protocol);
        },
        {
            error:
                "Invalid image URL.",
        },
    );

export const sameOriginUrlSchema = (
    origin: string,
) =>
    httpUrlSchema.refine(
        (value) => {
            const url = new URL(value);

            return url.origin === origin;
        },
        {
            error:
                "URL must belong to the allowed origin.",
        },
    );