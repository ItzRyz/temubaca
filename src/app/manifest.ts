import type { MetadataRoute } from "next";

import { appConfig } from "@/config/app";
import { siteDescription } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: `${appConfig.name} — Temukan buku dan teman baca`,
        short_name: appConfig.name,
        description: siteDescription,
        start_url: "/",
        display: "standalone",
        background_color: "#faf7f0",
        theme_color: "#1b4d37",
        lang: "id",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
    };
}
