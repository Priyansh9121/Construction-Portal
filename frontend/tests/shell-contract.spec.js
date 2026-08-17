/*
 * The SPA shell's contract with the assets in public/.
 *
 * WHY THIS EXISTS
 * ---------------
 * `public/favicon.svg` was authored, documented as "browser tab icon", copied
 * into dist/ on every build — and referenced nowhere. index.html's own comment
 * said "the favicon is referenced from public/", which was simply not true, so
 * every browser fell back to requesting /favicon.ico and took a 404 on every
 * page load. It surfaced during a world-load investigation looking like a world
 * asset failing, which is the expensive part: a 404 in the console costs
 * whoever sees it the time to prove it is not their bug.
 *
 * This is a CLASS, not one asset. Anything in public/ is copied verbatim and
 * referenced only by a hand-written path, so nothing links the two and no
 * build step complains. The probe asserts both halves: that the shell declares
 * the reference, and that the reference actually resolves.
 */
import { test, expect } from "@playwright/test";

test.describe("SPA shell", () => {
  test("declares a favicon, so no browser falls back to /favicon.ico", async ({ page }) => {
    await page.goto("/login");
    const icon = page.locator('link[rel="icon"]');
    await expect(icon).toHaveCount(1);
    await expect(icon).toHaveAttribute("href", "/favicon.svg");
  });

  test("and the file it declares is actually served", async ({ page, baseURL }) => {
    /* The half a DOM assertion cannot cover: a link tag pointing at a path
     * that 404s is the same defect wearing a different hat. */
    const res = await page.request.get(new URL("/favicon.svg", baseURL).href);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("svg");
  });
});
