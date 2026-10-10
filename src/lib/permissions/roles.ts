import "server-only";

import {
    membershipRoleValues,
    membershipStatusValues,
    userRoles,
} from "@/lib/db/schema";

export const PLATFORM_ROLES =
    userRoles;

export const COMMUNITY_ROLES =
    membershipRoleValues;

export const MEMBERSHIP_STATUSES =
    membershipStatusValues;

export type PlatformRole =
    (typeof PLATFORM_ROLES)[number];

export type CommunityRole =
    (typeof COMMUNITY_ROLES)[number];

export type MembershipStatus =
    (typeof MEMBERSHIP_STATUSES)[number];

export const PLATFORM_ROLE = {
    MEMBER: "MEMBER",
    ADMIN: "ADMIN",
} as const satisfies Record<
    PlatformRole,
    PlatformRole
>;

export const COMMUNITY_ROLE = {
    OWNER: "OWNER",
    MANAGER: "MANAGER",
    MEMBER: "MEMBER",
} as const satisfies Record<
    CommunityRole,
    CommunityRole
>;

export const MEMBERSHIP_STATUS = {
    PENDING: "PENDING",
    ACTIVE: "ACTIVE",
    REJECTED: "REJECTED",
    LEFT: "LEFT",
    REMOVED: "REMOVED",
} as const satisfies Record<
    MembershipStatus,
    MembershipStatus
>;

export function isAdmin(
    role: PlatformRole,
): boolean {
    return role === "ADMIN";
}

export function isMember(
    role: PlatformRole,
): boolean {
    return role === "MEMBER";
}

export function isCommunityOwnerRole(
    role: CommunityRole,
): boolean {
    return role === "OWNER";
}

export function isCommunityManager(
    role: CommunityRole,
): boolean {
    return (
        role === "OWNER" ||
        role === "MANAGER"
    );
}

export function isActiveMembership(
    status: MembershipStatus,
): boolean {
    return status === "ACTIVE";
}