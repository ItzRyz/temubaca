import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth";
import { countBooks, listLatestPublicBooks } from "@/lib/db/queries/books";
import { countUpcomingPublicEvents, listUpcomingPublicEvents } from "@/lib/db/queries/events";
import { listPublicMerchandise } from "@/lib/db/queries/merchandise";
import { HomeBooks } from "@/features/home/components/home-books";
import { HomeEvents } from "@/features/home/components/home-events";
import { HomeHero } from "@/features/home/components/home-hero";
import { HomeMerchandiseBand } from "@/features/home/components/home-merchandise";
import { JsonLd } from "@/components/seo/json-ld";
import { siteDescription, siteUrl } from "@/config/site";
import { appConfig } from "@/config/app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
    const [user, events, eventTotal, books, bookTotal, merchandise] = await Promise.all([
        getCurrentUser(),
        listUpcomingPublicEvents({ limit: 3 }),
        countUpcomingPublicEvents(),
        listLatestPublicBooks(4),
        countBooks(),
        listPublicMerchandise({ limit: 3 }),
    ]);

    return (
        <main>
            <JsonLd data={{
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "WebSite",
                        "@id": new URL("/#website", siteUrl).toString(),
                        name: appConfig.name,
                        url: siteUrl.toString(),
                        description: siteDescription,
                        inLanguage: "id-ID",
                        publisher: { "@id": new URL("/#organization", siteUrl).toString() },
                        // Sitelinks search box: searches go to the catalog.
                        potentialAction: {
                            "@type": "SearchAction",
                            target: { "@type": "EntryPoint", urlTemplate: `${new URL("/books", siteUrl).toString()}?q={search_term_string}` },
                            "query-input": "required name=search_term_string",
                        },
                    },
                    {
                        "@type": "Organization",
                        "@id": new URL("/#organization", siteUrl).toString(),
                        name: appConfig.name,
                        url: siteUrl.toString(),
                        logo: new URL("/icons/icon-512.png", siteUrl).toString(),
                    },
                ],
            }} />
            <HomeHero />
            <HomeEvents events={events} total={eventTotal} />
            <HomeBooks books={books} total={bookTotal} isAuthenticated={user !== null} />
            <HomeMerchandiseBand items={merchandise} />
        </main>
    );
}
