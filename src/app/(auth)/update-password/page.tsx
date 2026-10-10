import { AuthLayout } from "@/features/auth/components/auth-layout";
import { UpdatePasswordCard } from "@/features/auth/components/PasswordRecoveryCard";

export default function UpdatePasswordPage() {
    return (
        <AuthLayout
            title="Atur Ulang Kata Sandi"
            description="Buat kata sandi baru yang kuat agar rak bukumu tetap aman."
        >
            <UpdatePasswordCard />
        </AuthLayout>
    );
}
