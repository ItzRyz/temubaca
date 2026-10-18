import { expect, test, type Browser, type Page } from "@playwright/test";

import { hasE2eAccounts, storageStatePath, type E2eRole } from "./support/accounts";
import { bookWithoutListings } from "./support/db";

/**
 * Signed-in flows with the two dedicated E2E accounts (`bun scripts/e2e-accounts.ts`). Global setup
 * signs them in; global setup and teardown delete everything they created. Desktop only, serially,
 * because both accounts share one database.
 */
test.skip(!hasE2eAccounts, "Run `bun scripts/e2e-accounts.ts` first to create the E2E accounts.");
test.describe.configure({ mode: "serial" });
test.use({ storageState: storageStatePath("borrower") });

async function pageAs(browser: Browser, role: E2eRole) {
    const context = await browser.newContext({ storageState: storageStatePath(role) });
    return context.newPage();
}

async function expectNoOverflow(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
}

test("private pages open for a member", async ({ page }) => {
    for (const path of ["/dashboard", "/bookmarks", "/my-listings", "/my-listings?tab=peminjaman", "/recommendations", "/settings"]) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expectNoOverflow(page);
    }
});

test("a member cannot open the admin or moderation portal", async ({ page }) => {
    for (const path of ["/admin", "/admin/users", "/admin/loans", "/moderation/reports"]) {
        // The layout calls notFound() after streaming starts, so the status stays 200; the page is the 404 page.
        await page.goto(path);
        await expect(page.getByRole("heading", { name: "Halaman yang kamu cari tidak ada" }), path).toBeVisible();
    }
    const api = await page.request.get("/api/admin/reports");
    expect(api.status()).toBe(403);
});

test("bookmark a book, see it saved, then remove it", async ({ page }) => {
    await page.goto("/books?q=Amba");
    await page.getByRole("link", { name: /Amba/ }).first().click();
    const save = page.getByRole("button", { name: "Simpan buku" });
    await save.click();
    await expect(page.getByRole("button", { name: "Tersimpan" })).toHaveAttribute("aria-pressed", "true");

    await page.goto("/bookmarks");
    await expect(page.getByText("Amba").first()).toBeVisible();

    await page.goBack();
    await page.getByRole("button", { name: "Tersimpan" }).click();
    await expect(page.getByRole("button", { name: "Simpan buku" })).toHaveAttribute("aria-pressed", "false");
});

test("choose and release a reading interest", async ({ page }) => {
    await page.goto("/bookmarks?tab=interests");
    await page.getByRole("button", { name: "Sejarah. Ketuk untuk memilih", exact: true }).click();
    const chosen = page.getByRole("button", { name: "Sejarah, terpilih. Ketuk untuk melepas", exact: true });
    await expect(chosen).toBeEnabled();
    await expect(page.getByText("Terpilih (1)")).toBeVisible();

    await chosen.click();
    await expect(page.getByText("Terpilih (0)")).toBeVisible();
});

test("borrow request from one member is approved, handed over, and extended once", async ({ browser, page }) => {
    const book = await bookWithoutListings();
    const owner = await pageAs(browser, "owner");
    await owner.goto("/dashboard");
    const created = await owner.request.post("/api/me/book-listings", {
        data: { bookId: book.id, condition: "GOOD", publicLocation: "Taman Suropati [E2E]", borrowingRules: "Lama pinjam: 14 hari." },
    });
    expect(created.status()).toBe(201);

    // Borrower asks for the copy from the book page.
    await page.goto(`/books/${book.id}`);
    await page.getByRole("button", { name: "Ajukan Pinjam" }).first().click();
    await page.getByText("Saya bersedia mengembalikan buku tepat waktu").click();
    await page.getByRole("button", { name: "Kirim Permintaan" }).click();
    await expect(page.getByText("Permintaan terkirim")).toBeVisible();

    await page.goto("/my-listings?tab=peminjaman&view=pinjam");
    await expect(page.getByText(book.title).first()).toBeVisible();
    await expect(page.getByText("Menunggu Jawaban").first()).toBeVisible();

    // Owner sees it as a new request and approves.
    await owner.goto("/my-listings?tab=peminjaman&view=pinjamkan");
    await expect(owner.getByText("Permintaan Baru").first()).toBeVisible();
    await owner.getByRole("button", { name: "Terima Permintaan" }).first().click();
    await expect(owner.getByRole("button", { name: "Konfirmasi Serah Terima" }).first()).toBeVisible();

    // Borrower can now confirm the handover too.
    await page.reload();
    await expect(page.getByRole("button", { name: "Konfirmasi Serah Terima" }).first()).toBeVisible();

    // Both confirm the handover; the loan starts.
    await owner.getByRole("button", { name: "Konfirmasi Serah Terima" }).first().click();
    await expect(owner.getByText("Menunggu peminjam mengonfirmasi serah terima").first()).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Konfirmasi Serah Terima" }).first().click();
    await expect(page.getByText("Sedang Dipinjam").first()).toBeVisible();

    // Borrower asks for one extension (DEC-02); the owner accepts it.
    await page.getByRole("button", { name: "Perpanjang" }).first().click();
    await page.getByText("14 hari", { exact: true }).click();
    await page.getByRole("button", { name: "Kirim Permintaan" }).click();
    await expect(page.getByText("Perpanjangan 14 hari menunggu jawaban pemilik.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Perpanjang" })).toHaveCount(0);

    await owner.reload();
    await expect(owner.getByText("E2E Peminjam meminta perpanjangan 14 hari.")).toBeVisible();
    await owner.getByRole("button", { name: "Terima Perpanjangan" }).click();
    await expect(owner.getByText("Perpanjangan 14 hari diterima. Tenggat sudah diperbarui.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Perpanjangan 14 hari diterima. Tenggat sudah diperbarui.")).toBeVisible();
    await expect(page.getByText(/sisa 28 hari/)).toBeVisible();
    await owner.context().close();
});
