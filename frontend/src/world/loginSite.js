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
  /* People carry their own materials and are small; they arrive last because
   * the site has to read before it can be populated. */
  { name: "login-site-people", essential: false, mobile: true },
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
    /*
     * STREET ESTABLISHING — the frame the page opens on.
     *
     * It used to stand 40 m out at 28 mm, which filled the frame with
     * scaffold and cropped away the street, the sky and the neighbours. An
     * opening shot has to show the WORLD before it shows the subject.
     *
     * Now 70 m back at 35 mm, the architectural-photography default. The
     * camera physically MOVED rather than the lens widening: a wide angle
     * from close up is the game-camera look, and it distorts the verticals
     * that make architecture read.
     *
     * The eye sits at 1.7 m -- a person on the far footpath, not a drone. The
     * target is lifted to 13 m so the frame carries sky above the parapet
     * instead of cropping the building at the top edge, which is what 62 m did:
     * a hero cropped by the frame reads as an object too big for its picture,
     * and the whole point of an establishing shot is that the site reads as a
     * PLACE rather than as one large thing.
     */
    name: "street",
    target: [1, 13, 3],
    radius: 70,
    azimuth: -0.50,
    elevation: -0.1621,
    fov: 37.85,
    mm: 35,
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
 * WHAT THE FORM ASKS THE WORLD FOR — and the ONLY place it is spelled out.
 *
 * The form used to name camera stations directly: `rig.goTo("scaffold")`,
 * `goTo("hoarding")`, `goTo("lift")`. Those are stations from the OLD
 * procedural journey. The authored journey has never contained any of them, so
 * every field focus, every pending state and every failure recompose has been
 * a silent no-op in production since the M2 migration — `goTo` returns quietly
 * when a name does not resolve, so nothing ever complained.
 *
 * The form now names an INTENT and this table owns the mapping. A renamed
 * station is one edit here instead of a hunt through components, and the
 * indirection is the point: presentation code should say what it MEANS, not
 * where the camera happens to stand this month.
 */
export const SITE_INTENTS = {
  /* The opening frame: the whole place, before any field is touched. */
  establishing: "street",
  /* Email is the approach — the shot settles and closes slightly. */
  emailFocus: "footpath",
  /* Password moves in to the site threshold: closer, tighter, more committed. */
  passwordFocus: "entry",
  /* Credentials are with the server. The world leans in and holds. */
  authPending: "entry",
  /* Rejected: settle back out to the approach rather than snap. */
  authFailure: "footpath",
  /* Reserved for the sign-in handover. Deliberately mapped to the opening
   * station for now so the name resolves and the contract test passes; the
   * cinematic travel replaces this, it does not add a new name. */
  transitionEntry: "street",
};

/** World lifecycle. `READY` is the only state that may hide the fallback. */
export const WORLD_STATE = {
  INITIALISING: "initialising",
  LOADING: "loading",
  READY: "ready",
  DEGRADED: "degraded",
  FAILED: "failed",
};

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
  tolerance: 0.12,
};

/** The layer, and the material within it, that together name the building. */
export const SITE_FRAME = {
  layer: "login-site-architecture",
  material: "conc",
};

/**
 * Assert the imported site is at real scale.
 *
 * A scale error is the one import bug that looks entirely correct in a
 * screenshot — a site at 0.8x still photographs as a site, and every FPS and
 * triangle number stays right. The only way to catch it is to measure a known
 * object.
 *
 * WHICH KNOWN OBJECT, AND WHY IT IS NOT A NAME
 * --------------------------------------------
 * This used to do `scene.getObjectByName("login-site-architecture")`, which
 * returns the FIRST match — and the loader gives every primitive of a layer the
 * layer's name, so thirteen objects answer to it. The check measured whichever
 * one traversal reached first: a 43 m piece of site, not the building. It
 * reported `ok: true` for builds by coincidence, and only started failing when
 * the export's merge grouping changed which arbitrary object came first. It was
 * never asserting what it claims.
 *
 * The glTF cannot supply a better name either. Its meaningful names
 * ("architecture-conc") are PART BUCKETS on the node, not objects: that bucket's
 * own box is 45.16 m wide because it also carries a painted screen. Measured
 * from the shipped GLB, the building is exactly one primitive — the one in the
 * architecture layer whose material is `conc` — at 22.00 x 31.10 x 34.18, which
 * is `plotWidth` by `plotDepth`.
 *
 * So the identity is (layer, material). The layer comes from userData because
 * `name` is ambiguous by construction; the material name is the same slot
 * `dressSurface` keys on, and is the reason the export preserves it.
 *
 * A warning rather than a throw: a mis-scaled world is a visual defect, not a
 * reason to deny anyone a login form. But an ABSENT target is an error, because
 * a check that silently finds nothing is exactly how this one survived.
 */
export function checkSiteScale(THREE, scene) {
  const want = SITE_METRICS.plotWidth;
  let box = null;
  let meshes = 0;
  scene.traverse((o) => {
    if (!o.isMesh || o.userData?.worldLayer !== SITE_FRAME.layer) return;
    /* Same `.001` suffix strip as dressSurface: three dedupes material names
     * per instance, and the slot is the part before the dot. */
    const slot = String(o.material?.name || "").split(".")[0];
    if (slot !== SITE_FRAME.material) return;
    meshes += 1;
    box = (box || new THREE.Box3()).expandByObject(o);
  });
  if (!box) {
    console.error(
      `[world] checkSiteScale found no "${SITE_FRAME.material}" geometry in `
      + `${SITE_FRAME.layer}, so the scale assertion did not run. Either the `
      + "layer failed to load or the export stopped emitting that material.");
    return { ok: false, reason: "target-absent", expectedWidth: want, meshes: 0 };
  }
  const size = box.getSize(new THREE.Vector3());
  const ok = Math.abs(size.x - want) <= want * SITE_METRICS.tolerance;
  const result = {
    width: +size.x.toFixed(2),
    height: +size.y.toFixed(2),
    depth: +size.z.toFixed(2),
    expectedWidth: want,
    meshes,
    ok,
  };
  if (!ok) {
    console.warn(
      `[world] site scale looks wrong: the building frame is ${result.width} m `
      + `wide, expected ~${want} m. Check the glTF export scale.`, result);
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
/*
 * glTF material name -> CC0 map set.
 *
 * There is no `scale` any more, and that is the point: the world tile is baked
 * into the UVs at export (tools/blender/concept_lib.py EXPORT_UV_TILE), so the
 * runtime does not get to disagree with the authoring about how big a brick
 * is. Metals and glass are absent deliberately -- they are defined by how they
 * reflect the PMREM environment, and an albedo map would flatten that.
 */
export const SITE_SURFACES = {
  conc: { tex: "concrete" },
  wet: { tex: "concrete" },
  earth: { tex: "ground" },
  ply: { tex: "ply" },
  city_warm: { tex: "brick" },
  city_cool: { tex: "concrete" },
  spandrel: { tex: "asphalt" },

  /*
   * The five street surfaces, added 2026-08-17.
   *
   * They were missing from here and from EXPORT_UV_TILE in concept_lib.py,
   * and the two tables have to agree: the export flattens a material only if
   * it is named there, and the runtime reattaches a map only if it is named
   * here. A material in neither keeps its images embedded in the GLB.
   *
   * That was the entire street size problem. Measured on a fresh export:
   * 11.49 MB, of which 10.57 MB was nine embedded copies of maps that were
   * ALREADY SHIPPING in /world/textures/cc0/. Adding these five names costs
   * zero new bytes -- every one maps to a set already on disk below.
   */
  asphalt: { tex: "asphalt" },
  kerb: { tex: "concrete" },
  footpath: { tex: "concrete" },
  median_top: { tex: "ground" },
  haul: { tex: "ground" },
};

/*
 * PHOTOGRAPHIC CC0 MAPS, SHIPPED ONCE.
 *
 * These used to be baked procedural swatches projected triplanar at runtime,
 * because the Blender materials used BOX projection on world position and
 * glTF cannot express that. The export now cube-projects UVs at each
 * material's real world tile, so the GLB carries proper UVs and these are
 * ordinary glTF PBR textures.
 *
 * They are attached at runtime rather than embedded in the GLBs: embedding put
 * a full copy of every map into every layer that used it and took the set from
 * 0.5 MB to about 30 MB. One copy, cached across all layers.
 */
const TEXTURE_BASE = "/world/textures/cc0/";

/**
 * Load the baked PBR maps.
 *
 * Never rejects and never blocks: a surface whose maps fail keeps the flat
 * factor it already has, which is duller but completely correct. The form has
 * no relationship with any of this.
 */
export function loadSurfaceMaps(THREE, maxAnisotropy = 4) {
  const loader = new THREE.TextureLoader();
  const cache = new Map();

  const grab = (name, kind, srgb) => {
    const key = `${name}-${kind}`;
    if (cache.has(key)) return cache.get(key);
    const ext = "jpg";
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
    /* ANISOTROPY IS NOT A NICETY HERE.
     *
     * The carriageway runs 530 m to the horizon and is read at a few degrees
     * off grazing, so an isotropic sample averages hundreds of texels into one
     * and the road turns into flat grey paint. That is exactly what it did at
     * 4. This is the one case where the maximum the hardware offers is the
     * correct value, not a luxury -- and it costs nothing on surfaces the
     * camera faces square-on, because the sample count adapts per fragment. */
    tex.anisotropy = maxAnisotropy;
    cache.set(key, tex);
    return tex;
  };

  const out = new Map();
  for (const [slot, def] of Object.entries(SITE_SURFACES)) {
    out.set(slot, {
      map: grab(def.tex, "color", true),
      roughnessMap: grab(def.tex, "roughness", false),
      normalMap: grab(def.tex, "normal", false),
    });
  }
  return out;
}
