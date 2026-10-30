import type { MetadataRoute } from "next";

import { siteUrl } from "@/config/site";

/** Public pages are crawlable; personal, admin, auth and API routes are not (SEO, 29 Okt 2026). */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [
                "/api/",
                "/admin",
                "/moderation",
                "/dashboard",
                "/profile",
                "/settings",
                "/bookmarks",
                "/recommendations",
                "/minat",
                "/members/",
                "/my-listings",
                "/my-libraries",
                "/communities/mine",
                "/communities/new",
                "/communities/invite/",
                "/communities/*/manage",
                "/libraries/*/manage",
                "/login",
                "/register",
                "/logout",
                "/forgot-password",
                "/update-password",
                "/verify-email",
                "/auth",
                "/callback",
                "/dev",
            ],
        },
        sitemap: new URL("/sitemap.xml", siteUrl).toString(),
        host: siteUrl.origin,
    };
}
