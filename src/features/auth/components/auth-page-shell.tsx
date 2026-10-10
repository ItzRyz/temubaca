import AuthCard from "@/features/auth/components/AuthCard";
import { AuthLayout } from "@/features/auth/components/auth-layout";

type AuthPageShellProps = {
    initialMode: "masuk" | "daftar";
};

const storyByMode = {
    masuk: {
        eyebrow: "Akun TemuBaca",
        title: "Kembali ke Ruang Baca Warga",
        description: "Masuk untuk melanjutkan bacaanmu, mengelola buku yang kamu bagikan, dan menyapa kawan baru.",
    },
    daftar: {
        eyebrow: "Ruang Baca Warga",
        title: "Mari Membaca dan Berbagi Bersama",
        description: "Temukan buku favorit, pinjam dari kawan sekitar, dan bagikan koleksi bacaanmu.",
    },
} as const;

export function AuthPageShell({ initialMode }: AuthPageShellProps) {
    return (
        <AuthLayout {...storyByMode[initialMode]} showBenefits>
            <AuthCard mode={initialMode} />
        </AuthLayout>
    );
}
