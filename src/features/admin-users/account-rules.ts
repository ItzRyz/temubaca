/** Show only enough of an email to recognise it: `an***@gmail.com`. */
export function maskEmail(email: string | null | undefined) {
    if (!email) return null;
    const at = email.lastIndexOf("@");
    if (at < 1) return "***";
    const local = email.slice(0, at);
    return `${local.slice(0, Math.min(2, local.length - 1) || 1)}***${email.slice(at)}`;
}

export type AccountLabel = "ADMIN" | "COMMUNITY_MANAGER" | "BOOK_OWNER" | "READER";

/** Figma "Peran" column: the platform role first, then what the account does on TemuBaca. */
export function accountLabel(account: { role: string; managedCommunityCount: number; listingCount: number }): AccountLabel {
    if (account.role === "ADMIN") return "ADMIN";
    if (account.managedCommunityCount > 0) return "COMMUNITY_MANAGER";
    if (account.listingCount > 0) return "BOOK_OWNER";
    return "READER";
}

export type AccountActionBlocker = "self" | "admin_target" | null;

/** Admins cannot act on their own account, and cannot suspend another admin without demoting first. */
export function accountActionBlocker(action: "suspend" | "role", input: { actorId: string; targetId: string; targetRole: string }): AccountActionBlocker {
    if (input.actorId === input.targetId) return "self";
    if (action === "suspend" && input.targetRole === "ADMIN") return "admin_target";
    return null;
}
