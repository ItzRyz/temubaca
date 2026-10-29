import type { MetadataRoute } from "next";

import { siteUrl } from "@/config/site";
import { listSitemapEntries } from "@/lib/db/queries/sitemap";

export const revalidate = 3600;

const staticPages: { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/books", changeFrequency: "daily", priority: 0.9 },
    { path: "/communities", changeFrequency: "daily", priority: 0.8 },
    { path: "/events", changeFrequency: "daily", priority: 0.8 },
    { path: "/merchandise", changeFrequency: "weekly", priority: 0.6 },
    { path: "/libraries", changeFrequency: "weekly", priority: 0.7 },
    { path: "/map", changeFrequency: "weekly", priority: 0.7 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/help", changeFrequency: "monthly", priority: 0.4 },
    { path: "/safety", changeFrequency: "monthly", priority: 0.4 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.2 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.2 },
];

/** Every public page, refreshed hourly (SEO, 29 Okt 2026). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const url = (path: string) => new URL(path, siteUrl).toString();
    const entries = await listSitemapEntries();
    const detail = (prefix: string, rows: { id: string; updatedAt: Date }[], priority: number) =>
        rows.map((row) => ({ url: url(`${prefix}/${row.id}`), lastModified: row.updatedAt, changeFrequency: "weekly" as const, priority }));
    return [
        ...staticPages.map((page) => ({ url: url(page.path), changeFrequency: page.changeFrequency, priority: page.priority })),
        ...detail("/books", entries.books, 0.7),
        ...detail("/communities", entries.communities, 0.7),
        ...detail("/events", entries.events, 0.6),
        ...detail("/merchandise", entries.merchandise, 0.5),
        ...detail("/libraries", entries.libraries, 0.6),
    ];
}
