"use client";

import { ArrowRight, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type SubmitEvent } from "react";

import { cancelEmailOtp, resendEmailOtp, verifyEmailOtp } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS, type PendingOtpPurpose } from "@/lib/validation/schemas/auth.schema";

import { AuthPanel, authPrimaryButtonClass } from "./auth-layout";

type OtpVerificationCardProps = {
    email: string;
    purpose: PendingOtpPurpose;
    initialResendIn: number;
};

const changeEmailHref: Record<PendingOtpPurpose, string> = {
    signup: "/register",
    recovery: "/forgot-password",
};

/**
 * One real input (paste, SMS/email autofill, screen readers) drawn as six boxes
 * (Figma: Verifikasi Kode 58:22774).
 */
function OtpInput({ value, onChange, invalid, describedBy }: {
    value: string;
    onChange: (value: string) => void;
    invalid: boolean;
    describedBy?: string;
}) {
    const [focused, setFocused] = useState(false);
    const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

    return (
        <div className="relative mx-auto w-fit">
            <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={OTP_LENGTH}
                autoFocus
                aria-label={`Kode verifikasi ${OTP_LENGTH} digit`}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                value={value}
                onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
            />
            <div aria-hidden="true" className="flex gap-2 sm:gap-3">
                {Array.from({ length: OTP_LENGTH }, (_, index) => {
                    const active = focused && index === activeIndex;
                    return (
                        <span
                            key={index}
                            className={cn(
                                "flex size-11 items-center justify-center rounded-lg border-2 bg-card text-lg font-semibold text-foreground sm:size-12",
                                invalid ? "border-destructive" : active ? "border-primary" : "border-input",
                            )}
                        >
                            {value[index] ?? ""}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

export function OtpVerificationCard({ email, purpose, initialResendIn }: OtpVerificationCardProps) {
    const router = useRouter();
    const [code, setCode] = useState("");
    const [pending, setPending] = useState(false);
    const [resending, setResending] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [resendIn, setResendIn] = useState(initialResendIn);

    useEffect(() => {
        if (resendIn <= 0) return;
        const timeout = setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
        return () => clearTimeout(timeout);
    }, [resendIn]);

    const submit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCodeError(null);
        setMessage(null);
        setNotice(null);

        if (code.length !== OTP_LENGTH) {
            setCodeError(`Masukkan ${OTP_LENGTH} digit kode dari email.`);
            return;
        }

        setPending(true);
        try {
            const result = await verifyEmailOtp(code);
            if (!result.success) {
                setCodeError(result.fieldErrors?.token?.[0] ?? null);
                setMessage(result.message ?? null);
                return;
            }
            router.replace(result.redirectTo ?? "/");
            router.refresh();
        } catch {
            setMessage("Verifikasi belum dapat diproses. Silakan coba lagi.");
        } finally {
            setPending(false);
        }
    };

    const resend = async () => {
        setResending(true);
        setMessage(null);
        setNotice(null);
        try {
            const result = await resendEmailOtp();
            if (result.success) {
                setCode("");
                setCodeError(null);
                setNotice("Kode baru sudah dikirim. Kode sebelumnya tidak berlaku lagi.");
                setResendIn(OTP_RESEND_COOLDOWN_SECONDS);
            } else {
                setMessage(result.message ?? "Kode belum dapat dikirim ulang.");
                if (result.retryAfter) setResendIn(result.retryAfter);
            }
        } catch {
            setMessage("Kode belum dapat dikirim ulang. Silakan coba lagi.");
        } finally {
            setResending(false);
        }
    };

    const leave = async (href: string) => {
        await cancelEmailOtp();
        router.replace(href);
    };

    return (
        <AuthPanel className="items-stretch">
            <header className="flex flex-col items-center text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#e7efe8] text-primary">
                    <Mail aria-hidden="true" className="size-4" />
                </span>
                <h2 className="mt-3 font-heading text-xl leading-[30px] font-semibold text-[#1f2924]">Cek Kotak Masuk Kamu</h2>
                <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
                    Kami telah mengirimkan {OTP_LENGTH} digit kode ke <span className="font-semibold break-all text-primary">{email}</span>.
                    <br />
                    Masukkan kodenya di bawah ini:
                </p>
            </header>
            <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
                <OtpInput
                    value={code}
                    onChange={(value) => {
                        setCode(value);
                        setCodeError(null);
                    }}
                    invalid={Boolean(codeError)}
                    describedBy={codeError ? "otp-code-error" : undefined}
                />
                {codeError && <p id="otp-code-error" role="alert" className="text-center text-[13px] text-destructive">{codeError}</p>}
                <p className="text-center text-xs leading-[18px] text-muted-foreground" aria-live="polite">
                    {resendIn > 0 ? (
                        <>Kirim ulang kode setelah <span className="font-semibold text-primary">{resendIn} detik</span></>
                    ) : (
                        <button
                            type="button"
                            onClick={resend}
                            disabled={resending}
                            className="font-semibold text-primary hover:underline disabled:opacity-60"
                        >
                            {resending ? "Mengirim ulang..." : "Kirim ulang kode"}
                        </button>
                    )}
                </p>
                {notice && <p role="status" className="rounded-lg bg-[#e7efe8] px-3 py-2 text-sm text-secondary-foreground">{notice}</p>}
                {message && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>}
                <button type="submit" disabled={pending} className={authPrimaryButtonClass}>
                    {pending ? "Memverifikasi..." : "Verifikasi"}
                    {!pending && <ArrowRight aria-hidden="true" className="size-4" />}
                </button>
            </form>
            <div className="mt-4 flex items-center justify-between border-t border-[#ebe9e1] pt-4 text-[13px] text-muted-foreground">
                <button type="button" onClick={() => leave(changeEmailHref[purpose])} className="hover:text-foreground">Ubah email</button>
                <button type="button" onClick={() => leave("/login")} className="hover:text-foreground">Batal</button>
            </div>
        </AuthPanel>
    );
}
