import { describe, expect, test } from "bun:test";

import { addMeetingPoint, composeListingDetails } from "../../src/features/book-listings/listing-draft";
import { manualBookSchema } from "../../src/lib/validation/schemas/book.schema";

describe("Tambah Buku draft", () => {
    test("meeting points are trimmed, deduplicated, and capped", () => {
        let points = addMeetingPoint([], "  Taman   Suropati ");
        points = addMeetingPoint(points, "taman suropati");
        points = addMeetingPoint(points, "TIM Cikini");
        points = addMeetingPoint(points, "   ");
        points = addMeetingPoint(points, "Stasiun Manggarai");
        points = addMeetingPoint(points, "Kafe Keempat");
        expect(points).toEqual(["Taman Suropati", "TIM Cikini", "Stasiun Manggarai"]);
    });

    test("structured fields fold into the stored location and rules", () => {
        expect(composeListingDetails({ meetingPoints: ["Taman Suropati", "TIM Cikini"], loanDays: 14, conditionNote: " Tersampul mika " })).toEqual({
            publicLocation: "Taman Suropati & TIM Cikini",
            borrowingRules: "Lama pinjam: 14 hari.\nCatatan kondisi: Tersampul mika",
        });
        expect(composeListingDetails({ meetingPoints: [], loanDays: 7 })).toEqual({ publicLocation: undefined, borrowingRules: "Lama pinjam: 7 hari." });
    });

    test("manual books need a title, author, and genre; year and ISBN are checked", () => {
        expect(manualBookSchema.safeParse({ title: "Hujan Bulan Juni", author: "Sapardi Djoko Damono", category: "Puisi" }).success).toBe(true);
        expect(manualBookSchema.safeParse({ title: "Hujan Bulan Juni", author: "Sapardi Djoko Damono", category: "Puisi", publishedAt: "15" }).success).toBe(false);
        expect(manualBookSchema.safeParse({ title: "Hujan Bulan Juni", author: "Sapardi Djoko Damono", category: "Puisi", isbn: "123" }).success).toBe(false);
        expect(manualBookSchema.safeParse({ title: "", author: "Sapardi", category: "Puisi" }).success).toBe(false);
    });
});
