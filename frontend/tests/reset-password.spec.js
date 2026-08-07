/**
 * ===========================================================================
 * RESET PASSWORD — completion contract
 * ===========================================================================
 *
 * Most of these assert client-side behaviour and need no network at all. Only
 * the end-to-end reset spends a real request, and it must obtain a genuine
 * token first, so this file spends TWO requests against the recovery
 * endpoint: one forgot-password to mint a token, one reset-password to use
 * it.
 *
 * That endpoint is guarded by passwordResetLimiter, 5 per hour by default.
 * Run the backend with PASSWORD_RESET_RATE_LIMIT_MAX raised for local
 * verification; see DEPLOYMENT.md.
 *
 * THIS SUITE OWNS ITS OWN ACCOUNT. It registers a throwaway workspace, resets
 * that account's password, and deletes it afterwards. It never touches a
 * shared fixture.
 *
 * That is not fastidiousness, it is the fix for two real failures (AUTH-018):
 *
 *   1. The backend stores ONE reset_token per user, so two suites minting a
 *      token for the same account race. Whichever runs second overwrites the
 *      other's token, and the first then fails with an invalid token. This
 *      test passed alone and failed in a full parallel run.
 *
 *   2. A successful reset CHANGES that account's password. When the restore
 *      in afterAll then failed, it left a shared fixture unusable and took
 *      128 assertions down with it across every portal suite.
 *
 * A throwaway account cannot collide and cannot be left broken.
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";

import {
  BASE_URL,
  API_URL,
  assertLocalTarget,
} from "./support/fixtures.js";

assertLocalTarget();

const DUMMY_TOKEN = "layout-only-token-not-valid";
const NEW_PASSWORD = "a-freshly-reset-passphrase";

/** Throwaway accounts this suite created, removed in afterAll. */
const createdEmails = [];

/** Open Reset with a token in the URL. */
async function openWithToken(page, token = DUMMY_TOKEN) {
  await page.goto(`${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`, {
    waitUntil: "networkidle",
  });
}

test.describe("reset password", () => {
  test("a URL token populates the field and it stays editable", async ({ page }) => {
    await openWithToken(page);

    const field = page.locator("#reset-token");
    await expect(field).toHaveValue(DUMMY_TOKEN);
    await expect(field).toBeEnabled();
    await expect(field).toBeVisible();

    // A typed value takes precedence over the URL token.
    await field.fill("hand-pasted-token");
    await expect(field).toHaveValue("hand-pasted-token");

    // Clearing it does not silently restore the URL token.
    await field.fill("");
    await expect(field).toHaveValue("");
  });

  test("each password field has its own independent visibility control", async ({ page }) => {
    await openWithToken(page);

    const newInput = page.locator("#new-password");
    const confirmInput = page.locator("#confirm-password");
    const toggles = page.locator(".password-toggle-btn");

    await expect(toggles).toHaveCount(2);

    await newInput.fill("first-secret-value");
    await confirmInput.fill("second-secret-value");

    const newToggle = toggles.nth(0);
    const confirmToggle = toggles.nth(1);

    await expect(newToggle).toHaveAttribute("aria-pressed", "false");
    await expect(confirmToggle).toHaveAttribute("aria-pressed", "false");

    // Revealing one must not reveal the other.
    await newToggle.click();
    await expect(newInput).toHaveAttribute("type", "text");
    await expect(confirmInput).toHaveAttribute("type", "password");
    await expect(newToggle).toHaveAttribute("aria-pressed", "true");
    await expect(confirmToggle).toHaveAttribute("aria-pressed", "false");

    // Values survive the toggle.
    await expect(newInput).toHaveValue("first-secret-value");
    await expect(confirmInput).toHaveValue("second-secret-value");

    // Keyboard activation works, and focus stays on the control.
    await confirmToggle.press("Enter");
    await expect(confirmInput).toHaveAttribute("type", "text");
    await expect(confirmToggle).toBeFocused();

    // Both toggles meet the target floor.
    for (const t of [newToggle, confirmToggle]) {
      const box = await t.boundingBox();
      expect(box.height, "toggle height").toBeGreaterThanOrEqual(44);
    }
  });

  test("validation rules are unchanged and reach no network", async ({ page }) => {
    await openWithToken(page);

    let sent = false;
    page.on("request", (r) => {
      if (r.url().includes("/auth/reset-password")) sent = true;
    });

    // Under eight characters.
    await page.fill("#new-password", "short");
    await page.fill("#confirm-password", "short");
    await page.evaluate(() => {
      for (const id of ["new-password", "confirm-password"]) {
        document.getElementById(id).removeAttribute("minLength");
      }
    });
    await page.click(".auth-submit");
    await expect(page.locator('.error[role="alert"]')).toContainText(/at least 8 characters/i);

    // Mismatch.
    await page.fill("#new-password", "a-long-enough-passphrase");
    await page.fill("#confirm-password", "a-different-passphrase");
    await page.click(".auth-submit");
    await expect(page.locator('.error[role="alert"]')).toContainText(/do not match/i);

    expect(sent, "validation must not reach the network").toBe(false);
  });

  test("a real reset completes, clears the fields and returns to login", async ({ page }) => {
    const api = await playwrightRequest.newContext({ baseURL: API_URL });

    // A throwaway workspace this suite owns outright.
    const email = `reset-probe-${Date.now()}-${Math.floor(Math.random() * 1e6)}@local.test`;
    const created = await api.post("/api/auth/register", {
      data: {
        full_name: "Reset Probe",
        email,
        password: "an-initial-throwaway-passphrase",
        company_name: "Reset Probe Workspace",
      },
    });
    expect(created.ok(), "throwaway account must be created").toBe(true);
    createdEmails.push(email);

    // Mint a genuine token for it. DEV exposes it on the response.
    const forgot = await api.post("/api/auth/forgot-password", {
      data: { email },
    });
    expect(forgot.ok(), "forgot-password must succeed to mint a token").toBe(true);

    const { resetToken } = await forgot.json();
    expect(resetToken, "DEV must expose a reset token for this test").toBeTruthy();
    await api.dispose();

    await openWithToken(page, resetToken);

    await page.fill("#new-password", NEW_PASSWORD);
    await page.fill("#confirm-password", NEW_PASSWORD);

    // Request 2: the reset itself. Payload must be unchanged.
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/auth/reset-password") && r.method() === "POST"),
      page.click(".auth-submit"),
    ]);

    const body = JSON.parse(request.postData() || "{}");
    expect(Object.keys(body).sort()).toEqual(["new_password", "token"]);
    expect(body.token).toBe(resetToken);

    // Completion state, announced politely.
    await expect(page.getByTestId("reset-confirmation")).toBeVisible();
    await expect(page.locator('.auth-success[role="status"]')).toBeVisible();

    // Fields are gone, so nothing retains the typed password.
    await expect(page.locator("#new-password")).toHaveCount(0);
    await expect(page.locator("#confirm-password")).toHaveCount(0);

    // The existing 1500ms redirect still fires, and still to /login.
    await page.waitForURL(/\/login/, { timeout: 6000 });
    await expect(page.locator("h1")).toHaveText("Sign in");
  });
});

/**
 * Delete the throwaway workspaces this suite created.
 *
 * A signup creates a company plus its trigger-seeded materials and labour
 * catalogs, so every table carrying company_id is cleared before the company
 * itself. Discovered from information_schema rather than hard-coded, matching
 * register-contract.spec.js.
 */
test.afterAll(async () => {
  if (!createdEmails.length) return;

  const { createRequire } = await import("node:module");
  const requireFromBackend = createRequire(
    new URL("../../backend/package.json", import.meta.url)
  );
  const { Client } = requireFromBackend("pg");

  const fs = await import("node:fs");
  const url = fs
    .readFileSync(new URL("../../backend/.env", import.meta.url), "utf8")
    .match(/^DATABASE_URL=(.*)$/m)?.[1]
    .trim();

  if (!url || !/localhost|127\.0\.0\.1/.test(url)) return;

  const client = new Client({ connectionString: url });
  await client.connect();

  const { rows: companyIdTables } = await client.query(
    `SELECT c.table_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE c.column_name = 'company_id'
        AND c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name <> 'companies'`
  );

  for (const email of createdEmails) {
    const { rows } = await client.query("SELECT id FROM users WHERE email = $1", [email]);

    for (const { id } of rows) {
      const { rows: companies } = await client.query(
        "SELECT id FROM companies WHERE owner_user_id = $1",
        [id]
      );
      const companyIds = companies.map((c) => c.id);

      if (companyIds.length) {
        for (const { table_name } of companyIdTables) {
          await client.query(
            `DELETE FROM public."${table_name}" WHERE company_id = ANY($1)`,
            [companyIds]
          );
        }
        await client.query("DELETE FROM companies WHERE id = ANY($1)", [companyIds]);
      }

      await client.query("DELETE FROM company_users WHERE user_id = $1", [id]);
      await client.query("DELETE FROM users WHERE id = $1", [id]);
    }
  }

  await client.end();
});
