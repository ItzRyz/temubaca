import { expect, test, type Page } from "@playwright/test";

/** No horizontal page scroll at the current viewport. */
async function expectNoOverflow(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("guest smoke", () => {
    test("home and catalog load without overflow", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("link", { name: "Jelajahi" }).first()).toBeVisible();
        await expectNoOverflow(page);

        await page.goto("/books");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoOverflow(page);
    });

    test("catalog search finds a stored book and opens its detail", async ({ page }) => {
        await page.goto("/books?q=Amba");
        const book = page.getByRole("link", { name: /Amba/ }).first();
        await expect(book).toBeVisible();
        await book.click();
        await expect(page.getByRole("heading", { name: "Amba" }).first()).toBeVisible();
        await expectNoOverflow(page);
    });

    test("a guest is asked to sign in before borrowing", async ({ page }) => {
        await page.goto("/books?q=Bumi");
        await page.getByRole("link", { name: /Bumi Manusia/ }).first().click();
        const signIn = page.getByRole("link", { name: "Masuk untuk meminjam" });
        if (await signIn.count()) {
            await expect(signIn.first()).toHaveAttribute("href", /\/login\?next=%2Fbooks%2F/);
        } else {
            // No shared copy on offer right now; the page must still say so honestly.
            await expect(page.getByText(/salinan warga/i).first()).toBeVisible();
        }
        await expect(page.getByRole("button", { name: "Ajukan Pinjam" })).toHaveCount(0);
    });

    test("private pages send guests to login and back", async ({ page }) => {
        for (const path of ["/my-listings?tab=peminjaman", "/profile", "/communities/new", "/admin/loans"]) {
            await page.goto(path);
            await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/[?]/g, "\\?")}`));
        }
    });

    test("community hub offers the application route", async ({ page }) => {
        await page.goto("/communities");
        await expect(page.getByRole("link", { name: "Ajukan Komunitas" })).toHaveAttribute("href", "/communities/new");
        await expectNoOverflow(page);
    });

    test("an unknown invite link explains itself", async ({ page }) => {
        await page.goto("/communities/invite/abcdefghijklmnopqrstuvwxyzABCDEF012345");
        await expect(page.getByRole("heading", { name: "Undangan tidak dapat dipakai" })).toBeVisible();
    });

    test("unknown pages show the 404 page", async ({ page }) => {
        const response = await page.goto("/halaman-yang-tidak-ada");
        expect(response?.status()).toBe(404);
        await expect(page.getByText("Halaman yang kamu cari tidak ada")).toBeVisible();
    });
});
