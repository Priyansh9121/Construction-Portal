/**
 * ===========================================================================
 * BUG-001 — THE FINANCE WIZARD KEEPS FOCUS WHILE YOU TYPE
 * ===========================================================================
 *
 * File purpose:
 * Locks the fix for BUG-001: step 3 of the Add Finance Record wizard lost
 * focus after a single character, so a field could not be filled in.
 *
 * WHAT IT ACTUALLY WAS
 *
 * A remount, not focus theft. `Field` — the label wrapper used 31 times
 * across the wizard — was declared INSIDE the FinanceWizard component body.
 * A component declared in another component's body is a new function
 * identity on every render, so React sees a different component type in that
 * position, unmounts the subtree and mounts a fresh one. The <input> becomes
 * a brand-new DOM node, the caret resets, and the next keystroke lands at
 * position 0.
 *
 * MEASURED, before and after, with a mount probe inside Field:
 *
 *                      mounts per keystroke   focus kept   "1" then "2"
 *     before                            10        false           "21"
 *     after                              0         true           "12"
 *
 * The reversed value is the clearest symptom: it is not a dropped character,
 * it is the caret going back to the start of a newly created input.
 *
 * The fix was to hoist `Field` to module scope. It closes over nothing, so
 * that is behaviour-preserving — see the comment on the declaration.
 *
 * WHAT THIS TEST ASSERTS
 *
 * The user-visible consequence, not the mechanism: type several characters
 * into a step 3 field and get all of them, in order, with focus still there.
 * That way it keeps working if Field is later refactored away entirely, and
 * still fails if anyone moves a component declaration back inside the body.
 *
 * A repo-wide sweep at the time of the fix found no other instance of the
 * pattern. FinanceTrendChart's TrendHead, TenderSitesTab and
 * FinanceRecordsTable look nested to a grep but are module-scope components
 * in files whose whole body is indented.
 *
 * ---------------------------------------------------------------------------
 * SAFETY — READ BEFORE RUNNING
 * ---------------------------------------------------------------------------
 * Read-only. It types into a form and never submits, so it creates nothing.
 * Local stack only — assertLocalTarget() refuses to start otherwise.
 *
 * ---------------------------------------------------------------------------
 * SETUP
 * ---------------------------------------------------------------------------
 *   cd backend  && RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 npm start
 *   cd frontend && npm run dev
 *   cd frontend && LOCAL_ADMIN_FIXTURE_PASSWORD=... \
 *                  npx playwright test tests/finance-wizard-focus.spec.js
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";

import {
  assertLocalTarget,
  assertServerFresh,
  login,
  seedSession,
} from "./support/fixtures.js";

assertLocalTarget();

/*
 * BUG-001 was a frontend defect and Vite serves the working tree, so this
 * check is not guarding the thing under test. It runs anyway because the
 * suite signs in and reads real data: a stale API is a stale fixture, and
 * finding that out here is cheaper than debugging an empty wizard.
 */
test.beforeAll(async () => {
  await assertServerFresh(playwrightRequest);
});

const TYPED = "12345";

test.describe("BUG-001 — finance wizard step 3 keeps focus", () => {
  test("a step 3 field accepts a whole number without losing focus", async ({
    page,
    context,
  }) => {
    const admin = await login(playwrightRequest, "admin");

    await seedSession(context, admin);

    await page.goto("/payments");

    /*
     * Step 1. The wizard renders inline, but its fields do not exist until a
     * finance section is chosen — which is why the bug needed a step 3 field
     * to reproduce at all. "Office" is used because it needs no tender.
     */
    const office = page.getByRole("button", {
      name: "Office",
      exact: true,
    });

    await expect(office).toBeVisible({ timeout: 20000 });
    await office.click();

    /*
     * The first enabled free-text/number field in the wizard. Located by
     * position rather than by name so a relabelled field does not silently
     * stop testing anything.
     */
    const field = page
      .locator(
        "form input[type='text'], form input[type='number'], .panel input[type='text'], .panel input[type='number']"
      )
      .filter({ hasNot: page.locator("[readonly]") })
      .first();

    await expect(field).toBeVisible({ timeout: 10000 });

    await field.click();
    await field.fill("");

    // Typed one key at a time: filling in one go would not reproduce it.
    await field.pressSequentially(TYPED, { delay: 60 });

    /*
     * Order is the assertion that matters. Before the fix this read "54321",
     * because every keystroke landed at position 0 of a freshly mounted
     * input.
     */
    await expect(
      field,
      "characters must arrive in the order they were typed"
    ).toHaveValue(TYPED);

    await expect(
      field,
      "the field must still hold focus after typing"
    ).toBeFocused();
  });
});
