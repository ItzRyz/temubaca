import Link from "next/link";

const principles = [
    {
        title: "Temukan bacaan",
        description: "Jelajahi katalog buku dan informasi dasarnya untuk menemukan bacaan berikutnya.",
    },
    {
        title: "Cari cara mengakses",
        description: "TemuBaca dirancang untuk menghubungkan informasi buku dengan perpustakaan dan berbagi buku. Ketersediaan tetap mengikuti data yang tercatat.",
    },
    {
        title: "Terhubung lewat literasi",
        description: "Komunitas dan kegiatan literasi menjadi bagian dari arah produk; informasi hanya akan ditampilkan setelah fiturnya tersedia dan kebijakan publikasinya ditetapkan.",
    },
];

export default function AboutPage() {
    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-14 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Tentang TemuBaca</p>
            <h1 className="mt-3 max-w-3xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Temukan buku dan teman baca.</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground">TemuBaca adalah platform web untuk membantu pembaca menemukan buku, mencari cara mengakses buku fisik, dan terhubung dengan kegiatan literasi. Kami membangun pengalaman ini bertahap sambil menjaga agar informasi yang ditampilkan sesuai dengan data yang benar-benar tersedia.</p>
            <ul className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-3">
                {principles.map((principle) => (
                    <li key={principle.title} className="rounded-2xl border border-border/70 bg-card p-6">
                        <h2 className="font-heading text-xl font-semibold">{principle.title}</h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{principle.description}</p>
                    </li>
                ))}
            </ul>
            <Link href="/books" className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Jelajahi katalog buku</Link>
        </main>
    );
}
