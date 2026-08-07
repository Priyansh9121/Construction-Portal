/**
 * ===========================================================================
 * FORGOT PASSWORD — recovery contract
 * ===========================================================================
 *
 * The security property this route exists to protect is that it reveals
 * NOTHING about whether an address is registered. That is easy to break with
 * a well-meaning copy change, so it is asserted rather than trusted.
 *
 * Drives the real local backend: the whole point is that a registered address
 * and an unregistered one are indistinguishable, which a mock cannot prove.
 *
 * REQUEST BUDGET:
 * This endpoint sits behind authLimiter, whose default in this project is 10
 * requests per window and which is shared with every other auth call. So
 * these tests SHARE real requests rather than making one per assertion, and
 * the whole file spends three. A suite that exhausts the limiter fails for a
 * reason that has nothing to do with the code under test.
 *
 * SAFETY: local stack only. Creates no rows.
 */

import { test, expect } from "@playwright/test";

import { BASE_URL, assertLocalTarget, credentials } from "./support/fixtures.js";

assertLocalTarget();

/**
 * Wording that would turn this screen into an account oracle.
 *
 * NOTE: conditional phrasing such as "If an account exists for this email…"
 * is NOT an oracle and is deliberately absent from this list. It is the
 * canonical safe wording and is what the backend itself returns. An earlier
 * version of this list matched it and failed a correct implementation.
 */
const ENUMERATION_PHRASES = [
  /account not found/i,
  /no such account/i,
  /not registered/i,
  /unregistered/i,
  /we found your account/i,
  /this email is registered/i,
  /email does not exist/i,
];

/** Submit once and return the confirmation text, excluding the DEV block. */
async function submitAndRead(page, address) {
  await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: "networkidle" });
  await page.fill("#forgot-password-email", address);
  await page.click(".auth-submit");
  await expect(page.getByTestId("forgot-confirmation")).toBeVisible();

  const message = await page.locator(".auth-success").innerText();
  const body = await page.locator(".auth-confirm__body").innerText();
  return `${message}\n${body}`.trim();
}

test.describe.configure({ mode: "serial" });

test.describe("forgot password recovery", () => {
  // Requests 1 and 2.
  test("a registered and an unregistered address are indistinguishable", async ({ page }) => {
    const knownText = await submitAndRead(page, credentials("admin").email);
    const unknownText = await submitAndRead(
      page,
      `definitely-not-registered-${Date.now()}@local.test`
    );

    expect(unknownText).toBe(knownText);

    for (const phrase of ENUMERATION_PHRASES) {
      expect(knownText, `enumeration wording matched ${phrase}`).not.toMatch(phrase);
      expect(unknownText, `enumeration wording matched ${phrase}`).not.toMatch(phrase);
    }
  });

  // Request 3. One submission, several contracts.
  test("success replaces the form, announces politely, and returns to sign in", async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: "networkidle" });
    await expect(page.locator(".auth-card form")).toBeVisible();

    await page.fill("#forgot-password-email", "Payload.Probe@Local.Test");

    let requests = 0;
    page.on("request", (r) => {
      if (r.url().includes("/auth/forgot-password")) requests += 1;
    });

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/auth/forgot-password") && r.method() === "POST"),
      page.click(".auth-submit"),
    ]);

    // Payload unchanged, address normalised.
    const body = JSON.parse(request.postData() || "{}");
    expect(Object.keys(body)).toEqual(["email"]);
    expect(body.email).toBe("payload.probe@local.test");

    await expect(page.getByTestId("forgot-confirmation")).toBeVisible();

    // The form is gone, so it cannot be resubmitted.
    await expect(page.locator(".auth-card form")).toHaveCount(0);
    await expect(page.locator("#forgot-password-email")).toHaveCount(0);
    await expect(page.locator(".auth-submit")).toHaveCount(0);

    // Success is announced politely, never as an interruption.
    await expect(page.locator('.auth-success[role="status"]')).toBeVisible();
    await expect(page.locator('.auth-card [role="alert"]')).toHaveCount(0);

    // The submitting guard allowed exactly one request.
    expect(requests, "exactly one request per submission").toBe(1);

    // The DEV block, when present, can never be mistaken for a normal step.
    const devBox = page.getByTestId("dev-reset-token");
    if (await devBox.count()) {
      await expect(devBox).toContainText(/development only/i);
    }

    // Return to sign in.
    await page.click("text=Back to sign in");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("h1")).toHaveText("Sign in");
  });

  // No request: validation is caught client-side.
  test("an empty address never reaches the network", async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: "networkidle" });

    await page.evaluate(() => {
      document.querySelector("#forgot-password-email").removeAttribute("required");
    });

    let sent = false;
    page.on("request", (r) => {
      if (r.url().includes("/auth/forgot-password")) sent = true;
    });

    await page.click(".auth-submit");
    await expect(page.locator('.error[role="alert"]')).toBeVisible();
    expect(sent, "no request for an empty address").toBe(false);
  });
});
