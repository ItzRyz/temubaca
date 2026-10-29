import { describe, expect, test } from "bun:test";

import { communityContactLinks } from "@/features/community-management/contacts";

describe("community contact links", () => {
    test("email opens Gmail's compose window, with the address encoded", () => {
        const [email] = communityContactLinks({ contactEmail: "baca+jkt@contoh.id", instagramHandle: null, whatsappNumber: null });
        expect(email.href).toBe("https://mail.google.com/mail/?view=cm&fs=1&to=baca%2Bjkt%40contoh.id");
    });
});
