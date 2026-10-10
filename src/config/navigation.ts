export const publicNavigation = [
    { href: "/", label: "Beranda" },
    { href: "/books", label: "Jelajahi" },
    { href: "/communities", label: "Komunitas" },
    { href: "/libraries", label: "Peta Literasi" },
] as const;

export const footerNavigation = [
    {
        title: "Tentang kami",
        links: [
            { href: "/about", label: "Kisah TemuBaca" },
            { href: "/libraries", label: "Ruang baca" },
        ],
    },
    {
        title: "Komunitas",
        links: [
            { href: "/communities", label: "Cari kawan baca" },
            { href: "/events", label: "Agenda pertemuan" },
            { href: "/merchandise", label: "Toko komunitas" },
        ],
    },
    {
        title: "Buku",
        links: [
            { href: "/books", label: "Jelajahi katalog" },
            { href: "/recommendations", label: "Rekomendasi" },
            { href: "/my-listings", label: "Bagikan bukumu" },
        ],
    },
] as const;
