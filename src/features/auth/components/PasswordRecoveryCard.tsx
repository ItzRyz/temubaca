"use client";

import { ArrowLeft, ArrowRight, Eye, EyeClosed, KeyRound, LockKeyhole, Mail, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { FieldError, FormAlert } from "@/components/ui/form";

import { requestPasswordReset, signOut, updatePassword } from "@/features/auth/actions";
import { resetPasswordSchema } from "@/lib/validation/schemas/auth.schema";

import { AuthPanel, authFieldShellClass, authInputClass, authPrimaryButtonClass } from "./auth-layout";
import { PasswordChecklist } from "./password-checklist";

function PanelHeader({ title, description, icon: Icon = KeyRound }: { title: string; description: string; icon?: LucideIcon }) {
    return (
        <header className="flex flex-col items-center text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#e7efe8] text-primary">
                <Icon aria-hidden="true" className="size-4" />
            </span>
            <h2 className="mt-3 font-heading text-xl leading-[30px] font-semibold text-[#1f2924]">{title}</h2>
            <p className="mt-1 text-xs leading-[18px] text-muted-foreground">{description}</p>
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

export function ForgotPasswordCard() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);

    const submit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        setEmailError(null);
        try {
            const result = await requestPasswordReset(email);
            if (result.success) {
                router.replace(result.redirectTo ?? "/verify-email");
                return;
            }
            if (result.fieldErrors?.email?.[0]) setEmailError(result.fieldErrors.email[0]);
            else setError(result.message ?? "Permintaan gagal.");
        } catch {
            setError("Permintaan reset kata sandi gagal. Silakan coba lagi.");
        } finally {
            setPending(false);
        }
    };

    return (
        <AuthPanel>
            <PanelHeader title="Lupa Kata Sandi?" description="Kirim kode verifikasi ke email kamu." icon={LockKeyhole} />
            <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="recovery-email" className="text-sm font-medium text-foreground">Email Terdaftar</label>
                    <div className={`${authFieldShellClass} ${emailError ? "border-destructive" : "border-input"}`}>
                        <Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <input
                            id="recovery-email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="nama@email.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            aria-invalid={Boolean(emailError)}
                            aria-describedby={emailError ? "recovery-email-error" : undefined}
                            className={authInputClass}
                        />
                    </div>
                    <FieldError id="recovery-email-error" message={emailError} />
                </div>
                <FormAlert>{error}</FormAlert>
                <button type="submit" disabled={pending} className={authPrimaryButtonClass}>
                    {pending ? "Mengirim..." : "Kirim Kode Verifikasi"}
                    {!pending && <ArrowRight aria-hidden="true" className="size-4" />}
                </button>
            </form>
            <BackToLogin />
        </AuthPanel>
    );
}

function PasswordField({ id, label, placeholder, value, onChange, error }: {
    id: string;
    label: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    error: string | null;
}) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
            <div className={`${authFieldShellClass} ${error ? "border-destructive" : "border-input"}`}>
                <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <input
                    id={id}
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={authInputClass}
                />
                <button
                    type="button"
                    aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    aria-pressed={visible}
                    onClick={() => setVisible((current) => !current)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                    {visible ? <EyeClosed aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                </button>
            </div>
            <FieldError id={`${id}-error`} message={error} />
        </div>
    );
}

export function UpdatePasswordCard() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    const submit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setPasswordError(null);
        setConfirmError(null);

        const parsed = resetPasswordSchema.safeParse({ password });
        if (!parsed.success) {
            setPasswordError(parsed.error.issues[0]?.message ?? "Kata sandi tidak valid.");
            return;
        }
        if (password !== confirmPassword) {
            setConfirmError("Konfirmasi kata sandi tidak cocok.");
            return;
        }

        setPending(true);
        try {
            const result = await updatePassword(password);
            if (result.success) {
                router.replace("/");
                router.refresh();
                return;
            }
            if (result.fieldErrors?.password?.[0]) setPasswordError(result.fieldErrors.password[0]);
            else setError(result.message ?? "Pembaruan gagal.");
        } catch {
            setError("Kata sandi belum dapat diperbarui. Minta kode reset yang baru.");
        } finally {
            setPending(false);
        }
    };

    return (
        <AuthPanel>
            <PanelHeader title="Buat Kata Sandi Baru" description="Buat kata sandi baru yang belum pernah kamu gunakan sebelumnya." />
            <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
                <PasswordField id="new-password" label="Kata Sandi Baru" placeholder="Minimal 8 karakter" value={password} onChange={setPassword} error={passwordError} />
                <PasswordField id="confirm-new-password" label="Konfirmasi Kata Sandi Baru" placeholder="Ulangi kata sandi baru" value={confirmPassword} onChange={setConfirmPassword} error={confirmError} />
                <PasswordChecklist
                    password={password}
                    extra={[{ label: "Konfirmasi kata sandi cocok", met: confirmPassword.length > 0 && password === confirmPassword }]}
                />
                <FormAlert>{error}</FormAlert>
                <button type="submit" disabled={pending} className={authPrimaryButtonClass}>
                    {pending ? "Menyimpan..." : "Simpan & Masuk"}
                    {!pending && <ArrowRight aria-hidden="true" className="size-4" />}
                </button>
            </form>
            {/* The recovery code already signed the user in; cancelling must end that session. */}
            <form action={signOut} className="mt-4 border-t border-[#ebe9e1] pt-4 text-center">
                <button type="submit" className="text-[13px] text-muted-foreground hover:text-foreground">Batal, kembali ke halaman masuk</button>
            </form>
        </AuthPanel>
    );
}
