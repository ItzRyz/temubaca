import { AuthLayout } from "@/features/auth/components/auth-layout";
import { ForgotPasswordCard } from "@/features/auth/components/PasswordRecoveryCard";

export default function ForgotPasswordPage() {
    return (
        <AuthLayout
            title="Akses Kembali Rak Bukumu"
            description="Masukkan email terdaftar. Kami akan mengirimkan tautan untuk mengatur ulang kata sandimu."
        >
            <ForgotPasswordCard />
        </AuthLayout>
    );
}
