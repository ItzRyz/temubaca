import { z } from "zod";

const MAX_IMAGE_SIZE =
    5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

export const imageFileSchema =
    z
        .instanceof(File)
        .refine(
            (file) =>
                file.size > 0,
            {
                error:
                    "File must not be empty.",
            },
        )
        .refine(
            (file) =>
                file.size <=
                MAX_IMAGE_SIZE,
            {
                error:
                    "Image must not exceed 5 MB.",
            },
        )
        .refine(
            (file) =>
                ALLOWED_IMAGE_TYPES.includes(
                    file.type as
                    (typeof ALLOWED_IMAGE_TYPES)[number],
                ),
            {
                error:
                    "Unsupported image format.",
            },
        );

export const optionalImageFileSchema =
    imageFileSchema.optional();

export const uploadMetadataSchema =
    z
        .object({
            filename: z
                .string()
                .trim()
                .min(1)
                .max(255),

            contentType: z
                .string()
                .trim()
                .min(1)
                .max(100),

            size: z
                .number()
                .int()
                .positive()
                .max(MAX_IMAGE_SIZE),
        })
        .strict();

export const MAX_UPLOAD_SIZE =
    MAX_IMAGE_SIZE;

export const ALLOWED_UPLOAD_TYPES =
    ALLOWED_IMAGE_TYPES;