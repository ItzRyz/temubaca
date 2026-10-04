"use client";

import Link from "next/link";
import { useState, type SubmitEvent } from "react";
import { requestPasswordReset, updatePassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const fieldClass =
    "h-12 rounded-xl border border-temubaca-shadcn-ui-tokens-app-input bg-temubaca-shadcn-ui-tokens-app-card px-4 text-base";

export function ForgotPasswordCard() {
    const [email, setEmail] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const submit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
            const result = await requestPasswordReset(email);
            if (result.success) setSent(true);
            else setError(result.fieldErrors?.email?.[0] ?? result.message ?? "Permintaan gagal.");
        } catch {
            setError("Permintaan reset kata sandi gagal. Silakan coba lagi.");
        } finally {
            setPending(false);
        }
    };

    return (
        <Card className="w-full max-w-lg p-8 sm:p-10">
            <CardContent className="flex flex-col gap-5 p-0">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold text-foreground">Lupa kata sandi?</h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                        Masukkan email akunmu. Jika terdaftar, kami akan mengirim tautan untuk membuat kata sandi baru.
                    </p>
                </header>

                {sent ? (
                    <p role="status" className="rounded-lg bg-primary/10 p-4 text-sm leading-6 text-foreground">
                        Jika alamat tersebut terdaftar, email reset kata sandi akan segera dikirim. Periksa juga folder spam.
                    </p>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="recovery-email" className="text-sm font-medium text-foreground">Email</label>
                            <Input
                                id="recovery-email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className={fieldClass}
                            />
                        </div>
                        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                        <Button type="submit" disabled={pending} className="w-full">
                            {pending ? "Mengirim..." : "Kirim tautan reset"}
                        </Button>
                    </form>
                )}

                <Button asChild variant="ghost" className="self-start px-0">
                    <Link href="/auth">Kembali ke halaman masuk</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

export function UpdatePasswordCard() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updated, setUpdated] = useState(false);

    const submit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError("Kata sandi minimal 8 karakter.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Kata sandi dan konfirmasi tidak sama.");
            return;
        }

        setPending(true);
        try {
            const result = await updatePassword(password);
            if (result.success) setUpdated(true);
            else setError(result.fieldErrors?.password?.[0] ?? result.message ?? "Pembaruan gagal.");
        } catch {
            setError("Kata sandi belum dapat diperbarui. Minta tautan reset yang baru.");
        } finally {
            setPending(false);
        }
    };

    return (
        <Card className="w-full max-w-lg p-8 sm:p-10">
            <CardContent className="flex flex-col gap-5 p-0">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold text-foreground">
                        {updated ? "Kata sandi diperbarui" : "Buat kata sandi baru"}
                    </h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                        {updated
                            ? "Kamu sekarang dapat masuk dengan kata sandi yang baru."
                            : "Gunakan kata sandi minimal 8 karakter."}
                    </p>
                </header>

                {updated ? (
                    <Button asChild>
                        <Link href="/auth">Masuk</Link>
                    </Button>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="new-password" className="text-sm font-medium text-foreground">Kata sandi baru</label>
                            <Input
                                id="new-password"
                                type="password"
                                autoComplete="new-password"
                                minLength={8}
                                required
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className={fieldClass}
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="confirm-new-password" className="text-sm font-medium text-foreground">Konfirmasi kata sandi</label>
                            <Input
                                id="confirm-new-password"
                                type="password"
                                autoComplete="new-password"
                                minLength={8}
                                required
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                className={fieldClass}
                            />
                        </div>
                        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                        <Button type="submit" disabled={pending} className="w-full">
                            {pending ? "Menyimpan..." : "Simpan kata sandi baru"}
                        </Button>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
