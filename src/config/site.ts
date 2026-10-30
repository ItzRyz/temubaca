import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { env } from "@/env";

export const siteUrl = new URL(env.NEXT_PUBLIC_APP_URL);
export const siteTitle = `${appConfig.name} | Temukan buku dan teman baca di sekitarmu`;
export const siteDescription =
    "Pinjam buku dari warga sekitar, temukan komunitas baca dan agendanya, lihat koleksi perpustakaan, dan jelajahi Peta Literasi di TemuBaca.";

/**
 * The Search Console code from `GOOGLE_SITE_VERIFICATION`. Google shows a whole tag
 * (`<meta name="google-site-verification" content="…" />`); either that or just its content is accepted.
 */
export function googleVerificationCode(value: string | undefined) {
    const raw = value?.trim();
    if (!raw) return undefined;
    const fromTag = raw.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    const code = (fromTag ?? raw).trim().replace(/^["']|["']$/g, "");
    return /^[A-Za-z0-9_-]+$/.test(code) ? code : undefined;
}

const googleVerification = googleVerificationCode(env.GOOGLE_SITE_VERIFICATION);

/** Site-wide metadata (SEO, 29 Okt 2026); pages override title, description, canonical and images. */
export const siteMetadata: Metadata = {
    metadataBase: siteUrl,
    title: { default: siteTitle, template: `%s · ${appConfig.name}` },
    description: siteDescription,
    applicationName: appConfig.name,
    keywords: ["pinjam buku", "komunitas baca", "perpustakaan", "literasi", "buku bekas", "Peta Literasi", "agenda baca", "TemuBaca"],
    creator: appConfig.name,
    publisher: appConfig.name,
    category: "books",
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: { type: "website", siteName: appConfig.name, locale: "id_ID", url: "/", title: siteTitle, description: siteDescription },
    twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    ...(googleVerification ? { verification: { google: googleVerification } } : {}),
};

/** For signed-in, admin and auth pages: never in search results. */
export const privateMetadata: Metadata = { robots: { index: false, follow: false } };

/** Public pages are indexed without a query; searches, filters and later pages are followed but not indexed. */
export function listingRobots(params: Record<string, string | string[] | undefined>): Metadata["robots"] {
    return Object.values(params).some((value) => value !== undefined && value !== "") ? { index: false, follow: true } : undefined;
}

/** A shorter description for search snippets: whitespace collapsed, cut at a word near 160 characters. */
export function snippet(text: string | null | undefined, fallback: string) {
    const clean = text?.replace(/\s+/g, " ").trim();
    if (!clean) return fallback;
    if (clean.length <= 160) return clean;
    const cut = clean.slice(0, 157);
    return `${cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : 157)}…`;
}

/**
 * Metadata for one public page: canonical URL, Open Graph and Twitter card. Without `image`, the
 * site's generated image is named explicitly: a page's `openGraph` replaces the parent's, image included.
 */
export function pageMetadata({ title, description, path, image, openGraph }: {
    title: string;
    description: string;
    path: string;
    image?: string | null;
    openGraph?: Partial<NonNullable<Metadata["openGraph"]>>;
}): Metadata {
    const images = image ? [{ url: image, alt: title }] : [{ url: "/opengraph-image", width: 1200, height: 630, alt: siteTitle }];
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: { type: "website", siteName: appConfig.name, locale: "id_ID", url: path, title, description, images, ...openGraph } as Metadata["openGraph"],
        twitter: { card: "summary_large_image", title, description, images: [image ?? "/twitter-image"] },
    };
}
