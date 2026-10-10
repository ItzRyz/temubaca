import { redirect } from "next/navigation";

/** The admin portal opens on the review queue (Figma "Peninjauan"). */
export default function AdminPage() {
    redirect("/moderation/reports");
}
