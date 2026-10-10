export const RATE_LIMITS = {
    /**
     * General read operations.
     */
    READ: {
        limit: 100,
        windowSeconds: 60,
    },

    /**
     * Write operations.
     */
    WRITE: {
        limit: 30,
        windowSeconds: 60,
    },

    /**
     * Authentication-related operations.
     */
    AUTH: {
        limit: 10,
        windowSeconds: 60,
    },

    /**
     * Search and discovery.
     */
    SEARCH: {
        limit: 30,
        windowSeconds: 60,
    },

    /**
     * Reports and moderation-related submissions.
     */
    REPORT: {
        limit: 5,
        windowSeconds: 60,
    },
} as const;