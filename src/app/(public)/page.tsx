import { getCurrentUser } from "@/lib/auth";
import { countBooks, listLatestPublicBooks } from "@/lib/db/queries/books";
import { countUpcomingPublicEvents, listUpcomingPublicEvents } from "@/lib/db/queries/events";
import { listPublicMerchandise } from "@/lib/db/queries/merchandise";
import { HomeBooks } from "@/features/home/components/home-books";
import { HomeEvents } from "@/features/home/components/home-events";
import { HomeHero } from "@/features/home/components/home-hero";
import { HomeMerchandiseBand } from "@/features/home/components/home-merchandise";

export const dynamic = "force-dynamic";

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
            <HomeHero />
            <HomeEvents events={events} total={eventTotal} />
            <HomeBooks books={books} total={bookTotal} isAuthenticated={user !== null} />
            <HomeMerchandiseBand items={merchandise} />
        </main>
    );
}
