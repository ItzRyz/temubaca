"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeClosed, LockKeyhole, Mail, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    SignInInput,
    signInSchema,
    SignUpInput,
    signUpSchema,
} from "@/lib/validation/auth";

const invalidCredentialsMessage =
    "Email atau kata sandi salah. Periksa lagi atau atur ulang kata sandi.";

const inputShellClass =
    "flex h-12 items-center gap-4 rounded-xl border bg-temubaca-shadcn-ui-tokens-app-card px-4";
const inputClass =
    "h-auto border-0 bg-transparent p-0 text-base leading-8 text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0";

export const AuthCard = () => {
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const {
        register: registerSignIn,
        handleSubmit: handleSignIn,
        setError: setSignInError,
        clearErrors: clearSignInErrors,
        formState: { errors: errorsSignIn },
    } = useForm<SignInInput>({
        resolver: zodResolver(signInSchema),
        defaultValues: { email: "", password: "" },
    });

    const {
        register: registerSignUp,
        handleSubmit: handleSignUp,
        setError: setSignUpError,
        clearErrors: clearSignUpErrors,
        formState: { errors: errorsSignUp },
    } = useForm<SignUpInput>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    const onSignInSubmit = async (data: SignInInput) => {
        setIsPending(true);
        setServerError(null);

        try {
            const result = await signIn(data, rememberMe);
            if (!result.success) {
                if (result.fieldErrors?.email?.[0]) {
                    setSignInError("email", {
                        type: "server",
                        message: result.fieldErrors.email[0],
                    });
                }
                if (result.fieldErrors?.password?.[0]) {
                    setSignInError("password", {
                        type: "server",
                        message: result.fieldErrors.password[0],
                    });
                }

                if (result.message?.toLowerCase().includes("invalid login credentials")) {
                    setSignInError("password", {
                        type: "server",
                        message: invalidCredentialsMessage,
                    });
                } else if (result.message) {
                    setServerError(result.message);
                }
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

    const onSignUpSubmit = async (data: SignUpInput) => {
        setIsPending(true);
        setServerError(null);

        try {
            const result = await signUp(data);
            if (!result.success) {
                if (result.fieldErrors?.name?.[0]) {
                    setSignUpError("name", {
                        type: "server",
                        message: result.fieldErrors.name[0],
                    });
                }
                if (result.fieldErrors?.email?.[0]) {
                    setSignUpError("email", {
                        type: "server",
                        message: result.fieldErrors.email[0],
                    });
                }
                if (result.fieldErrors?.password?.[0]) {
                    setSignUpError("password", {
                        type: "server",
                        message: result.fieldErrors.password[0],
                    });
                }
                if (result.fieldErrors?.confirmPassword?.[0]) {
                    setSignUpError("confirmPassword", {
                        type: "server",
                        message: result.fieldErrors.confirmPassword[0],
                    });
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

    const handleTabChange = () => {
        setServerError(null);
        clearSignInErrors();
        clearSignUpErrors();
    };

    return (
        <Card className="mx-auto flex w-full max-w-200 flex-col items-start p-9">
            <CardContent className="flex w-full flex-col items-start p-0">
                <div className="w-full max-w-200">
                    <header className="text-center">
                        <h1 className="text-2xl font-semibold leading-11.5 text-foreground">
                            Selamat Datang Kembali
                        </h1>
                    </header>

                    <Tabs defaultValue="masuk" className="mt-12 w-full" onValueChange={handleTabChange}>
                        <TabsList className="w-full">
                            <TabsTrigger
                                value="masuk"
                                className="data-active:bg-primary data-active:text-primary-foreground/80 data-active:hover:text-primary-foreground"
                            >
                                Masuk
                            </TabsTrigger>
                            <TabsTrigger
                                value="daftar"
                                className="data-active:bg-primary data-active:text-primary-foreground/80 data-active:hover:text-primary-foreground"
                            >
                                Daftar
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="masuk" className="mt-6">
                            <form onSubmit={handleSignIn(onSignInSubmit)} noValidate className="space-y-5">
                                <div className="space-y-2">
                                    <label htmlFor="sign-in-email" className="text-md font-medium text-foreground">
                                        Email
                                    </label>
                                    <div className={`${inputShellClass} ${errorsSignIn.email ? "border-destructive" : "border-temubaca-shadcn-ui-tokens-app-input"}`}>
                                        <Mail className="h-4 w-4 shrink-0 text-[#68736c]" aria-hidden="true" />
                                        <Input
                                            id="sign-in-email"
                                            type="email"
                                            autoComplete="email"
                                            aria-invalid={!!errorsSignIn.email}
                                            aria-describedby={errorsSignIn.email ? "sign-in-email-error" : undefined}
                                            {...registerSignIn("email")}
                                            className={inputClass}
                                        />
                                    </div>
                                    {errorsSignIn.email?.message && (
                                        <p id="sign-in-email-error" role="alert" className="text-sm text-destructive">
                                            {errorsSignIn.email.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex w-full items-center justify-between">
                                        <label htmlFor="sign-in-password" className="text-md text-foreground">
                                            Kata Sandi
                                        </label>
                                        <Link
                                            className="text-md text-primary/90 hover:text-primary hover:underline"
                                            href="/forgot-password"
                                        >
                                            Lupa kata sandi?
                                        </Link>
                                    </div>
                                    <div className={`${inputShellClass} ${errorsSignIn.password ? "border-destructive" : "border-temubaca-shadcn-ui-tokens-app-input"}`}>
                                        <LockKeyhole className="h-4 w-4 shrink-0 text-[#68736c]" aria-hidden="true" />
                                        <Input
                                            id="sign-in-password"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="current-password"
                                            aria-invalid={!!errorsSignIn.password}
                                            aria-describedby={errorsSignIn.password ? "sign-in-password-error" : undefined}
                                            {...registerSignIn("password")}
                                            className={inputClass}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                                            aria-pressed={showPassword}
                                            onClick={() => setShowPassword((visible) => !visible)}
                                        >
                                            {showPassword ? (
                                                <EyeClosed className="h-4 w-4 text-[#68736c]" aria-hidden="true" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-[#68736c]" aria-hidden="true" />
                                            )}
                                        </Button>
                                    </div>
                                    {errorsSignIn.password?.message && (
                                        <p id="sign-in-password-error" role="alert" className="text-sm text-destructive">
                                            {errorsSignIn.password.message}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="remember-me"
                                        checked={rememberMe}
                                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                                    />
                                    <label htmlFor="remember-me" className="cursor-pointer text-sm text-foreground">
                                        Ingat saya
                                    </label>
                                </div>

                                {serverError && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {serverError}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    disabled={isPending}
                                    className="w-full bg-primary px-6 py-4 text-md leading-8 text-primary-foreground shadow-[0px_1px_2px_-1px_#0000001a,0px_1px_3px_#0000001a] hover:bg-primary/80"
                                >
                                    {isPending ? "Memproses..." : "Masuk"}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="daftar" className="mt-6">
                            <form onSubmit={handleSignUp(onSignUpSubmit)} noValidate className="space-y-5">
                                <div className="space-y-2">
                                    <label htmlFor="sign-up-name" className="text-md font-medium text-foreground">
                                        Nama Lengkap
                                    </label>
                                    <div className={`${inputShellClass} ${errorsSignUp.name ? "border-destructive" : "border-temubaca-shadcn-ui-tokens-app-input"}`}>
                                        <User className="h-4 w-4 shrink-0 text-[#68736c]" aria-hidden="true" />
                                        <Input
                                            id="sign-up-name"
                                            type="text"
                                            autoComplete="name"
                                            aria-invalid={!!errorsSignUp.name}
                                            aria-describedby={errorsSignUp.name ? "sign-up-name-error" : undefined}
                                            {...registerSignUp("name")}
                                            className={inputClass}
                                        />
                                    </div>
                                    {errorsSignUp.name?.message && (
                                        <p id="sign-up-name-error" role="alert" className="text-sm text-destructive">
                                            {errorsSignUp.name.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="sign-up-email" className="text-md font-medium text-foreground">
                                        Email
                                    </label>
                                    <div className={`${inputShellClass} ${errorsSignUp.email ? "border-destructive" : "border-temubaca-shadcn-ui-tokens-app-input"}`}>
                                        <Mail className="h-4 w-4 shrink-0 text-[#68736c]" aria-hidden="true" />
                                        <Input
                                            id="sign-up-email"
                                            type="email"
                                            autoComplete="email"
                                            aria-invalid={!!errorsSignUp.email}
                                            aria-describedby={errorsSignUp.email ? "sign-up-email-error" : undefined}
                                            {...registerSignUp("email")}
                                            className={inputClass}
                                        />
                                    </div>
                                    {errorsSignUp.email?.message && (
                                        <p id="sign-up-email-error" role="alert" className="text-sm text-destructive">
                                            {errorsSignUp.email.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="sign-up-password" className="text-md text-foreground">
                                        Kata Sandi
                                    </label>
                                    <div className={`${inputShellClass} ${errorsSignUp.password ? "border-destructive" : "border-temubaca-shadcn-ui-tokens-app-input"}`}>
                                        <LockKeyhole className="h-4 w-4 shrink-0 text-[#68736c]" aria-hidden="true" />
                                        <Input
                                            id="sign-up-password"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            aria-invalid={!!errorsSignUp.password}
                                            aria-describedby={errorsSignUp.password ? "sign-up-password-error" : undefined}
                                            {...registerSignUp("password")}
                                            className={inputClass}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                                            aria-pressed={showPassword}
                                            onClick={() => setShowPassword((visible) => !visible)}
                                        >
                                            {showPassword ? (
                                                <EyeClosed className="h-4 w-4 text-[#68736c]" aria-hidden="true" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-[#68736c]" aria-hidden="true" />
                                            )}
                                        </Button>
                                    </div>
                                    {errorsSignUp.password?.message && (
                                        <p id="sign-up-password-error" role="alert" className="text-sm text-destructive">
                                            {errorsSignUp.password.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="sign-up-confirm-password" className="text-md text-foreground">
                                        Konfirmasi Kata Sandi
                                    </label>
                                    <div className={`${inputShellClass} ${errorsSignUp.confirmPassword ? "border-destructive" : "border-temubaca-shadcn-ui-tokens-app-input"}`}>
                                        <LockKeyhole className="h-4 w-4 shrink-0 text-[#68736c]" aria-hidden="true" />
                                        <Input
                                            id="sign-up-confirm-password"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            aria-invalid={!!errorsSignUp.confirmPassword}
                                            aria-describedby={errorsSignUp.confirmPassword ? "sign-up-confirm-password-error" : undefined}
                                            {...registerSignUp("confirmPassword")}
                                            className={inputClass}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                                            aria-pressed={showPassword}
                                            onClick={() => setShowPassword((visible) => !visible)}
                                        >
                                            {showPassword ? (
                                                <EyeClosed className="h-4 w-4 text-[#68736c]" aria-hidden="true" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-[#68736c]" aria-hidden="true" />
                                            )}
                                        </Button>
                                    </div>
                                    {errorsSignUp.confirmPassword?.message && (
                                        <p id="sign-up-confirm-password-error" role="alert" className="text-sm text-destructive">
                                            {errorsSignUp.confirmPassword.message}
                                        </p>
                                    )}
                                </div>

                                {serverError && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {serverError}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    disabled={isPending}
                                    className="w-full bg-primary px-6 py-4 text-md leading-8 text-primary-foreground shadow-[0px_1px_2px_-1px_#0000001a,0px_1px_3px_#0000001a] hover:bg-primary/80"
                                >
                                    {isPending ? "Memproses..." : "Daftar"}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <p className="mt-11 text-center text-md leading-tight text-foreground/30">
                        Dengan masuk, kamu menyetujui Ketentuan Layanan dan Kebijakan Privasi TemuBaca.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};

export default AuthCard;
