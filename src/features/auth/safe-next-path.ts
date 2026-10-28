/** Only same-site paths may be used as a post-login destination (no `//host`, schemes, or backslashes). */
export function safeNextPath(value: string | undefined) {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return undefined;
    return value.slice(0, 500);
}

/** "Pilih minat": after sign-up, and after each sign-in while the account has no interests. */
export const INTERESTS_PATH = "/minat";

/** Where a fresh sign-in goes: the interest page first when the account has none, then the asked-for page. */
export function afterSignInPath(next: string | undefined, needsInterests: boolean) {
    const target = safeNextPath(next) ?? "/";
    return needsInterests ? `${INTERESTS_PATH}?next=${encodeURIComponent(target)}` : target;
}
