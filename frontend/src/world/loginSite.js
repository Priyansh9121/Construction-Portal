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
/*
 * `mobile: false` means a PORTRAIT device does not fetch that layer at all.
 *
 * Every layer used to be `mobile: true`, so `portrait ? l.mobile : true`
 * filtered nothing and a phone downloaded the entire world — 2,064 KB of GLB,
 * 1,200 KB of maps, 108,520 triangles. Field roles reach this product on
 * phones, which makes that the case that matters rather than the case to get
 * to later.
 *
 * The three optional layers go. Measured, with all three aborted: the world
 * still reaches READY and still reads — there is a procedural ground plane
 * under the site, so nothing floats. It costs the road, footpath, kerbs and
 * markings, the external scaffold, and the figures.
 *
 *   street     323 KB  14,856 tris  + ground and asphalt maps, 527 KB
 *   people     289 KB  21,840 tris  (worst triangles-per-byte in the set)
 *   scaffold   188 KB   8,300 tris
 *
 * Street carries by far the most because it is the ONLY user of two whole
 * texture sets — but that half of the saving is only real because
 * `loadSurfaceMaps` now fetches on demand. Dropping a layer while the maps
 * loaded from a static table saved none of its textures.
 *
 * Total: 3,264 KB -> 1,925 KB and 108,520 -> 63,524 triangles, both -41%.
 */
export const SITE_LAYERS = [
  { name: "login-site-architecture", essential: true, mobile: true },
  { name: "login-site-neighbours", essential: true, mobile: true },
  { name: "login-site-scaffold", essential: false, mobile: false },
  { name: "login-site-street", essential: false, mobile: false },
  /* People carry their own materials and are small; they arrive last because
   * the site has to read before it can be populated. Also the densest layer
   * per byte, and static until the Phase F crowd work. */
  /*
   * PEOPLE ON PHONES, as of 2026-08-20.
   *
   * This was `mobile: false` — a decision inherited rather than made. Measured
   * at 60 fps for 5,000 VAT figures at a phone viewport, and the field roles
   * are the ones who open this screen most; a construction site with nobody on
   * it is the least convincing version of this product. The phone crowd is 150
   * against desktop's 400, because a 390x844 viewport on a development machine
   * is not a phone GPU and that caveat is worth respecting until someone
   * measures a real device.
   */
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
  /*
   * RE-DERIVED for the 106.4 m hero on the 64 x 52 m plot (concept D).
   *
   * These are not the old numbers scaled. A 27.7 m building and a 106.4 m one
   * are different photographs: the old street station stood 70 m back at 35 mm,
   * which frames a seven-storey infill and crops a tower at the fourth floor.
   * Each station below is an eye position and a look-at chosen for the new
   * building, with radius, azimuth and elevation DERIVED from that pair rather
   * than typed — the rig's own spherical convention, so what is written here is
   * what the camera does.
   *
   * Eye heights stay human: 1.7-3.0 m. The temptation with a tall building is
   * to fly, and a drone shot is exactly what stops it reading as a place.
   */
  {
    /*
     * STREET ESTABLISHING — the frame the page opens on.
     *
     * 159 m back at 32 mm, from the far side of the street. The target sits at
     * 52 m, roughly half the height of the structure, so the frame carries the
     * crown AND the ground: an establishing shot of a tower that crops the top
     * reads as an object too big for its picture.
     */
    name: "street",
    target: [-2, 52, 14],
    radius: 158.9,
    azimuth: -0.673,
    elevation: -0.3200,
    fov: 41.11,
    mm: 32,
  },
  {
    /* HUMAN SCALE — the opposite footpath at 62 m, 24 mm. Podium, hoarding and
     * the transfer level in shot, with the tower running out of the top of the
     * frame, which is what a person on that pavement actually sees. */
    name: "footpath",
    target: [0, 24, 10],
    radius: 62.4,
    azimuth: -0.540,
    elevation: -0.3653,
    fov: 53.13,
    mm: 24,
  },
  {
    /*
     * SITE ENTRY — the human-scale frame, REFRAMED 2026-08-20.
     *
     * It stood 47 m out at 20 mm looking steeply up, which against a 27.7 m
     * building framed the whole of it and against a 106.4 m one framed
     * nothing but curtain wall: no ground, no hoarding, no gate, no person.
     * It survived the station re-derivation by being arithmetically correct
     * rather than right, which is the thing to watch for in that whole pass.
     *
     * Now 56 m out at 24 mm with the target dropped from 30 m to 14 m, so the
     * hoarding line, the gate and a figure are in shot and the tower runs out
     * of the top of the frame — which is what a person at a site gate
     * actually sees, and the only station where human scale is the subject.
     */
    name: "entry",
    target: [2, 14, 6],
    radius: 56.4,
    azimuth: -0.333,
    elevation: -0.2199,
    fov: 53.13,
    mm: 24,
  },
  {
    /* REAR — the far corner at 124 m, where the podium terrace, the offset
     * core and the crane's counter-jib are all exposed. The side nothing was
     * composed for, which is the one that proves the world survives an orbit. */
    name: "lane",
    target: [0, 40, 0],
    radius: 123.7,
    azimuth: 2.206,
    elevation: -0.3038,
    fov: 46.40,
    mm: 28,
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
/* How many figures walk the streets, per tier. Well below the measured knee
 * of 5,000-20,000 on purpose: the constraint here is composition, not frame
 * time. A city block with five thousand people on it reads as an evacuation. */
export const CROWD_SIZE = { desktop: 400, mobile: 150 };

export const SITE_METRICS = {
  /*
   * Concept D: a 64 x 52 m plot carrying a podium-and-tower of 30 floors.
   *
   * Every number here was MEASURED out of the shipped GLB rather than copied
   * from the Blender constants — accessor min/max on the architecture layer's
   * `conc` primitive gives 64.00 x 52.75 x 111.90. The width is the podium,
   * which covers the plot; the 111.90 is the core, which is slipformed past
   * the top slab as the lift overrun and is therefore taller than the
   * building.
   */
  plotWidth: 64,
  plotDepth: 52,
  /* Podium 4 x 4.5 m = 18 m, then 26 tower levels at 3.4 m = 106.4 m. */
  buildingHeight: 106.4,
  storeyHeight: 3.4,
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
 * ("architecture-conc") are PART BUCKETS on the node, not objects. Measured
 * from the shipped GLB, the building is the primitive in the architecture
 * layer whose material is `conc`, and under concept D it measures
 * 64.00 x 111.90 x 52.75 — `plotWidth` by the core height by `plotDepth`.
 *
 * KEEPING IT HONEST AS THE SITE GREW. A tower crane's counterweight is
 * concrete, so putting the crane in the architecture layer would have widened
 * this box to 72 m and the check would have gone on passing while measuring
 * something that is not the building. The crane is therefore named into the
 * SCAFFOLD layer, which is also where it belongs: it is site logistics, and it
 * leaves site. This check has been fooled by an arbitrary object once already;
 * that is the failure mode to keep designing against.
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
  /*
   * THE CITY'S THREE TONES.
   *
   * A skyline reads through tonal variation, and per-instance colour is not
   * available through EXT_mesh_gpu_instancing — so the variation has to live
   * in the material, and there have to be materials that actually differ.
   *
   * Measured 2026-08-20, these three shipped as #ffffff / roughness 1 / no
   * metalness — IDENTICAL, with `conc` and `city_cool` sharing the concrete
   * map as well. Two of the three "tones" were the same surface. Nothing was
   * flattening them at noon; they were never different.
   *
   * `tint` is the deliberate exception to dressSurface's white rule. It stays
   * gentle on purpose: the albedo map carries the surface, and a strong factor
   * multiplies the texture down until concrete reads as painted card.
   */
  city_warm: { tex: "brick", tint: 0xd8b9a0 },
  city_cool: { tex: "concrete", tint: 0x9db2c6 },
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
 * Load the baked PBR maps, ON DEMAND.
 *
 * Never rejects and never blocks: a surface whose maps fail keeps the flat
 * factor it already has, which is duller but completely correct. The form has
 * no relationship with any of this.
 *
 * DEMAND-DRIVEN, AND THAT IS THE POINT
 * ------------------------------------
 * This used to walk `SITE_SURFACES` and fetch all fifteen maps up front, which
 * meant the texture payload was decided by a STATIC TABLE rather than by what
 * the scene actually contains. Two consequences, both measured:
 *
 *   - Skipping a layer on mobile saved none of its textures. `ground` and
 *     `asphalt` are used by the street layer and by nothing else — 527 KB that
 *     a phone downloaded whether or not it loaded the street.
 *   - `spandrel` is in the table and appears in no shipped layer, so its maps
 *     were fetched on every load, on every device, for nothing.
 *
 * A slot is now fetched the first time `dressSurface` asks for it, which is
 * after its layer has arrived. The set of maps is therefore derived from the
 * geometry rather than declared alongside it, and the two cannot drift.
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

  /*
   * Map-shaped on purpose: `dressSurface` does `surfaces.get(slot)` and does
   * not need to know that the fetch happens here rather than earlier. `loaded`
   * is what the mobile-tier probe reads, because "which maps did this device
   * actually pull" is otherwise unobservable.
   */
  const resolved = new Map();
  return {
    get(slot) {
      const def = SITE_SURFACES[slot];
      if (!def) return undefined;
      if (!resolved.has(slot)) {
        resolved.set(slot, {
          map: grab(def.tex, "color", true),
          roughnessMap: grab(def.tex, "roughness", false),
          normalMap: grab(def.tex, "normal", false),
        });
      }
      return resolved.get(slot);
    },
    get loaded() { return [...cache.keys()].sort(); },
  };
}
