/**
 * ===========================================================================
 * REGISTRATION CONTRACT — the regression AUTH-001 needed and did not have
 * ===========================================================================
 *
 * Why this file exists:
 * The registration form sent `role` (which the API ignores) and omitted
 * `company_name` (which the API requires), so public signup returned 400 on
 * every attempt and the role selector was dead UI implying a privilege choice
 * the endpoint has never offered. Nothing caught it, because nothing asserted
 * on the payload the browser actually sends.
 *
 * So these tests inspect the REAL request and, for the success path, drive the
 * REAL local backend. Mocking the endpoint here would mock away the exact
 * contract that broke.
 *
 * SAFETY: signs up against a local stack only, and refuses to run otherwise.
 * Each created workspace is removed in afterAll.
 */

import { test, expect } from "@playwright/test";

import { BASE_URL, assertLocalTarget } from "./support/fixtures.js";

assertLocalTarget();

/** Unique per run, so a failed run never collides with the next. */
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const createdEmails = [];

test.describe("registration contract", () => {
  test("submits company_name and never submits role", async ({ page }) => {
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });

    const email = `contract-${stamp()}@local.test`;

    await page.fill("#register-full-name", "Contract Probe");
    await page.fill("#register-email", email);
    await page.fill("#register-company-name", "Contract Probe Workspace");
    await page.fill("#register-password", "a-long-enough-passphrase");
    await page.fill("#register-confirm-password", "a-long-enough-passphrase");

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/auth/register") && r.method() === "POST"),
      page.click(".auth-submit"),
    ]);

    const body = JSON.parse(request.postData() || "{}");
    createdEmails.push(email);

    // The field whose absence caused every signup to 400.
    expect(body.company_name, "company_name must be submitted").toBe("Contract Probe Workspace");

    // The field the API ignores, and whose presence misrepresented the outcome.
    expect(body).not.toHaveProperty("role");

    // The client may never ask for its own privileges.
    for (const forbidden of ["company_id", "owner_user_id", "company_role", "is_admin", "permissions"]) {
      expect(body, `${forbidden} must never be sent`).not.toHaveProperty(forbidden);
    }

    // Exactly the four fields the endpoint accepts.
    expect(Object.keys(body).sort()).toEqual(
      ["company_name", "email", "full_name", "password"].sort()
    );
  });

  test("successful signup authenticates and lands on the backend's destination", async ({ page }) => {
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });

    const email = `success-${stamp()}@local.test`;

    await page.fill("#register-full-name", "Success Probe");
    await page.fill("#register-email", email);
    await page.fill("#register-company-name", "Success Probe Workspace");
    await page.fill("#register-password", "a-long-enough-passphrase");
    await page.fill("#register-confirm-password", "a-long-enough-passphrase");
    await page.click(".auth-submit");

    // Public signup yields an administrator, so the backend's home is the
    // dashboard. Asserting the ROUTE, not a role the form chose.
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    createdEmails.push(email);

    const session = await page.evaluate(() => ({
      token: Boolean(localStorage.getItem("token")),
      role: JSON.parse(localStorage.getItem("user") || "{}").role,
    }));

    expect(session.token, "a token must be stored").toBe(true);
    expect(String(session.role).toLowerCase(), "public signup creates an administrator").toBe("admin");
  });

  test("missing company name is caught before the request is sent", async ({ page }) => {
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });

    await page.fill("#register-full-name", "No Company");
    await page.fill("#register-email", `nocompany-${stamp()}@local.test`);
    await page.fill("#register-password", "a-long-enough-passphrase");
    await page.fill("#register-confirm-password", "a-long-enough-passphrase");

    // The field is `required`, so the browser blocks submission. Remove that
    // to prove the component's own guard also holds.
    await page.evaluate(() => {
      document.querySelector("#register-company-name").removeAttribute("required");
    });

    let sent = false;
    page.on("request", (r) => {
      if (r.url().includes("/auth/register")) sent = true;
    });

    await page.click(".auth-submit");
    await expect(page.locator(".error")).toContainText(/company name is required/i);
    expect(sent, "no request should be sent when company name is missing").toBe(false);
  });

  test("a duplicate email surfaces the backend error", async ({ page }) => {
    const email = `duplicate-${stamp()}@local.test`;

    for (const attempt of [1, 2]) {
      await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
      await page.fill("#register-full-name", "Duplicate Probe");
      await page.fill("#register-email", email);
      await page.fill("#register-company-name", `Duplicate Workspace ${attempt}`);
      await page.fill("#register-password", "a-long-enough-passphrase");
      await page.fill("#register-confirm-password", "a-long-enough-passphrase");
      await page.click(".auth-submit");

      if (attempt === 1) {
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
        createdEmails.push(email);
        await page.evaluate(() => localStorage.clear());
      }
    }

    await expect(page.locator(".error")).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("no role selector exists", async ({ page }) => {
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });

    await expect(page.locator("#register-role")).toHaveCount(0);
    await expect(page.locator('select[name="role"]')).toHaveCount(0);

    const text = await page.locator(".auth-card").innerText();
    expect(text).not.toMatch(/\bSubcontractor\b/i);
  });
});

/**
 * Remove every workspace these tests created. Each signup makes a users row,
 * a companies row and a company_users row; deleting the user cascades through
 * the membership, and the company is removed by the same id.
 */
test.afterAll(async () => {
  if (!createdEmails.length) return;

  /* `pg` is a backend dependency, not a frontend one, and this suite lives in
   * frontend/. Resolve it explicitly rather than adding a database driver to
   * the app's dependency tree just for cleanup. */
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

  /*
   * A signup creates far more than three rows. Migration 004 seeds a
   * materials catalog and labour categories per company through a trigger,
   * and many tables carry company_id, so deleting the company directly
   * violates a foreign key and aborts the whole teardown. An earlier version
   * of this cleanup did exactly that and left six users and six companies
   * behind in the dev database.
   *
   * So: clear every table that carries company_id, then the company, then the
   * membership, then the user. Discovered from the catalog rather than
   * hard-coded, because the schema will keep growing.
   */
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
