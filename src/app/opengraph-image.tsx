import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "TemuBaca — Temukan buku dan teman baca di sekitarmu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The site's default share image (SEO, 29 Okt 2026): brand green, app icon, name and tagline. */
export default async function OpenGraphImage() {
    const icon = await readFile(join(process.cwd(), "public/appicon.png"));
    const src = `data:image/png;base64,${icon.toString("base64")}`;
    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 56, padding: "0 96px", background: "linear-gradient(135deg, #1b4d37 0%, #2c6b4d 60%, #3d7a5c 100%)", color: "#faf7f0" }}>
                <img src={src} width={220} height={220} alt="" style={{ borderRadius: 48, background: "#faf7f0" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
                    <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>temubaca.</div>
                    <div style={{ fontSize: 40, lineHeight: 1.3, color: "#e7efe8" }}>Temukan buku dan teman baca di sekitarmu.</div>
                    <div style={{ fontSize: 26, color: "#c9ecd6" }}>Pinjam buku warga · Komunitas baca · Peta Literasi</div>
                </div>
            </div>
        ),
        size,
    );
}
