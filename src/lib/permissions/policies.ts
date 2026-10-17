import "server-only";

import type {
    CommunityRole,
    PlatformRole,
} from "./roles";

export const policies = {
    platform: {
        readPublicContent: () => true,

        managePlatform:
            (role: PlatformRole) =>
                role === "ADMIN",

        moderateReports:
            (role: PlatformRole) =>
                role === "ADMIN",

        manageVerification:
            (role: PlatformRole) =>
                role === "ADMIN",

        manageUsers:
            (role: PlatformRole) =>
                role === "ADMIN",
    },

    community: {
        view: () => true,

        manage:
            (role: CommunityRole) =>
                role === "OWNER" ||
                role === "MANAGER",

        manageAsOwner:
            (role: CommunityRole) =>
                role === "OWNER",

        manageMembers:
            (role: CommunityRole) =>
                role === "OWNER" ||
                role === "MANAGER",

        manageEvents:
            (role: CommunityRole) =>
                role === "OWNER" ||
                role === "MANAGER",

        manageMerchandise:
            (role: CommunityRole) =>
                role === "OWNER" ||
                role === "MANAGER",
    },

    book: {
        createListing:
            (role: PlatformRole) =>
                role === "MEMBER" ||
                role === "ADMIN",

        manageOwnListing:
            (role: PlatformRole) =>
                role === "MEMBER" ||
                role === "ADMIN",
    },

    borrowing: {
        // DEC-02: any signed-in, unsuspended account may borrow and lend; per-loan rules live in
        // features/borrowing/lifecycle.ts, and only admins settle disputes.
        request:
            (role: PlatformRole) =>
                role === "MEMBER" ||
                role === "ADMIN",

        manageOwnRequest:
            (role: PlatformRole) =>
                role === "MEMBER" ||
                role === "ADMIN",

        manageListingRequests:
            (role: PlatformRole) =>
                role === "MEMBER" ||
                role === "ADMIN",

        complete:
            (role: PlatformRole) =>
                role === "MEMBER" ||
                role === "ADMIN",

        resolveDispute:
            (role: PlatformRole) =>
                role === "ADMIN",
    },
} as const;
