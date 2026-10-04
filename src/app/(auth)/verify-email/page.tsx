import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type VerifyEmailPageProps = {
    searchParams: Promise<{ error?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
    const { error } = await searchParams;

    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-primary-foreground p-6">
            <Card className="w-full max-w-lg p-8 sm:p-10">
                <CardContent className="flex flex-col items-center gap-5 p-0 text-center">
                    <h1 className="text-2xl font-semibold text-foreground">
                        {error ? "Tautan verifikasi tidak berlaku" : "Periksa email kamu"}
                    </h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                        {error
                            ? "Tautan mungkin sudah digunakan atau kedaluwarsa. Coba daftar kembali atau masuk jika akunmu sudah aktif."
                            : "Kami sudah memproses pendaftaranmu. Buka email konfirmasi dari Supabase untuk mengaktifkan akun. Periksa juga folder spam."}
                    </p>
                    <Button asChild className="mt-2">
                        <Link href="/auth">Kembali ke halaman masuk</Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
