import { describe, expect, test } from "bun:test";

import { distanceMeters, formatDistance, googleMapsUrl, isInsideIndonesia } from "../../src/features/places/places";
import { communityPlaceSchema, curatedPlaceSchema, placesQuerySchema } from "../../src/lib/validation/schemas/place.schema";

describe("Peta Literasi rules (DEC-07)", () => {
    test("Google Maps links use Maps URLs api=1 with an encoded comma", () => {
        expect(googleMapsUrl(-6.1815, 106.8272)).toBe("https://www.google.com/maps/search/?api=1&query=-6.1815%2C106.8272");
    });

    test("points must sit inside Indonesia's bounding box", () => {
        expect(isInsideIndonesia(-6.2, 106.8)).toBe(true);
        expect(isInsideIndonesia(1.35, 103.82)).toBe(true); // Singapore is inside the box; the box is generous by design.
        expect(isInsideIndonesia(51.5, -0.12)).toBe(false);
        expect(isInsideIndonesia(-6.2, 150)).toBe(false);
    });

    test("distances are straight-line and rounded for display", () => {
        // Monas to Bundaran HI is about 2.2 km.
        const meters = distanceMeters({ latitude: -6.1754, longitude: 106.8272 }, { latitude: -6.1950, longitude: 106.8230 });
        expect(meters).toBeGreaterThan(2100);
        expect(meters).toBeLessThan(2300);
        expect(formatDistance(40)).toBe("100 m");
        expect(formatDistance(860)).toBe("900 m");
        expect(formatDistance(2190)).toBe("2,2 km");
        expect(formatDistance(23_400)).toBe("23 km");
    });
});

describe("place validation (DEC-07)", () => {
    const curated = { type: "LIBRARY", name: "Perpustakaan Nasional", addressPublic: "Jl. Medan Merdeka Selatan No. 11", regionCode: "31.71", latitude: "-6.1815", longitude: "106.8272" };
    const issue = (input: Record<string, unknown>) => curatedPlaceSchema.safeParse({ ...curated, ...input }).error?.issues[0]?.message;

    test("form text becomes rounded numbers, and a comma decimal is accepted", () => {
        const parsed = curatedPlaceSchema.parse({ ...curated, latitude: "-6,18151234", longitude: 106.82721999 });
        expect(parsed.latitude).toBe(-6.181512);
        expect(parsed.longitude).toBe(106.82722);
        expect(parsed.source).toBeNull();
    });

    test("missing, non-numeric, and out-of-Indonesia points are rejected with a reason", () => {
        expect(issue({ latitude: "" })).toBe("Isi lintang dengan angka, misalnya -6.2088.");
        expect(issue({ longitude: "timur" })).toBe("Isi bujur dengan angka, misalnya 106.8456.");
        expect(issue({ latitude: "51.5", longitude: "-0.12" })).toBe("Titik harus berada di wilayah Indonesia.");
        expect(issue({ regionCode: "31.99" })).toBe("Pilih kabupaten/kota dari daftar.");
        // Community pins come from the owner, never from the admin form.
        expect(issue({ type: "COMMUNITY" })).toBe("Pilih jenis tempat.");
    });

    test("community pins need a public address and a point", () => {
        expect(communityPlaceSchema.safeParse({ addressPublic: "Taman Suropati", latitude: "-6.1993", longitude: "106.8323" }).success).toBe(true);
        expect(communityPlaceSchema.safeParse({ addressPublic: "", latitude: "-6.1993", longitude: "106.8323" }).success).toBe(false);
    });

    test("the public query accepts known types and a province or kab/kota prefix", () => {
        expect(placesQuerySchema.parse({}).types).toEqual(["LIBRARY", "COMMUNITY", "EVENT", "MEETING_POINT"]);
        expect(placesQuerySchema.parse({ types: "library, community,library", region: "31" })).toEqual({ types: ["LIBRARY", "COMMUNITY"], region: "31", q: undefined });
        expect(placesQuerySchema.safeParse({ types: "house" }).success).toBe(false);
        expect(placesQuerySchema.safeParse({ region: "31-71" }).success).toBe(false);
    });
});
