/**
 * The production Login site: Concept C, as authored in Blender.
 *
 * WHY THIS FILE IS DATA AND NOT A GENERATOR
 * -----------------------------------------
 * The site used to be generated — `siteGeometry.json` from a Python script,
 * assembled at runtime from boxes. Three concept rounds established that this
 * is precisely what made it read as BIM, and that no renderer, material or
 * camera change fixes it. The architecture now comes from
 * `tools/blender/concept_c.py`, and this file only says WHERE THINGS ARE and
 * WHERE THE CAMERA STANDS.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COORDINATES: BLENDER Z-UP -> glTF Y-UP
 * ─────────────────────────────────────────────────────────────────────────
 * The exporter maps Blender (x, y, z) to glTF (x, z, -y). Every number below
 * was derived from the concept's own camera definitions through that mapping,
 * not re-eyeballed in the browser — which is what keeps the production frames
 * composed the way the winning renders were.
 *
 * Consequences worth stating once:
 *
 *   the street elevation faces +Z      (Blender -Y)
 *   the rear laneway is at -Z          (Blender +Y)
 *   the plot spans x -11..11, z -17..17
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LAYERS
 * ─────────────────────────────────────────────────────────────────────────
 * Four GLBs rather than one, so the form is usable before the world finishes,
 * so a layer can be dropped on a phone without touching the others, and so a
 * visual regression can be bisected to a layer. They are listed in the order
 * they matter: architecture first, because it is the subject.
 */

/** Load order. `essential` layers are what the scene needs to read at all. */
export const SITE_LAYERS = [
  { name: "login-site-architecture", essential: true, mobile: true },
  { name: "login-site-neighbours", essential: true, mobile: true },
  { name: "login-site-scaffold", essential: false, mobile: true },
  { name: "login-site-street", essential: false, mobile: true },
];

/**
 * Camera stations, converted from the concept's own cameras.
 *
 * `azimuth` is measured about +Z, matching the rig. `radius`, `elevation` and
 * `fov` are derived from the concept's eye/target/lens rather than chosen:
 * a 28 mm lens on a 36 mm frame is a 46.4-degree vertical field, and the
 * elevation is whatever puts the eye at the height a person stands at.
 */
export const SITE_JOURNEY = [
  {
    /* STREET HERO — the winning frame. Standing on the far footpath looking
     * up the street: the west neighbour fills the left of frame, the project
     * is read THROUGH its scaffold, and the building crops above the top. */
    name: "street",
    target: [2, 17, 6],
    radius: 40.5,
    azimuth: -0.595,
    elevation: -0.389,
    fov: 46.4,
    mm: 28,
  },
  {
    /* HUMAN SCALE — the corrected ground frame. Opposite footpath, 26 m back,
     * hoarding and a worker in shot so scale is immediately readable. */
    name: "footpath",
    target: [3, 10, 12],
    radius: 29.1,
    azimuth: -0.367,
    elevation: -0.290,
    fov: 46.4,
    mm: 28,
  },
  {
    /* SITE ENTRY — through the hoarding line toward the ground floor. */
    name: "entry",
    target: [0, 7, 2],
    radius: 21.0,
    azimuth: -0.18,
    elevation: -0.22,
    fov: 53.1,
    mm: 24,
  },
  {
    /* REAR LANE — the side nothing was composed for, which is the one that
     * proves the world survives a 360 orbit. */
    name: "lane",
    target: [-2, 11, -6],
    radius: 42.8,
    azimuth: 2.698,
    elevation: -0.183,
    fov: 53.1,
    mm: 24,
  },
];

/**
 * Known real-world dimensions, asserted against the imported GLB at runtime.
 *
 * A scale error is the one import bug that looks completely correct in a
 * screenshot: a site at 0.8x still photographs as a site. Measuring a known
 * object is the only way to catch it, so the site's own bounding box is
 * checked against what the concept actually authored.
 */
export const SITE_METRICS = {
  /* Plot: 22 m frontage x 34 m deep. */
  plotWidth: 22,
  plotDepth: 34,
  /* Ground floor 4.6 m, then 7 levels at 3.3 m = 27.7 m to the top deck. */
  buildingHeight: 27.7,
  storeyHeight: 3.3,
  /* The architecture layer spans the plot plus its party walls. */
  expectArchitectureWidth: 22.6,
  tolerance: 0.12,
};

/**
 * Assert the imported site is at real scale.
 *
 * A scale error is the one import bug that looks entirely correct in a
 * screenshot — a site at 0.8x still photographs as a site, and every FPS and
 * triangle number stays right. The only way to catch it is to measure a known
 * object, so this measures the architecture layer's own bounding box against
 * the 22 m frontage the concept actually authored.
 *
 * A warning rather than a throw: a mis-scaled world is a visual defect, not a
 * reason to deny anyone a login form.
 */
export function checkSiteScale(THREE, scene) {
  const target = scene.getObjectByName("login-site-architecture");
  if (!target) return null;
  const box = new THREE.Box3().setFromObject(target);
  const size = box.getSize(new THREE.Vector3());
  const want = SITE_METRICS.expectArchitectureWidth;
  const ok = Math.abs(size.x - want) <= want * SITE_METRICS.tolerance;
  const result = {
    width: +size.x.toFixed(2),
    height: +size.y.toFixed(2),
    depth: +size.z.toFixed(2),
    expectedWidth: want,
    ok,
  };
  if (!ok) {
    console.warn(
      `[world] site scale looks wrong: architecture is ${result.width} m wide, `
      + `expected ~${want} m. Check the glTF export scale.`, result);
  }
  return result;
}

/**
 * Which baked material each glTF material maps to, and at what world scale.
 *
 * The GLB's materials arrive as flat factors named after the concept's own
 * slots — which is exactly why M2 preserved those names. This table turns a
 * name into a real surface.
 *
 * `scale` is the size of one texture tile in METRES, and it is the number that
 * decides whether a material reads as concrete or as wallpaper. The swatches
 * are baked at 4 m, so a scale of 4 reproduces the authored density; anything
 * else deliberately stretches or tightens it.
 *
 * Metals and glass are absent on purpose. Galvanised steel and glazing are
 * defined by how they REFLECT, not by an albedo map: they read from the PMREM
 * environment, and painting a diffuse texture onto them would flatten exactly
 * the response that makes them look metallic.
 */
export const SITE_SURFACES = {
  conc: { tex: "conc", scale: 4.0 },
  wet: { tex: "wet", scale: 4.0 },
  earth: { tex: "earth", scale: 3.0 },
  ply: { tex: "ply", scale: 2.2 },
  city_warm: { tex: "city_warm", scale: 4.0 },
  city_cool: { tex: "city_cool", scale: 4.0 },
  /* The road. Asphalt aggregate is fine, so its tile is tighter than the
   * building's — a 4 m asphalt tile reads as gravel. */
  spandrel: { tex: "spandrel", scale: 2.6 },
};

const TEXTURE_BASE = "/world/textures/";

/**
 * Load the baked PBR maps.
 *
 * Never rejects and never blocks: a surface whose maps fail keeps the flat
 * factor it already has, which is duller but completely correct. The form has
 * no relationship with any of this.
 */
export function loadSurfaceMaps(THREE) {
  const loader = new THREE.TextureLoader();
  const cache = new Map();

  const grab = (name, kind, srgb) => {
    const key = `${name}-${kind}`;
    if (cache.has(key)) return cache.get(key);
    const ext = kind === "normal" ? "png" : "jpg";
    const tex = loader.load(
      `${TEXTURE_BASE}${key}.${ext}`,
      undefined,
      undefined,
      () => console.warn(`[world] texture ${key} unavailable; keeping factor`),
    );
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    /* COLOUR SPACE IS NOT COSMETIC. Albedo is sRGB; roughness and normal are
     * DATA. Tagging a roughness map sRGB silently lightens it and no amount
     * of material tuning recovers the surface. */
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    cache.set(key, tex);
    return tex;
  };

  const out = new Map();
  for (const [slot, def] of Object.entries(SITE_SURFACES)) {
    out.set(slot, {
      map: grab(def.tex, "albedo", true),
      roughnessMap: grab(def.tex, "roughness", false),
      normalMap: grab(def.tex, "normal", false),
      scale: def.scale,
    });
  }
  return out;
}
