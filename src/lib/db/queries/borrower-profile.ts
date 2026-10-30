import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../client";
import { bookListings, books, borrowerReviews, borrowings, borrowRequests, communities, userProfiles } from "../schema";
import { listingManagedBy } from "./listing-access";

const lender = alias(userProfiles, "lender");
const reviewer = alias(userProfiles, "reviewer");

/**
 * Who may open a borrower's history and reviews (owner's decision 30 Okt 2026): the borrower, admins, and
 * lenders who received a request from them, for their own copies or a community collection they manage.
 */
export async function canViewBorrowerProfile(viewer: { id: string; role: string }, userId: string) {
    if (viewer.id === userId || viewer.role === "ADMIN") return true;
    const [row] = await db.select({ id: borrowRequests.id }).from(borrowRequests)
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .where(and(eq(borrowRequests.requesterId, userId), listingManagedBy(viewer.id, bookListings.ownerId, bookListings.communityId)))
        .limit(1);
    return Boolean(row);
}

/**
 * A borrower's public-safe profile: name, join date, kab/kota, returned books (each loan once, only RETURNED),
 * and lenders' reviews. Never email, phone or address. Null for an unknown or deleted account.
 */
export async function getBorrowerProfile(userId: string) {
    const [profile] = await db.select({ id: userProfiles.id, displayName: userProfiles.displayName, regionCode: userProfiles.regionCode, districtCode: userProfiles.districtCode, createdAt: userProfiles.createdAt })
        .from(userProfiles).where(and(eq(userProfiles.id, userId), isNull(userProfiles.deletedAt)));
    if (!profile) return null;

    const returned = and(eq(borrowRequests.requesterId, userId), eq(borrowings.status, "RETURNED"));
    const [[{ returnedCount }], returns, reviews] = await Promise.all([
        db.select({ returnedCount: sql<number>`count(distinct "borrowings"."id")::int` })
            .from(borrowings).innerJoin(borrowRequests, eq(borrowRequests.id, borrowings.requestId)).where(returned),
        db.select({
            borrowingId: borrowings.id,
            title: books.title,
            bookId: books.id,
            handedOverAt: borrowings.handedOverAt,
            returnedAt: borrowings.returnedAt,
            lenderName: lender.displayName,
            communityName: communities.name,
        })
            .from(borrowings)
            .innerJoin(borrowRequests, eq(borrowRequests.id, borrowings.requestId))
            .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
            .innerJoin(books, eq(books.id, bookListings.bookId))
            .innerJoin(lender, eq(lender.id, bookListings.ownerId))
            .leftJoin(communities, eq(communities.id, bookListings.communityId))
            .where(returned)
            .orderBy(desc(borrowings.returnedAt))
            .limit(20),
        db.select({
            id: borrowerReviews.id,
            rating: borrowerReviews.rating,
            comment: borrowerReviews.comment,
            createdAt: borrowerReviews.createdAt,
            title: books.title,
            reviewerName: reviewer.displayName,
            communityName: communities.name,
        })
            .from(borrowerReviews)
            .innerJoin(borrowings, eq(borrowings.id, borrowerReviews.borrowingId))
            .innerJoin(borrowRequests, eq(borrowRequests.id, borrowings.requestId))
            .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
            .innerJoin(books, eq(books.id, bookListings.bookId))
            .leftJoin(reviewer, eq(reviewer.id, borrowerReviews.reviewerId))
            .leftJoin(communities, eq(communities.id, borrowerReviews.communityId))
            .where(eq(borrowerReviews.requesterId, userId))
            .orderBy(desc(borrowerReviews.createdAt))
            .limit(50),
    ]);
    const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
    return {
        profile,
        returnedCount,
        returns: returns.map(({ lenderName, communityName, ...row }) => ({ ...row, lender: communityName ?? lenderName })),
        reviews: reviews.map(({ reviewerName, communityName, ...row }) => ({ ...row, reviewer: communityName ?? reviewerName ?? "Pemberi pinjam" })),
        average,
    };
}
