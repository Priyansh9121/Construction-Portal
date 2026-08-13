/*
 * The camera station contract.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every camera response the form asks for — field focus, sign-in pending,
 * sign-in failure — was a silent no-op in production for the whole of the M2
 * era. The form named stations from the OLD procedural journey ("scaffold",
 * "hoarding", "lift"); the authored journey has never contained any of them;
 * and `goTo` returned quietly when a name did not resolve. Nothing threw,
 * nothing logged, and the feature was simply gone.
 *
 * A rendering test cannot catch that, because the failure IS the absence of
 * movement. This can: it is pure data, it runs in milliseconds, and it fails
 * the moment an intent points at a station that does not exist.
 *
 * Run: node --test src/world/stationContract.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { SITE_INTENTS, SITE_JOURNEY, SITE_LAYERS, WORLD_STATE } from "./loginSite.js";

const stationNames = SITE_JOURNEY.map((s) => s.name);

test("every intent resolves to a station that actually exists", () => {
  for (const [intent, station] of Object.entries(SITE_INTENTS)) {
    assert.ok(
      stationNames.includes(station),
      `intent "${intent}" -> "${station}", which is not one of: ${stationNames.join(", ")}`,
    );
  }
});

test("the intents the form actually dispatches are all present", () => {
  /* These are the names authWorld's focus/arm/relax pass. If one is renamed
   * without updating the table, the response dies silently again. */
  for (const required of [
    "establishing", "emailFocus", "passwordFocus", "authPending", "authFailure",
  ]) {
    assert.ok(SITE_INTENTS[required], `missing intent "${required}"`);
  }
});

test("email and password focus recompose to DIFFERENT places", () => {
  /* Repeating one animation for every field teaches the user that nothing
   * specific happened, which is the same as having no response at all. */
  assert.notEqual(SITE_INTENTS.emailFocus, SITE_INTENTS.passwordFocus);
});

test("failure returns somewhere other than where pending went", () => {
  assert.notEqual(SITE_INTENTS.authPending, SITE_INTENTS.authFailure);
});

test("the opening station is the establishing shot, and it is first", () => {
  assert.equal(SITE_INTENTS.establishing, SITE_JOURNEY[0].name);
});

test("station names are unique, so goTo cannot be ambiguous", () => {
  assert.equal(new Set(stationNames).size, stationNames.length);
});

test("architecture and neighbours are essential", () => {
  /* Losing either means losing the building itself. If these ever stop being
   * essential, the readiness contract silently weakens: the fallback would be
   * hidden in front of a world with no architecture in it. */
  const essential = SITE_LAYERS.filter((l) => l.essential).map((l) => l.name);
  assert.ok(essential.includes("login-site-architecture"));
  assert.ok(essential.includes("login-site-neighbours"));
});

test("READY is a distinct state from DEGRADED and FAILED", () => {
  /* The whole readiness fix rests on these not collapsing into one another:
   * only READY may hide the fallback. */
  const { READY, DEGRADED, FAILED, LOADING, INITIALISING } = WORLD_STATE;
  assert.equal(new Set([READY, DEGRADED, FAILED, LOADING, INITIALISING]).size, 5);
});
