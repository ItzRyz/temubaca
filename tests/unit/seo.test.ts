import { describe, expect, mock, test } from "bun:test";

import { jsonLdText } from "@/components/seo/json-ld";

mock.module("@/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://temubaca.vercel.app" } }));
const { googleVerificationCode, listingRobots, pageMetadata, siteMetadata, snippet } = await import("@/config/site");

describe("SEO metadata (29 Okt 2026)", () => {
    test("site defaults: absolute base, title template, Indonesian Open Graph", () => {
        expect(String(siteMetadata.metadataBase)).toBe("https://temubaca.vercel.app/");
        expect(siteMetadata.title).toMatchObject({ template: "%s · TemuBaca" });
        expect(siteMetadata.openGraph).toMatchObject({ locale: "id_ID", siteName: "TemuBaca" });
        expect(siteMetadata.verification).toBeUndefined();
    });

    test("a page gets its canonical, Open Graph and Twitter image", () => {
        const meta = pageMetadata({ title: "Laut Bercerita", description: "Novel.", path: "/books/1", image: "https://img.example/c.jpg" });
        expect(meta.alternates?.canonical).toBe("/books/1");
        expect(meta.openGraph).toMatchObject({ url: "/books/1", title: "Laut Bercerita", images: [{ url: "https://img.example/c.jpg", alt: "Laut Bercerita" }] });
        expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: ["https://img.example/c.jpg"] });
        // Without an image the generated site image is named, since a page's openGraph replaces the parent's.
        const plain = pageMetadata({ title: "A", description: "B", path: "/a" });
        expect(plain.openGraph).toMatchObject({ images: [{ url: "/opengraph-image", width: 1200, height: 630 }] });
        expect(plain.twitter).toMatchObject({ images: ["/twitter-image"] });
    });

    test("list pages with a query are followed but not indexed", () => {
        expect(listingRobots({})).toBeUndefined();
        expect(listingRobots({ q: "" })).toBeUndefined();
        expect(listingRobots({ q: "laut" })).toEqual({ index: false, follow: true });
        expect(listingRobots({ page: "2" })).toEqual({ index: false, follow: true });
    });

    test("snippets collapse whitespace, fall back when empty, and stop near 160 characters", () => {
        expect(snippet("  Satu\n\ndua  ", "x")).toBe("Satu dua");
        expect(snippet(null, "cadangan")).toBe("cadangan");
        const long = snippet("kata ".repeat(60), "x");
        expect(long.length).toBeLessThanOrEqual(158);
        expect(long.endsWith("…")).toBe(true);
    });

    test("the Search Console code is taken from the whole tag Google shows, or used as is", () => {
        expect(googleVerificationCode('<meta name="google-site-verification" content="AbC-12_xyz" />')).toBe("AbC-12_xyz");
        expect(googleVerificationCode("  AbC-12_xyz ")).toBe("AbC-12_xyz");
        expect(googleVerificationCode('"AbC-12_xyz"')).toBe("AbC-12_xyz");
        expect(googleVerificationCode("<meta name=x>")).toBeUndefined();
        expect(googleVerificationCode(undefined)).toBeUndefined();
    });

    test("JSON-LD text cannot close its script tag", () => {
        expect(jsonLdText({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
        expect(JSON.parse(jsonLdText({ name: "a</b" })).name).toBe("a</b");
    });
});
