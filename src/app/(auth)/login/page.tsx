import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { safeNextPath } from "@/features/auth/safe-next-path";

type LoginPageProps = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const { next } = await searchParams;
    return <AuthPageShell initialMode="masuk" next={safeNextPath(typeof next === "string" ? next : undefined)} />;
}
