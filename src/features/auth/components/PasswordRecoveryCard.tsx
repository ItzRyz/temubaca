"use client";

import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useState, type SubmitEvent } from "react";

import { requestPasswordReset, updatePassword } from "@/features/auth/actions";

import { AuthPanel, authFieldShellClass, authInputClass, authPrimaryButtonClass } from "./auth-layout";

function PanelHeader({ title, description }: { title: string; description: string }) {
    return (
        <header className="flex flex-col items-center text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#e7efe8] text-primary">
                <KeyRound aria-hidden="true" className="size-4" />
            </span>
            <h2 className="mt-3 font-heading text-xl leading-[30px] font-semibold text-[#1f2924]">{title}</h2>
            <p className="mt-1 text-xs leading-[18px] text-[#6e7870]">{description}</p>
        </header>
    );
}

function BackToLogin() {
    return (
        <Link href="/login" className="mt-4 flex items-center justify-center gap-1 border-t border-[#ebe9e1] pt-4 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft aria-hidden="true" className="size-3.5" /> Kembali ke halaman masuk
        </Link>
    );
}

function ErrorMessage({ message }: { message: string | null }) {
    if (!message) return null;
    return <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>;
}

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
        <AuthPanel>
            <PanelHeader title="Lupa Kata Sandi?" description="Kirim tautan atur ulang ke email kamu." />
            {sent ? (
                <p role="status" className="mt-6 rounded-lg bg-[#e7efe8] p-4 text-sm leading-6 text-secondary-foreground">
                    Jika alamat tersebut terdaftar, email berisi tautan atur ulang akan segera dikirim. Periksa juga folder spam.
                </p>
            ) : (
                <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="recovery-email" className="text-sm font-medium text-foreground">Email Terdaftar</label>
                        <div className={`${authFieldShellClass} ${error ? "border-destructive" : "border-input"}`}>
                            <Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                            <input
                                id="recovery-email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="nama@email.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className={authInputClass}
                            />
                        </div>
                    </div>
                    <ErrorMessage message={error} />
                    <button type="submit" disabled={pending} className={authPrimaryButtonClass}>
                        {pending ? "Mengirim..." : "Kirim Tautan Reset"}
                        {!pending && <ArrowRight aria-hidden="true" className="size-4" />}
                    </button>
                </form>
            )}
            <BackToLogin />
        </AuthPanel>
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
        if (password.length > 128) {
            setError("Kata sandi maksimal 128 karakter.");
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

    const fields = [
        { id: "new-password", label: "Kata Sandi Baru", value: password, onChange: setPassword },
        { id: "confirm-new-password", label: "Konfirmasi Kata Sandi", value: confirmPassword, onChange: setConfirmPassword },
    ];

    return (
        <AuthPanel>
            <PanelHeader
                title={updated ? "Kata Sandi Diperbarui" : "Buat Kata Sandi Baru"}
                description={updated ? "Kamu sekarang dapat masuk dengan kata sandi yang baru." : "Gunakan kata sandi minimal 8 karakter."}
            />
            {updated ? (
                <Link href="/login" className={`${authPrimaryButtonClass} mt-6`}>Masuk</Link>
            ) : (
                <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
                    {fields.map((field) => (
                        <div key={field.id} className="flex flex-col gap-1.5">
                            <label htmlFor={field.id} className="text-sm font-medium text-foreground">{field.label}</label>
                            <div className={`${authFieldShellClass} ${error ? "border-destructive" : "border-input"}`}>
                                <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                <input
                                    id={field.id}
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={8}
                                    maxLength={128}
                                    required
                                    value={field.value}
                                    onChange={(event) => field.onChange(event.target.value)}
                                    className={authInputClass}
                                />
                            </div>
                        </div>
                    ))}
                    <ErrorMessage message={error} />
                    <button type="submit" disabled={pending} className={authPrimaryButtonClass}>
                        {pending ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
                    </button>
                </form>
            )}
            {!updated && <BackToLogin />}
        </AuthPanel>
    );
}
