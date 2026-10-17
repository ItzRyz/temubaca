export type ListingDeletionBlocker = "reserved" | "has_requests";

/**
 * A listing can be deleted only while no borrower depends on it: reserved
 * copies are mid-handover, and borrow requests keep a restrict FK on it.
 */
export function listingDeletionBlocker(listing: {
    availability: string;
    borrowRequestCount: number;
}): ListingDeletionBlocker | null {
    if (listing.availability === "RESERVED") return "reserved";
    if (listing.borrowRequestCount > 0) return "has_requests";
    return null;
}

export const listingDeletionBlockerMessage: Record<ListingDeletionBlocker, string> = {
    reserved: "Listing yang sedang dipesan tidak dapat dihapus.",
    has_requests: "Listing ini punya riwayat permintaan pinjam. Tandai sebagai tidak ditawarkan saja.",
};
