import { Pool } from "pg";

import { e2eAccounts } from "./accounts";

/**
 * Removes everything the E2E accounts created, so each run starts clean and no test data is left
 * in the development database. Only rows owned by or involving the two E2E accounts are touched;
 * their profiles stay so the next run can sign in again.
 */
export async function cleanE2eData() {
    const emails = Object.values(e2eAccounts).map((account) => account.email).filter(Boolean);
    // Cleanup reads auth.users, so it needs the owner connection, not the runtime role.
    const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!databaseUrl || emails.length === 0) return;

    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const client = await pool.connect();
    try {
        await client.query("begin");
        const users = (await client.query(`select id from auth.users where email = any($1::text[])`, [emails])).rows.map((row) => row.id as string);
        if (users.length > 0) {
            const listings = (await client.query(`select id from book_listings where "ownerId" = any($1::uuid[])`, [users])).rows.map((row) => row.id as string);
            const requests = (await client.query(
                `select id from borrow_requests where "requesterId" = any($1::uuid[]) or "listingId" = any($2::uuid[])`,
                [users, listings],
            )).rows.map((row) => row.id as string);
            await client.query(`delete from borrow_events where "requestId" = any($1::uuid[])`, [requests]);
            // Library access requests (TB-023) belong to the reader, not to a borrow request.
            await client.query(`delete from book_accesses where "requesterId" = any($1::uuid[])`, [users]);
            await client.query(`delete from borrowings where "requestId" = any($1::uuid[])`, [requests]);
            await client.query(`delete from borrow_requests where id = any($1::uuid[])`, [requests]);
            await client.query(`delete from listing_appeals where "listingId" = any($1::uuid[])`, [listings]);
            await client.query(`delete from verifications where "targetType" = 'BOOK_LISTING' and "targetId" = any($1::uuid[])`, [listings]);
            await client.query(`delete from book_listings where id = any($1::uuid[])`, [listings]);
            await client.query(`delete from bookmarks where "userId" = any($1::uuid[])`, [users]);
            await client.query(`delete from user_interests where "userId" = any($1::uuid[])`, [users]);
            await client.query(`delete from recommendations where "userId" = any($1::uuid[])`, [users]);
            // Community applications (memberships, submissions, events and merchandise cascade) and the profile region.
            const communities = (await client.query(`select id from communities where "ownerId" = any($1::uuid[])`, [users])).rows.map((row) => row.id as string);
            await client.query(`delete from verifications where "targetType" = 'COMMUNITY' and "targetId" = any($1::uuid[])`, [communities]);
            await client.query(`delete from communities where id = any($1::uuid[])`, [communities]);
            await client.query(`update user_profiles set "regionCode" = null where id = any($1::uuid[])`, [users]);
        }
        await client.query("commit");
    } catch (error) {
        await client.query("rollback");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

/** A catalog book with no listing yet, so the borrow test owns the only copy on its page. */
export async function bookWithoutListings() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
        const row = (await pool.query(
            `select b.id, b.title from books b where not exists (select 1 from book_listings l where l."bookId" = b.id) order by b.title limit 1`,
        )).rows[0] as { id: string; title: string } | undefined;
        if (!row) throw new Error("No catalog book without listings.");
        return row;
    } finally {
        await pool.end();
    }
}
