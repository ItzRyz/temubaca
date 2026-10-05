import "server-only";

import {
    desc,
    eq,
} from "drizzle-orm";

import { db } from "../client";

import {
    borrowRequests,
    borrowings,
    bookAccesses,
} from "../schema";

export async function findBorrowRequestById(
    requestId: string,
) {
    return db.query.borrowRequests.findFirst({
        where: eq(
            borrowRequests.id,
            requestId,
        ),

        with: {
            listing: {
                with: {
                    book: true,
                    ownerUser: true,
                },
            },

            requester: true,

            borrowing: true,

            access: true,
        },
    });
}

export async function listBorrowRequestsByUser(
    userId: string,
) {
    return db.query.borrowRequests.findMany({
        where: eq(
            borrowRequests.requesterId,
            userId,
        ),

        with: {
            listing: {
                with: {
                    book: true,
                    ownerUser: true,
                },
            },

            borrowing: true,

            access: true,
        },

        orderBy: [
            desc(borrowRequests.requestedAt),
        ],
    });
}

export async function listBorrowRequestsForListing(
    listingId: string,
) {
    return db.query.borrowRequests.findMany({
        where: eq(
            borrowRequests.listingId,
            listingId,
        ),

        with: {
            requester: true,
            borrowing: true,
            access: true,
        },

        orderBy: [
            desc(borrowRequests.requestedAt),
        ],
    });
}

export async function createBorrowRequest(
    input: {
        listingId: string;
        requesterId: string;
        note?: string;
    },
) {
    const [request] = await db
        .insert(borrowRequests)
        .values({
            listingId: input.listingId,
            requesterId: input.requesterId,
            note: input.note,
            status: "PENDING",
        })
        .returning();

    return request;
}

export async function updateBorrowRequestStatus(
    requestId: string,
    status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED"
        | "COMPLETED",
) {
    const [request] = await db
        .update(borrowRequests)
        .set({
            status,
            updatedAt: new Date(),

            respondedAt:
                status === "APPROVED" ||
                    status === "REJECTED"
                    ? new Date()
                    : undefined,
        })
        .where(
            eq(
                borrowRequests.id,
                requestId,
            ),
        )
        .returning();

    return request ?? null;
}

export async function cancelBorrowRequest(
    requestId: string,
) {
    return updateBorrowRequestStatus(
        requestId,
        "CANCELLED",
    );
}

export async function findBorrowingByRequestId(
    requestId: string,
) {
    return db.query.borrowings.findFirst({
        where: eq(
            borrowings.requestId,
            requestId,
        ),

        with: {
            request: {
                with: {
                    listing: {
                        with: {
                            book: true,
                            ownerUser: true,
                        },
                    },

                    requester: true,
                },
            },
        },
    });
}

export async function listUserBorrowings(
    userId: string,
) {
    return db.query.borrowings.findMany({
        with: {
            request: {
                with: {
                    requester: true,

                    listing: {
                        with: {
                            book: true,
                            ownerUser: true,
                        },
                    },
                },
            },
        },

        where: eq(
            borrowings.status,
            "ACTIVE",
        ),

        orderBy: [
            desc(borrowings.createdAt),
        ],
    });
}

export async function createBorrowing(input: {
    requestId: string;
    handedOverAt?: Date;
    dueAt?: Date;
    note?: string;
}) {
    const [borrowing] = await db
        .insert(borrowings)
        .values({
            requestId: input.requestId,
            status: "ACTIVE",
            handedOverAt:
                input.handedOverAt,
            dueAt: input.dueAt,
            note: input.note,
        })
        .returning();

    return borrowing;
}

export async function updateBorrowingStatus(
    borrowingId: string,
    status:
        | "ACTIVE"
        | "OVERDUE"
        | "RETURNED"
        | "LOST"
        | "CANCELLED",
) {
    const [borrowing] = await db
        .update(borrowings)
        .set({
            status,

            returnedAt:
                status === "RETURNED"
                    ? new Date()
                    : undefined,

            updatedAt: new Date(),
        })
        .where(
            eq(
                borrowings.id,
                borrowingId,
            ),
        )
        .returning();

    return borrowing ?? null;
}

export async function findBookAccessByRequestId(
    requestId: string,
) {
    return db.query.bookAccesses.findFirst({
        where: eq(
            bookAccesses.requestId,
            requestId,
        ),
    });
}

export async function createBookAccess(input: {
    requestId: string;
    expiresAt?: Date;
    note?: string;
}) {
    const [access] = await db
        .insert(bookAccesses)
        .values({
            requestId: input.requestId,
            status: "ACTIVE",
            expiresAt:
                input.expiresAt,
            note: input.note,
        })
        .returning();

    return access;
}

export async function revokeBookAccess(
    accessId: string,
) {
    const [access] = await db
        .update(bookAccesses)
        .set({
            status: "REVOKED",
            revokedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(
            eq(
                bookAccesses.id,
                accessId,
            ),
        )
        .returning();

    return access ?? null;
}