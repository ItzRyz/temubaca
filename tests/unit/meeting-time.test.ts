import { describe, expect, test } from "bun:test";

import { meetingTimeFrom, meetingTimeLabel, wibDate } from "@/features/borrowing/meeting-time";

// 30 Okt 2026, 22:00 WIB = 15:00 UTC.
const now = new Date("2026-10-30T15:00:00Z");

describe("preferred meeting time (WIB)", () => {
    test("a WIB date and time keep their hour regardless of the server's zone", () => {
        const result = meetingTimeFrom("2026-11-02", "09:30", now);
        expect("at" in result && result.at?.toISOString()).toBe("2026-11-02T02:30:00.000Z");
        expect(meetingTimeLabel({ preferredAt: (result as { at: Date }).at, preferredTime: null })).toBe("Senin, 2 Nov 2026 · 09.30 WIB");
    });

    test("WIB today is used near midnight UTC", () => {
        expect(wibDate(new Date("2026-10-30T18:30:00Z"))).toBe("2026-10-31");
    });

    test("both or neither; never a made-up hour", () => {
        expect(meetingTimeFrom(undefined, undefined, now)).toEqual({ at: null });
        expect(meetingTimeFrom("2026-11-02", undefined, now)).toMatchObject({ error: expect.stringContaining("jam") });
        expect(meetingTimeFrom(undefined, "09:30", now)).toMatchObject({ error: expect.stringContaining("tanggal") });
    });

    test("past, far future and impossible dates are refused", () => {
        expect(meetingTimeFrom("2026-10-30", "21:00", now)).toMatchObject({ error: expect.stringContaining("lewat") });
        expect(meetingTimeFrom("2027-03-01", "10:00", now)).toMatchObject({ error: expect.stringContaining("60 hari") });
        expect(meetingTimeFrom("2026-02-30", "10:00", now)).toMatchObject({ error: expect.any(String) });
        expect(meetingTimeFrom("2026-11-02", "25:00", now)).toMatchObject({ error: expect.any(String) });
    });

    test("older free-text requests and empty ones read clearly", () => {
        expect(meetingTimeLabel({ preferredAt: null, preferredTime: "Sabtu pagi" })).toBe("Sabtu pagi");
        expect(meetingTimeLabel({ preferredAt: null, preferredTime: null })).toBe("Belum ditentukan");
    });
});
