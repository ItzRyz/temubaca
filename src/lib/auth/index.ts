export {
    getCurrentUser,
    getCurrentUserId,
    requireUser,
    requireUserId,
    isAuthenticated,
    hasRole,
    requireRole,
    requireAdmin,
} from "./server";

export {
    getSession,
    getSessionUser,
    getSessionUserId,
    getSessionRole,
    isSessionAuthenticated,
} from "./session";

export {
    ensureUserProfile,
    getProfileDisplayName,
    updateUserProfile,
    deleteUserProfile,
} from "./callbacks";

export type {
    UserRole,
    UserProfile,
    AuthUser,
    Session,
    AuthSession,
} from "./session";
