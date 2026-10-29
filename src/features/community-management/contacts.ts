/** Gmail's compose window for `address` (owner's decision 29 Okt 2026: email buttons open Gmail in a new tab). */
export function gmailComposeUrl(address: string) {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(address)}`;
}

/** Public contact links a verified community chose to show (DEC-04). Every link opens in a new tab. */
export function communityContactLinks(community: { contactEmail: string | null; instagramHandle: string | null; whatsappNumber: string | null }) {
    const links: { kind: "email" | "instagram" | "whatsapp"; label: string; value: string; href: string }[] = [];
    if (community.whatsappNumber) {
        links.push({ kind: "whatsapp", label: "WhatsApp", value: `0${community.whatsappNumber.replace(/^\+62/, "")}`, href: `https://wa.me/${community.whatsappNumber.replace(/^\+/, "")}` });
    }
    if (community.instagramHandle) {
        links.push({ kind: "instagram", label: "Instagram", value: `@${community.instagramHandle}`, href: `https://instagram.com/${encodeURIComponent(community.instagramHandle)}` });
    }
    if (community.contactEmail) {
        links.push({ kind: "email", label: "Surel", value: community.contactEmail, href: gmailComposeUrl(community.contactEmail) });
    }
    return links;
}
