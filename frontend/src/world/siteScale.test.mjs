/*
 * The site-scale contract.
 *
 * WHY THIS EXISTS
 * ---------------
 * `checkSiteScale` spent the whole of M2 asserting nothing. It resolved its
 * target with `scene.getObjectByName("login-site-architecture")` while the
 * loader gave EVERY primitive of a layer that same name, so it measured
 * whichever of thirteen objects traversal reached first — a 43 m piece of site
 * — and reported `ok: true`. It only began failing when the export's merge
 * grouping changed which arbitrary object came first. Nothing threw, nothing
 * logged, and a scale check that cannot see the building is worse than no
 * check, because it looks like coverage.
 *
 * A rendering test cannot catch that: a site at 2x still photographs as a site,
 * and the failure IS the absence of an assertion. This can. It builds scenes
 * with known dimensions — including the exact decoy that fooled the old check
 * — and asserts what comes back.
 *
 * Real three, not a stub: the defect lived in Box3/traversal behaviour, so
 * stubbing those out would stub out the bug.
 *
 * Run: node --test src/world/siteScale.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { checkSiteScale, SITE_FRAME, SITE_METRICS } from "./loginSite.js";

/** One primitive as the loader builds it: layer on userData, slot on material. */
function prim(layer, materialName, [w, h, d]) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ name: materialName }),
  );
  mesh.name = layer;                 /* deliberately ambiguous, as in the loader */
  mesh.userData.worldLayer = layer;
  return mesh;
}

/**
 * The shipped architecture layer, measured out of login-site-architecture.glb.
 * Widths in source order; the 43.12 galv piece is what the old check measured.
 */
function shippedArchitecture(scale = 1) {
  const s = (dims) => dims.map((v) => v * scale);
  const scene = new THREE.Scene();
  for (const [mat, dims] of [
    ["galv", [43.12, 30.45, 38.72]],
    ["lamp", [7.88, 4.41, 24.41]],
    ["crane", [7.94, 0.30, 4.84]],
    ["paint", [45.16, 13.94, 0.16]],
    ["conc", [22.00, 31.10, 34.18]],   /* <- the building */
    ["wet", [9.00, 0.30, 29.50]],
    ["block", [17.36, 6.27, 0.24]],
    ["ply", [21.40, 28.41, 33.20]],
    ["workwear", [9.98, 24.05, 26.52]],
  ]) {
    scene.add(prim(SITE_FRAME.layer, mat, s(dims)));
  }
  return scene;
}

test("the shipped architecture layer passes, and passes by measuring 22 m", () => {
  const r = checkSiteScale(THREE, shippedArchitecture());
  assert.equal(r.ok, true);
  assert.equal(r.width, SITE_METRICS.plotWidth);
  assert.equal(r.meshes, 1);
});

test("a mis-scaled scene FAILS — this is the whole point of the check", () => {
  /* 2x is the case the check was invented for: every FPS, triangle count and
   * screenshot stays plausible, and only a measurement can tell. */
  const r = checkSiteScale(THREE, shippedArchitecture(2));
  assert.equal(r.ok, false);
  assert.equal(r.width, 44);
});

test("half scale fails too, so the check is not one-sided", () => {
  assert.equal(checkSiteScale(THREE, shippedArchitecture(0.5)).ok, false);
});

test("the decoy that fooled the old check does not fool this one", () => {
  /* The 43.12 m galv piece is first in traversal order and answers to
   * `getObjectByName("login-site-architecture")`. If a future change goes back
   * to resolving by name, this is the assertion that catches it. */
  const scene = shippedArchitecture();
  assert.equal(scene.getObjectByName(SITE_FRAME.layer).geometry.parameters.width,
    43.12, "precondition: the first same-named object is NOT the building");
  assert.equal(checkSiteScale(THREE, scene).width, SITE_METRICS.plotWidth);
});

test("an absent target fails loudly instead of quietly returning nothing", () => {
  /* The original returned `null` when it found nothing, which is
   * indistinguishable from "not checked yet" and is how it survived. */
  const scene = new THREE.Scene();
  scene.add(prim(SITE_FRAME.layer, "galv", [43.12, 30.45, 38.72]));
  const r = checkSiteScale(THREE, scene);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "target-absent");
});

test("the empty scene is a failure, not a pass", () => {
  const r = checkSiteScale(THREE, new THREE.Scene());
  assert.equal(r.ok, false);
  assert.equal(r.reason, "target-absent");
});

test("concrete in another layer is not the building", () => {
  /* The street layer has its own `conc` — the ramp. Measuring it would be the
   * same class of mistake, one layer over. */
  const scene = shippedArchitecture();
  scene.add(prim("login-site-street", "conc", [64, 0.3, 90]));
  assert.equal(checkSiteScale(THREE, scene).width, SITE_METRICS.plotWidth);
});

test("a `.001` material suffix still resolves to the slot", () => {
  /* three dedupes material names per instance; dressSurface strips the suffix
   * and so must this, or the check silently loses its target. */
  const scene = new THREE.Scene();
  scene.add(prim(SITE_FRAME.layer, "conc.001", [22.00, 31.10, 34.18]));
  assert.equal(checkSiteScale(THREE, scene).ok, true);
});

test("a primitive named for the layer but lacking the userData tag is ignored", () => {
  /* `name` is ambiguous by construction. Only the tag counts. */
  const orphan = new THREE.Mesh(
    new THREE.BoxGeometry(44, 31, 34),
    new THREE.MeshStandardMaterial({ name: "conc" }),
  );
  orphan.name = SITE_FRAME.layer;
  const scene = shippedArchitecture();
  scene.add(orphan);
  assert.equal(checkSiteScale(THREE, scene).width, SITE_METRICS.plotWidth);
});
