import AuthCard from "@/components/auth/AuthCard";
import StoryCard from "@/components/auth/StoryCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AuthPage() {
    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-primary-foreground p-4 sm:p-8">
            <section className="flex w-full max-w-7xl flex-col gap-6">
                <div>
                    <Button asChild variant="ghost" className="flex flex-row items-center justify-end gap-3">
                        <Link href="/">
                            {"<-"}
                            <span>Kembali ke beranda</span>
                        </Link>
                    </Button>
                </div>
                <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:gap-12">
                    <StoryCard />
                    <AuthCard />
                </div>
            </section>
        </main>
    )
}
