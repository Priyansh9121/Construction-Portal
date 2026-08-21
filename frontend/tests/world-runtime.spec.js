/*
 * The world's readiness contract, proven in a real browser.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two defects shipped to production because nothing here was asserted:
 *
 *   1. The authored SVG fallback was faded out the instant a RENDERER existed,
 *      not when the world was on screen. `createAuthWorld`'s only await is the
 *      three.js import; the GLB layers arrive afterwards. So when those layers
 *      failed in production, the fallback was already gone and the user got an
 *      empty sky — with the page reporting itself perfectly healthy.
 *
 *   2. Reduced motion drew its single still BEFORE the authored layers
 *      arrived, and then never redrew. The still was the world minus its
 *      architecture, permanently.
 *
 * Both are invisible to a screenshot diff of the happy path, so these tests
 * drive the failure deliberately by blocking the layer requests.
 *
 * Authentication must be unaffected by every one of these states, which the
 * last test asserts directly. That is the load-bearing guarantee: the form
 * never waits on WebGL.
 */
import { test, expect } from "@playwright/test";

/*
 * A REAL GPU, deliberately.
 *
 * Default headless Chromium reports itself as a software rasteriser, and the
 * world refuses to start on one on purpose — SwiftShader runs this scene at
 * about 6 fps and makes the whole page feel broken. Without these flags the
 * world never initialises and every assertion below would be testing the
 * fallback path while claiming to test the world.
 */
test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu",
           "--ignore-gpu-blocklist"],
  },
});

const LOGIN = "/login";
const ARCHITECTURE = "**/world/assets/login-site-architecture.glb";

/** The canvas only exists once the world module has been imported. */
const canvas = (page) => page.locator("canvas.auth-world");

async function settle(page, state, timeout = 30000) {
  await expect(canvas(page)).toHaveAttribute("data-world-state", state, { timeout });
}

test.describe("world readiness contract", () => {
  test("reaches READY and only then hides the fallback", async ({ page }) => {
    await page.goto(LOGIN);
    await settle(page, "ready");

    /* data-live is what the CSS uses to fade the fallback out. It must never
     * be set in any state but READY. */
    await expect(canvas(page)).toHaveAttribute("data-live", "1");

    const debug = await canvas(page).evaluate((c) => c.__authWorldDebug);
    expect(debug.degraded).toBe(false);
    expect(debug.essentialMissing).toEqual([]);
    for (const status of Object.values(debug.layers)) {
      expect(status).toBe("loaded");
    }
  });

  test("a failed ESSENTIAL layer keeps the fallback and never claims READY", async ({ page }) => {
    /* Aborting one essential layer reproduces the production incident exactly:
     * every other asset succeeds, so nothing looks broken except the thing
     * that matters. */
    await page.route(ARCHITECTURE, (route) => route.abort());
    await page.goto(LOGIN);
    await settle(page, "degraded");

    /* THE ASSERTION THAT WOULD HAVE CAUGHT THE INCIDENT. */
    await expect(canvas(page)).not.toHaveAttribute("data-live", "1");

    const debug = await canvas(page).evaluate((c) => c.__authWorldDebug);
    expect(debug.degraded).toBe(true);
    expect(debug.essentialMissing).toContain("login-site-architecture");
    expect(debug.layers["login-site-architecture"]).toBe("FAILED");
  });

  test("the scale check measures the building, and says so", async ({ page }) => {
    /*
     * `siteScale.test.mjs` proves the check's LOGIC against transcribed
     * dimensions. This proves the same thing against the GLB that actually
     * ships, which is the half a unit test cannot cover: the shipped export
     * has to still contain `conc` geometry in the architecture layer, at the
     * plot's frontage, or the assertion has quietly lost its target.
     *
     * UPDATED for concept D. The plot is 64 m, not 22 — see SITE_METRICS, whose
     * numbers were measured out of the shipped GLB. And `meshes` is no longer
     * 1: the tower's clad and fitting-out floors are INSTANCED, and each
     * instanced node carries its own `conc` primitive, so three is the honest
     * count for one building.
     *
     * The load-bearing property is unchanged and is what this still guards: the
     * check must resolve by (layer, material) and not by name. Thirteen
     * primitives answer to "login-site-architecture", and if this ever reads
     * thirteen the identity has collapsed back to the name.
     */
    await page.goto(LOGIN);
    await settle(page, "ready");
    const scale = await canvas(page).evaluate((c) => c.__siteScale);
    expect(scale.reason).toBeUndefined();
    expect(scale.meshes).toBe(3);
    expect(scale.meshes).toBeLessThan(13);
    expect(scale.width).toBe(64);
    expect(scale.ok).toBe(true);
  });

  test("READY is unreachable while an essential layer is missing", async ({ page }) => {
    await page.route(ARCHITECTURE, (route) => route.abort());
    await page.goto(LOGIN);
    await settle(page, "degraded");
    /* Give the world well past its settling time to wrongly promote itself. */
    await page.waitForTimeout(4000);
    await expect(canvas(page)).toHaveAttribute("data-world-state", "degraded");
  });
});

test.describe("the mobile tier", () => {
  /*
   * A phone used to download the entire world — 2,064 KB of GLB, 1,200 KB of
   * maps, 108,520 triangles — because `portrait ? l.mobile : true` filtered
   * nothing, every layer being flagged `mobile: true`. A unit test can prove
   * the TABLE has a tier in it. Only this can prove the tier reaches the wire,
   * and the wire is the whole point: the saving is bytes a phone does not pull.
   */
  const PORTRAIT = { width: 390, height: 844 };

  test("a portrait device fetches neither the optional layers nor their maps",
    async ({ browser }) => {
      const page = await browser.newPage({ viewport: PORTRAIT });
      const got = [];
      page.on("request", (r) => {
        const u = r.url();
        if (u.includes("/world/assets/") || u.includes("/world/textures/")) got.push(u);
      });
      await page.goto(LOGIN);
      await settle(page, "ready");

      const debug = await canvas(page).evaluate((c) => c.__authWorldDebug);
      /*
       * `login-site-people` is NOT in this list any more. It was moved into
       * the mobile tier deliberately on 2026-08-20 — measured at 60 fps for
       * 5,000 VAT figures at a phone viewport, and the field roles are the ones
       * who open this screen most. A construction site with nobody on it is the
       * least convincing version of this product.
       */
      for (const optional of ["login-site-street", "login-site-scaffold"]) {
        expect(debug.layers[optional]).toBe("skipped (mobile)");
        expect(got.filter((u) => u.includes(optional))).toEqual([]);
      }
      /* Essential layers are NOT part of the tier. Skipping one would pin the
       * phone in DEGRADED and hold the fallback up forever. */
      expect(debug.layers["login-site-architecture"]).toBe("loaded");
      expect(debug.layers["login-site-neighbours"]).toBe("loaded");
      expect(debug.essentialMissing).toEqual([]);

      /*
       * THE HALF THAT WAS NOT OBVIOUS. A map that belongs to a skipped layer
       * and to nothing else must not be fetched — while the maps came from a
       * static table, dropping a layer saved none of them, and the tier looked
       * like it worked while saving 40% less than it claimed.
       *
       * `asphalt` and `spandrel` LEFT this list on 2026-08-21, and correctly:
       * the city's facade bands are `spandrel`, which resolves to the asphalt
       * texture, and the city is essential. They are no longer street-exclusive
       * so a phone rightly pulls them. `ground` still is — measured, a portrait
       * page fetches asphalt, brick, concrete and ply, and no ground map.
       */
      for (const dead of ["ground-"]) {
        expect(got.filter((u) => u.includes(dead))).toEqual([]);
      }
      expect(debug.maps).not.toContain("ground-color");
      expect(debug.maps).toContain("concrete-color");
      await page.close();
    });

  test("a desktop device still gets the whole world", async ({ page }) => {
    /* The tier must cost the constrained device less, not cost everyone the
     * same. If this ever matches the portrait list, the tier has stopped being
     * a tier and become a deletion. */
    await page.goto(LOGIN);
    await settle(page, "ready");
    const debug = await canvas(page).evaluate((c) => c.__authWorldDebug);
    for (const status of Object.values(debug.layers)) expect(status).toBe("loaded");
    expect(debug.maps).toContain("ground-color");
  });
});

test.describe("reduced motion", () => {
  test("the still contains the authored world, not the world minus its layers", async ({ page }) => {
    /* emulateMedia rather than the context-level `reducedMotion` option: the
     * latter did not reach matchMedia in this project's configuration, and a
     * reduced-motion test that quietly runs the ANIMATED path is worse than no
     * test at all -- it reports green on the exact bug it exists to catch. */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(LOGIN);
    await settle(page, "ready");

    const debug = await canvas(page).evaluate((c) => c.__authWorldDebug);
    expect(debug.degraded).toBe(false);

    /*
     * The layers loading is necessary but NOT sufficient — that was equally
     * true while the bug was live. What was missing is a REDRAW afterwards.
     *
     * The canvas cannot be read back (no preserved drawing buffer), so the
     * evidence is what the renderer reports about its most recent draw. The
     * authored site alone is ~50k triangles; a still drawn before the layers
     * arrived is the procedural stub and orders of magnitude smaller.
     */
    const last = await canvas(page).evaluate((c) => c.__lastRender);
    expect(last, "no render recorded after the layers loaded").toBeTruthy();
    expect(last.triangles).toBeGreaterThan(20000);
  });
});

test.describe("authentication is independent of the world", () => {
  for (const [label, block] of [["world healthy", false], ["essential layer failed", true]]) {
    test(`the form is fully usable — ${label}`, async ({ page }) => {
      if (block) await page.route(ARCHITECTURE, (route) => route.abort());
      await page.goto(LOGIN);
      await settle(page, block ? "degraded" : "ready");

      const email = page.getByLabel(/email/i);
      const password = page.getByPlaceholder(/enter your password/i);
      const submit = page.getByRole("button", { name: /^sign in$/i });

      await email.fill("worker@example.com");
      await password.fill("some-password");
      await expect(email).toHaveValue("worker@example.com");
      await expect(submit).toBeEnabled();
      /* Focus dispatches auth:focus into the world. It must not throw, and it
       * must not disturb the field. */
      await password.focus();
      await expect(password).toBeFocused();
    });
  }
});
