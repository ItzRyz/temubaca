import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { countCommunityLoansNeedingAction } from "@/lib/db/queries/borrowing";
import { countCommunityContent, getCommunityAccess } from "@/lib/db/queries/community-management";
import { uuidSchema } from "@/lib/validation/common";

import { communityCapabilities, type CommunityStatus } from "./rules";

/** Shared by the manage layout and its pages; strangers get a 404 rather than a hint the community exists. */
export const loadManageContext = cache(async (communityId: string) => {
    if (!uuidSchema.safeParse(communityId).success) notFound();
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();
    const access = await getCommunityAccess(user.id, communityId);
    if (!access?.role) notFound();
    const status = access.community.status as CommunityStatus;
    return {
        user,
        community: access.community,
        role: access.role,
        status,
        can: communityCapabilities(access.role, status),
        counts: {
            ...await countCommunityContent(communityId),
            // Loans of the community's collection waiting for a manager (30 Okt 2026).
            loansNeedingAction: (await countCommunityLoansNeedingAction(user.id)).get(communityId) ?? 0,
        },
    };
});

/** WIB date/time strings for form inputs. */
export function wibParts(value: Date | null) {
    if (!value) return { date: "", time: "" };
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
