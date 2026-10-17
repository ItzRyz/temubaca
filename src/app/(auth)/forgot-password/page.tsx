import { AuthLayout } from "@/features/auth/components/auth-layout";
import { ForgotPasswordCard } from "@/features/auth/components/PasswordRecoveryCard";

export default function ForgotPasswordPage() {
    return (
        <AuthLayout
            title="Akses Kembali Rak Bukumu"
            description="Masukkan email terdaftar. Kami akan mengirimkan kode OTP 6 digit untuk mengatur ulang kata sandimu."
        >
            <ForgotPasswordCard />
        </AuthLayout>
    );
}
