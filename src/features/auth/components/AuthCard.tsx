"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeClosed, LockKeyhole, Mail, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { signIn, signUp } from "@/features/auth/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
    SignInInput,
    signInSchema,
    SignUpInput,
    signUpSchema,
} from "@/lib/validation/auth";

import { AuthPanel, authFieldShellClass, authInputClass, authPrimaryButtonClass } from "./auth-layout";

type AuthMode = "masuk" | "daftar";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    id: string;
    label: ReactNode;
    labelAside?: ReactNode;
    icon: LucideIcon;
    error?: string;
    trailing?: ReactNode;
};

function AuthField({ id, label, labelAside, icon: Icon, error, trailing, ...inputProps }: AuthFieldProps) {
    const errorId = `${id}-error`;
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <label htmlFor={id} className="text-sm leading-[21px] font-medium text-foreground">{label}</label>
                {labelAside}
            </div>
            <div className={cn(authFieldShellClass, error ? "border-destructive" : "border-input")}>
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <input
                    id={id}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    className={authInputClass}
                    {...inputProps}
                />
                {trailing}
            </div>
            {error && <p id={errorId} role="alert" className="text-[13px] text-destructive">{error}</p>}
        </div>
    );
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            aria-pressed={visible}
            onClick={onToggle}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
            {visible ? <EyeClosed aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
    );
}

function AuthTabs({ mode }: { mode: AuthMode }) {
    const tabs = [
        { value: "masuk", label: "Masuk", href: "/login" },
        { value: "daftar", label: "Daftar", href: "/register" },
    ] as const;

    return (
        <nav aria-label="Pilih masuk atau daftar" className="my-6 flex rounded-xl border border-[#dbe1d8] bg-[#fcfbf7] p-1">
            {tabs.map((tab) => {
                const active = tab.value === mode;
                return (
                    <Link
                        key={tab.value}
                        href={tab.href}
                        replace
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "flex-1 rounded-lg px-3 py-2 text-center text-sm leading-[21px] font-semibold focus-visible:outline-2 focus-visible:outline-ring",
                            active
                                ? "bg-primary text-primary-foreground shadow-[0_1px_1.5px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.1)]"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}

function SwitchRow({ question, href, label }: { question: string; href: string; label: string }) {
    return (
        <p className="mt-4 flex items-center justify-center gap-1.5 border-t border-[#dbe1d8] pt-4 text-sm text-muted-foreground">
            {question}
            <Link href={href} replace className="font-semibold text-primary hover:underline">{label}</Link>
        </p>
    );
}

function SignInForm() {
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { register, handleSubmit, setError, formState: { errors } } = useForm<SignInInput>({
        resolver: zodResolver(signInSchema),
        defaultValues: { email: "", password: "" },
    });

    const onSubmit = async (data: SignInInput) => {
        setIsPending(true);
        setServerError(null);
        try {
            const result = await signIn(data, rememberMe);
            if (!result.success) {
                if (result.fieldErrors?.email?.[0]) setError("email", { type: "server", message: result.fieldErrors.email[0] });
                if (result.fieldErrors?.password?.[0]) setError("password", { type: "server", message: result.fieldErrors.password[0] });
                if (result.message) setServerError(result.message);
                return;
            }
            router.replace("/");
            router.refresh();
        } catch {
            setServerError("Tidak dapat masuk saat ini. Silakan coba lagi.");
        } finally {
            setIsPending(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col">
            <AuthField
                id="sign-in-email"
                label="Email"
                icon={Mail}
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                error={errors.email?.message}
                {...register("email")}
            />
            <div className="pt-4">
                <AuthField
                    id="sign-in-password"
                    label="Kata Sandi"
                    labelAside={<Link href="/forgot-password" className="text-[13px] font-semibold text-primary hover:underline">Lupa kata sandi?</Link>}
                    icon={LockKeyhole}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    error={errors.password?.message}
                    trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} />}
                    {...register("password")}
                />
            </div>
            <div className="flex items-center gap-2.5 pt-5">
                <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
                <label htmlFor="remember-me" className="cursor-pointer text-sm text-muted-foreground">Ingat saya</label>
            </div>
            {serverError && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
            <button type="submit" disabled={isPending} className={cn(authPrimaryButtonClass, "mt-4")}>
                {isPending ? "Memproses..." : "Masuk"}
            </button>
            <p className="pt-6 text-center text-xs leading-[18px] text-muted-foreground">
                Dengan masuk, kamu menyetujui Ketentuan Layanan dan Kebijakan Privasi TemuBaca.
            </p>
            <SwitchRow question="Belum punya akun?" href="/register" label="Daftar" />
        </form>
    );
}

function SignUpForm() {
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const { register, handleSubmit, setError, formState: { errors } } = useForm<SignUpInput>({
        resolver: zodResolver(signUpSchema),
        defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    });

    const onSubmit = async (data: SignUpInput) => {
        setIsPending(true);
        setServerError(null);
        try {
            const result = await signUp(data);
            if (!result.success) {
                for (const field of ["name", "email", "password", "confirmPassword"] as const) {
                    const message = result.fieldErrors?.[field]?.[0];
                    if (message) setError(field, { type: "server", message });
                }
                if (result.message) setServerError(result.message);
                return;
            }
            router.replace(result.redirectTo ?? "/verify-email");
            router.refresh();
        } catch {
            setServerError("Pendaftaran gagal saat ini. Silakan coba lagi.");
        } finally {
            setIsPending(false);
        }
    };

    const togglePassword = <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} />;

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <AuthField id="sign-up-name" label="Nama Lengkap" icon={User} type="text" autoComplete="name" error={errors.name?.message} {...register("name")} />
            <AuthField id="sign-up-email" label="Email" icon={Mail} type="email" autoComplete="email" placeholder="nama@email.com" error={errors.email?.message} {...register("email")} />
            <AuthField
                id="sign-up-password"
                label="Kata Sandi"
                icon={LockKeyhole}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                error={errors.password?.message}
                trailing={togglePassword}
                {...register("password")}
            />
            <AuthField
                id="sign-up-confirm-password"
                label="Konfirmasi Kata Sandi"
                icon={LockKeyhole}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
            />
            <div className="flex items-start gap-2.5">
                <Checkbox id="sign-up-agreement" className="mt-0.5" checked={agreed} onCheckedChange={(checked) => setAgreed(checked === true)} />
                <label htmlFor="sign-up-agreement" className="cursor-pointer text-xs leading-[18px] text-muted-foreground">
                    Saya berjanji merawat buku pinjaman, mengembalikannya tepat waktu, dan saling menghargai sesama warga TemuBaca.
                </label>
            </div>
            {serverError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
            <button type="submit" disabled={isPending || !agreed} className={authPrimaryButtonClass}>
                {isPending ? "Memproses..." : "Buat Akun Sekarang"}
            </button>
            <SwitchRow question="Sudah punya akun?" href="/login" label="Masuk sekarang" />
        </form>
    );
}

export function AuthCard({ mode }: { mode: AuthMode }) {
    return (
        <AuthPanel>
            <h2 className="pt-1 text-center font-heading text-xl leading-[30px] font-semibold text-[#1f2924]">
                {mode === "masuk" ? "Selamat Datang Kembali" : "Daftar Akun TemuBaca"}
            </h2>
            <AuthTabs mode={mode} />
            {mode === "masuk" ? <SignInForm /> : <SignUpForm />}
        </AuthPanel>
    );
}

export default AuthCard;
