"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="id">
            <body style={{ margin: 0, background: "#f8faf9", color: "#15211d", fontFamily: "system-ui, sans-serif" }}>
                <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
                    <section style={{ maxWidth: "560px", textAlign: "center", padding: "40px", border: "1px solid #dce5e1", borderRadius: "24px", background: "white" }}>
                        <p style={{ color: "#28745d", fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>TemuBaca</p>
                        <h1 style={{ fontSize: "30px", lineHeight: 1.2 }}>TemuBaca sedang mengalami kendala</h1>
                        <p style={{ color: "#64736d", lineHeight: 1.6 }}>Coba muat ulang halaman. Jika masalah berlanjut, kembali lagi nanti.</p>
                        <button type="button" onClick={() => reset()} style={{ marginTop: "12px", padding: "12px 20px", border: 0, borderRadius: "12px", background: "#28745d", color: "white", fontWeight: 600, cursor: "pointer" }}>
                            Coba lagi
                        </button>
                    </section>
                </main>
            </body>
        </html>
    );
}
