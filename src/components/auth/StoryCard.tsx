import { Bookmark, Handshake, LibraryBig } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const benefits = [
    {
        title: "Simpan koleksi buku & riwayat bacaan",
        description:
            "Kelola rak digital, catat progres baca, dan simpan daftar keinginanmu.",
        icon: Bookmark,
    },
    {
        title: "Pinjam buku fisik langsung dari kawan",
        description:
            "Temui kawan di titik temu terdekat untuk bertukar buku dan cerita.",
        icon: Handshake,
    },
];

const communityStats = [
    {
        label: "📚 12.400+ Buku Fisik Berkeliling",
    },
    {
        label: "📍 48 Titik Temu Warga",
    },
];

export const StoryCard = () => {
    return (
        <Card className="mx-auto flex flex-col w-full max-w-200 items-start p-9 sm:p-16">
            <CardContent className="flex w-full flex-col items-start p-0">
                <div className="flex w-full flex-col items-start gap-6">
                    <Badge className="gap-1.5 border border-primary bg-primary-foreground px-3 py-1">
                        <LibraryBig aria-hidden="true" className="h-3.25 w-2.75 text-primary" strokeWidth={2} />
                        <span className="text-[11px] font-semibold leading-[16.5px] text-primary">AKUN TEMUBACA</span>
                    </Badge>
                    <header className="flex w-full flex-col items-start gap-3">
                        <h1 className="max-w-full text-[38px] font-semibold leading-[45.6px] tracking-[-0.8px] text-card-foreground">
                            Kembali ke Ruang Baca Warga
                        </h1>
                        <p className="max-w-full font-['Inter-Regular',Helvetica] text-base font-normal leading-6.5 text-[#6e7870]">
                            Masuk untuk melanjutkan bacaanmu, mengecek pinjaman buku, dan
                            menyapa kawan baru.
                        </p>
                    </header>
                    <section
                        aria-label="Manfaat akun TemuBaca"
                        className="flex w-full flex-col items-start gap-3.5 pt-2"
                    >
                        {benefits.map(({ title, description, icon: Icon }) => (
                            <article
                                key={title}
                                className="flex w-full items-start gap-4 rounded-2xl border border-[#e3e3db] bg-card p-4"
                            >
                                <div className="flex shrink-0 items-start pt-0.5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary bg-primary-foreground">
                                        <Icon
                                            aria-hidden="true"
                                            className="h-4.25 w-4.5 text-secondary-foreground"
                                            strokeWidth={2.25}
                                        />
                                    </div>
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col items-start">
                                    <h2 className="font-['Inter-SemiBold',Helvetica] text-sm font-semibold leading-5 text-card-foreground">
                                        {title}
                                    </h2>
                                    <p className="pt-0.5 font-['Inter-Regular',Helvetica] text-[13px] font-normal leading-4.75 text-[#6e7870]">
                                        {description}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </section>
                </div>
                <footer className="mt-4 flex w-full flex-col items-start pt-4">
                    <div className="flex w-full flex-col items-start justify-between gap-4 border-t border-[#ebe9e1] pt-6 sm:flex-row sm:items-center">
                        {communityStats.map(({ label }) => (
                            <span
                                key={label}
                                className="font-['Inter-Regular',Helvetica] text-xs font-normal leading-4 text-[#828c84]"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                </footer>
            </CardContent>
        </Card>
    );
};

export default StoryCard;
