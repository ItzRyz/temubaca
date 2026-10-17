import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ApplyCommunityForm } from "@/features/community-management/components/community-forms";

export const metadata: Metadata = { title: "Ajukan komunitas" };

/** DEC-04: any signed-in account applies; an admin reviews before the profile goes public. */
export default function NewCommunityPage() {
    return (
        <main className="mx-auto w-full max-w-[860px] px-4 py-8 sm:px-6 sm:py-10">
            <Link href="/communities/mine" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                <ArrowLeft aria-hidden="true" className="size-4" /> Komunitas Saya
            </Link>
            <h1 className="mt-3 font-heading text-[32px] leading-tight font-semibold text-primary">Ajukan Komunitas</h1>
            <p className="mt-1 mb-6 text-muted-foreground">
                Ceritakan komunitas literasi Anda dan sertakan bukti kegiatannya. Setelah disetujui, Anda bisa mengelola acara, merchandise, dan pengurus.
            </p>
            <ApplyCommunityForm />
        </main>
    );
}
