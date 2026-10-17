/** Only same-site paths may be used as a post-login destination (no `//host`, schemes, or backslashes). */
export function safeNextPath(value: string | undefined) {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return undefined;
    return value.slice(0, 500);
}
