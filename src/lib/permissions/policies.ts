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
        // Borrowing policy stays closed until DEC-02 defines the lifecycle and actor rules.
        request: () => false,

        manageOwnRequest: () => false,

        manageListingRequests: () => false,

        complete: () => false,
    },
} as const;
