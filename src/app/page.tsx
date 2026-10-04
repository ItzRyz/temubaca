import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-primary-foreground p-6">
            <Card className="w-full max-w-2xl p-8 sm:p-12">
                <CardContent className="flex flex-col items-center gap-5 p-0 text-center">
                    <p className="text-sm font-semibold uppercase tracking-widest text-primary">TemuBaca</p>
                    <h1 className="text-3xl font-semibold text-foreground">Akunmu sudah aktif</h1>
                    <p className="max-w-lg text-base leading-7 text-muted-foreground">
                        Selamat datang di TemuBaca. Pendaftaran dan autentikasi berhasil. Fitur ruang baca akan tersedia di sini.
                    </p>
                    <form action={signOut}>
                        <Button type="submit" variant="outline">Keluar</Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
