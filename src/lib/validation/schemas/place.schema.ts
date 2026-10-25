import { z } from "zod";

import { CURATED_PLACE_TYPES, INDONESIA_BOUNDS, PLACE_TYPES, roundCoordinate } from "@/features/places/places";
import { ROUTE_MODES } from "@/features/places/route";

import { regionCodeSchema } from "./community-management.schema";

const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label} maksimal ${max} karakter.`)
    .optional().nullable().transform((value) => value || null);

// Forms send the typed text; an empty field is missing, anything else must parse as a number.
const toNumber = (value: unknown) => (value === "" || value === null || value === undefined ? undefined : typeof value === "string" ? Number(value.replace(",", ".")) : value);
const OUTSIDE = "Titik harus berada di wilayah Indonesia.";

const latitudeSchema = z.preprocess(toNumber, z.number({ error: "Isi lintang dengan angka, misalnya -6.2088." })
    .min(INDONESIA_BOUNDS.south, OUTSIDE).max(INDONESIA_BOUNDS.north, OUTSIDE)
    .transform(roundCoordinate));
const longitudeSchema = z.preprocess(toNumber, z.number({ error: "Isi bujur dengan angka, misalnya 106.8456." })
    .min(INDONESIA_BOUNDS.west, OUTSIDE).max(INDONESIA_BOUNDS.east, OUTSIDE)
    .transform(roundCoordinate));

const pointFields = {
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    addressPublic: z.string({ error: "Alamat publik wajib diisi." }).trim().min(3, "Alamat publik minimal 3 karakter.").max(200, "Alamat publik maksimal 200 karakter."),
};

/** Admin-curated library or public meeting point (DEC-07). */
export const curatedPlaceSchema = z.object({
    type: z.enum(CURATED_PLACE_TYPES, { error: "Pilih jenis tempat." }),
    name: z.string({ error: "Nama tempat wajib diisi." }).trim().min(3, "Nama tempat minimal 3 karakter.").max(120, "Nama tempat maksimal 120 karakter."),
    regionCode: regionCodeSchema,
    source: optionalText(200, "Sumber"),
    ...pointFields,
});

export type CuratedPlaceInput = z.infer<typeof curatedPlaceSchema>;

/** Hide or restore a curated or community place; hiding needs a reason for the audit log. */
export const placeVisibilitySchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("hide"), reason: z.string({ error: "Alasan wajib diisi." }).trim().min(5, "Alasan minimal 5 karakter.").max(500) }),
    z.object({ action: z.literal("restore") }),
]);

/** A community owner's public meeting place; the region comes from the community profile. */
export const communityPlaceSchema = z.object(pointFields);

export type CommunityPlaceInput = z.infer<typeof communityPlaceSchema>;

/** An in-person event's venue; the kab/kota is chosen per event (DEC-07 phase 2). */
export const eventPlaceSchema = z.object({ ...pointFields, regionCode: regionCodeSchema });

export type EventPlaceInput = z.infer<typeof eventPlaceSchema>;

export const placeIdParamSchema = z.object({ placeId: z.uuid({ error: "Invalid ID format." }) });

/**
 * `POST /api/places/[placeId]/route` (TB-064): the reader's point travels in the body, never the URL,
 * so access logs cannot hold it. Only points inside Indonesia's box are accepted.
 */
export const routeRequestSchema = z.object({
    origin: z.object({
        latitude: z.number().min(INDONESIA_BOUNDS.south, OUTSIDE).max(INDONESIA_BOUNDS.north, OUTSIDE),
        longitude: z.number().min(INDONESIA_BOUNDS.west, OUTSIDE).max(INDONESIA_BOUNDS.east, OUTSIDE),
    }).strict(),
    mode: z.enum(ROUTE_MODES, { error: "Pilih moda rute." }),
}).strict();

/** `GET /api/places`: comma-separated `types`, a province (`NN`) or kab/kota (`NN.NN`), and a name search. */
export const placesQuerySchema = z.object({
    types: z.string().optional().transform((value, context) => {
        if (!value) return [...PLACE_TYPES];
        const types = [...new Set(value.split(",").map((type) => type.trim().toUpperCase()).filter(Boolean))];
        if (types.some((type) => !PLACE_TYPES.includes(type as (typeof PLACE_TYPES)[number]))) {
            context.addIssue({ code: "custom", message: "Jenis tempat tidak dikenal." });
            return z.NEVER;
        }
        return types as (typeof PLACE_TYPES)[number][];
    }),
    region: z.string().trim().regex(/^\d{2}(\.\d{2})?$/, "Kode wilayah tidak valid.").optional(),
    q: z.string().trim().max(100).optional().transform((value) => value || undefined),
});
