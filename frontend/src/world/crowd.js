/**
 * A crowd, from one mesh and one texture.
 *
 * Every figure is an instance of the same 456-vertex mesh, and every figure's
 * pose comes from a VERTEX ANIMATION TEXTURE sampled in the vertex shader:
 * row = frame of the walk cycle, column = vertex, RGB = that vertex's position
 * normalised into the cycle's bounding box.
 *
 * WHY NOT SKELETONS
 * -----------------
 * Skeletal animation puts a per-character cost on the CPU — bone matrices, a
 * skinned draw call each — and that cost is what decides whether a site has a
 * dozen people on it or a thousand. Here the CPU writes one matrix per figure
 * once, at build, and then does nothing: the GPU reads the cycle out of a
 * texture. Adding a figure costs 16 floats and no draw call.
 *
 * WHY THE TEXTURE IS FETCHED AND NOT EMBEDDED
 * -------------------------------------------
 * `build_assets.sh` exports every GLB with `export_image_format: "NONE"` —
 * the mechanism that took the street layer from 11.49 MB to 0.91 MB. It would
 * strip a VAT out of a GLB exactly as readily as it strips a concrete map, and
 * the failure would be silent: a crowd whose animation data did not ship. So
 * the texture is its own file under /world/textures/, fetched like the CC0
 * surface maps, with its decode bounds beside it in JSON — an 8-bit texture is
 * meaningless without the range it was normalised into.
 *
 * NEVER GATES ANYTHING. Like every other asset here, a failure returns null
 * and the world carries on without a crowd.
 */

import { SITE_JOURNEY } from "./loginSite";

const BASE = "/world/textures";

/**
 * Fetch the figure, the texture and the bounds.
 *
 * Returns null rather than throwing: a missing crowd is a world with fewer
 * people in it, not a broken login.
 */
export async function loadCrowdAssets(THREE, { signal } = {}) {
  try {
    const [meta, texture] = await Promise.all([
      fetch(`${BASE}/walk-vat.json`, { signal }).then((r) => r.json()),
      new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(
          `${BASE}/walk-vat.png`, resolve, undefined, reject,
        );
      }),
    ]);

    /*
     * NEAREST, and no mipmaps or colour conversion.
     *
     * This texture is DATA. Filtering it interpolates between two vertices'
     * positions — which are unrelated points on a body — and mipmapping
     * averages a whole limb into a smear. sRGB decoding would bend the values
     * on a curve meant for colour.
     */
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return { meta, texture };
  } catch {
    return null;
  }
}

/**
 * Turn a loaded figure and a VAT into an instanced, walking crowd.
 *
 * `placements` is [{ p: [x, y, z], ry, speed }]. `speed` scales how fast that
 * figure walks its cycle, which is what stops a crowd marching in step.
 */
export function buildCrowd(THREE, geometry, material, vat, placements) {
  if (!vat || !placements?.length) return null;
  const { meta, texture } = vat;

  const geo = geometry.clone();

  /*
   * WHICH COLUMN AM I?
   *
   * The shader needs each vertex's index to find its column in the texture.
   * gl_VertexID would do it on WebGL2 only; an attribute works everywhere and
   * costs one float per vertex — 1.8 KB for this mesh, once.
   */
  const count = geo.getAttribute("position").count;
  const ids = new Float32Array(count);
  for (let i = 0; i < count; i += 1) ids[i] = i;
  geo.setAttribute("aVertexId", new THREE.BufferAttribute(ids, 1));

  const mat = material.clone();
  /*
   * The figure's colour lives in COLOR_0 — one material carrying hi-vis,
   * workwear, skin and hat as vertex colours, which is what let the body
   * collapse to a single primitive. If the flag is off the whole crowd renders
   * white, which is exactly how it first shipped.
   */
  if (geo.getAttribute("color")) mat.vertexColors = true;
  const uniforms = {
    uVat: { value: texture },
    uVatSize: { value: new THREE.Vector2(meta.vertices, meta.frames) },
    uVatLo: { value: new THREE.Vector3(...meta.lo) },
    uVatSpan: { value: new THREE.Vector3(
      meta.hi[0] - meta.lo[0], meta.hi[1] - meta.lo[1], meta.hi[2] - meta.lo[2]) },
    uTime: { value: 0 },
    /* How far one gait cycle carries a figure, MEASURED off the baked feet by
     * the baker rather than chosen here. Ground speed is this times the
     * figure's own cycle rate, so legs and travel come from one number and
     * nobody ice-skates. */
    uMetres: { value: meta.metresPerCycle ?? 0 },
  };

  /*
   * onBeforeCompile rather than a ShaderMaterial: the crowd has to be LIT by
   * the same sun, fog and shadows as everything else, and rewriting standard
   * lighting to animate a vertex is how a scene ends up with people who do not
   * belong to it.
   */
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `
        #include <common>
        uniform sampler2D uVat;
        uniform vec2 uVatSize;
        uniform vec3 uVatLo;
        uniform vec3 uVatSpan;
        uniform float uTime;
        uniform float uMetres;
        attribute float aVertexId;
        attribute float aPhase;
        attribute float aSpeed;
        attribute float aWrap;
      `)
      .replace("#include <begin_vertex>", `
        /*
         * Sample this vertex at this moment of the cycle.
         *
         * The row is the frame and the column is the vertex, both addressed at
         * texel CENTRES — sampling at the edge of a texel with NearestFilter
         * lands on whichever neighbour rounding prefers, which shows up as a
         * limb flickering between two poses.
         */
        float cyc = fract(uTime * aSpeed + aPhase);
        float row = floor(cyc * uVatSize.y);
        vec2 uv = vec2((aVertexId + 0.5) / uVatSize.x,
                       (row + 0.5) / uVatSize.y);
        vec3 baked = uVatLo + texture2D(uVat, uv).rgb * uVatSpan;

        /* Blender is Z-up and three is Y-up. The bake deliberately did not
         * convert, so the texture stays readable against the .blend. */
        vec3 transformed = vec3(baked.x, baked.z, -baked.y);

        /*
         * TRAVEL.
         *
         * The same cycle count that chose the pose also decides how far the
         * figure has walked, so the feet and the ground agree by construction.
         * Blender's +Y is the figure's forward, which is -Z here.
         *
         * Wrapped at aWrap, chosen per figure: a footpath runs the length of
         * the grid so its walkers wrap far away where fog has them, while
         * somebody crossing a road wraps at the width of the road rather than
         * strolling through the block on the far side.
         */
        float cycles = uTime * aSpeed + aPhase;
        transformed.z -= mod(cycles * uMetres, aWrap);
      `);
  };
  /* Changing the shader source means the program has to be rebuilt. */
  mat.customProgramCacheKey = () => "crowd-vat";
  mat.needsUpdate = true;

  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const dummy = new THREE.Object3D();
  const phases = new Float32Array(placements.length);
  const speeds = new Float32Array(placements.length);
  const wraps = new Float32Array(placements.length);

  placements.forEach((pl, i) => {
    dummy.position.set(pl.p[0], pl.p[1], pl.p[2]);
    dummy.rotation.set(0, pl.ry || 0, 0);
    dummy.scale.setScalar(pl.scale || 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    /* A crowd in step is a parade. Phase is the cure and it is free. */
    phases[i] = pl.phase ?? Math.random();
    speeds[i] = pl.speed ?? 0.7 + Math.random() * 0.5;
    wraps[i] = pl.wrap ?? 240;
  });
  geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  geo.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
  geo.setAttribute("aWrap", new THREE.InstancedBufferAttribute(wraps, 1));

  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;

  return {
    mesh,
    /** Advance the cycle. One uniform for the whole crowd. */
    advance(seconds) { uniforms.uTime.value = seconds; },
    dispose() {
      geo.dispose();
      mat.dispose();
      texture.dispose();
    },
  };
}

/*
 * WHERE PEOPLE ACTUALLY ARE
 * -------------------------
 * A crowd scattered on a disc reads as a field of people, not a city — and it
 * walks through buildings. These figures are placed against the same street
 * grid `concept_d.py` builds the city on, so they stand where a person stands:
 * on the footpath beside a road, crossing at a junction, along the hoarding
 * line, or on the apron inside the site gate.
 *
 * The constants MUST match concept_d.py. They are duplicated rather than
 * exported because the city is baked at build time and the crowd is placed at
 * runtime, and a shared file that only one side reads is worse than a stated
 * dependency.
 *
 *   CITY_GRID 62   CITY_ROAD 16   podium -32..32 x -26..26   hoarding +3.5
 *
 * Blender is Z-up and three is Y-up: a road at Blender y = c is at three
 * z = -c. The grid is symmetric about the origin, so it is generated directly
 * in three's coordinates here.
 */
const GRID = 62;
const ROAD = 16;
const PATH = ROAD / 2 + 1.6;        // kerb to footpath centre
const POD_X = 32;
const POD_Z = 26;
const HOARD = 3.5;
const REACH = 250;                  // beyond this, fog has them anyway

/** A seeded PRNG, so the same crowd comes back every load. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/*
 * WHERE THE CAMERA STANDS.
 *
 * Derived from SITE_JOURNEY rather than copied, in the rig's own spherical
 * convention, so a station that moves takes its keep-out with it. The city
 * already does this in concept_d.py; the crowd needs it for a different
 * reason — a block that overlaps the camera is a wall, but a PERSON that
 * overlaps the camera is a four-storey giant standing in the frame.
 */
function stationEyes() {
  return SITE_JOURNEY.map((st) => {
    const ce = Math.cos(st.elevation) * st.radius;
    return [
      st.target[0] + Math.sin(st.azimuth) * ce,
      st.target[2] + Math.cos(st.azimuth) * ce,
    ];
  });
}

/*
 * Distance from a point to a SEGMENT, not to a start.
 *
 * The keep-out has to cover the whole route: these figures walk up to `wrap`
 * metres from where they are placed, so testing the placement alone rejects
 * nothing that matters. The giant at entry had a perfectly innocent starting
 * position.
 */
function distToRoute(px, pz, x, z, heading, wrap) {
  const dx = -Math.sin(heading) * wrap;
  const dz = -Math.cos(heading) * wrap;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - x) * dx + (pz - z) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x + dx * t), pz - (z + dz * t));
}

const CAMERA_CLEAR = 8;

const insidePodium = (x, z) => Math.abs(x) < POD_X + 1 && Math.abs(z) < POD_Z + 1;

/**
 * Place `count` figures on the streets around the site.
 *
 * Each carries a heading that matches where it is — people on a footpath walk
 * along it, not across it — and a phase offset, because a crowd stepping in
 * unison is the one thing that would make this look worse than five static
 * figures.
 */
export function placeCrowd(count, { metresPerCycle = 1.31, seed = 20260820 } = {}) {
  const r = rng(seed);
  const eyes = stationEyes();
  const lines = [];
  for (let i = -Math.ceil(REACH / GRID); i <= Math.ceil(REACH / GRID); i += 1) {
    lines.push(i * GRID + GRID / 2);
  }

  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard += 1;
    const roll = r();
    let x; let z; let heading; let wrap;

    if (roll < 0.72) {
      // FOOTPATH. Beside a road, walking along it.
      const along = r() < 0.5;
      const line = lines[Math.floor(r() * lines.length)];
      const side = r() < 0.5 ? -1 : 1;
      const t = (r() * 2 - 1) * REACH;
      if (along) { x = t; z = line + side * PATH; heading = r() < 0.5 ? 0 : Math.PI; }
      else { x = line + side * PATH; z = t; heading = r() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
      wrap = 220;
    } else if (roll < 0.86) {
      // CROSSING. At a junction, heading across one of the two roads.
      const lx = lines[Math.floor(r() * lines.length)];
      const lz = lines[Math.floor(r() * lines.length)];
      const across = r() < 0.5;
      if (across) { x = lx + (r() * 2 - 1) * ROAD * 0.4; z = lz; heading = r() < 0.5 ? 0 : Math.PI; }
      else { x = lx; z = lz + (r() * 2 - 1) * ROAD * 0.4; heading = r() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
      /* Across the carriageway and no further. */
      wrap = ROAD + PATH * 2;
    } else if (roll < 0.94) {
      // THE HOARDING LINE. Along the site's own boundary, which is where the
      // people who are here for this project walk.
      const perim = r();
      const jitter = (r() * 2 - 1) * 2.0;
      if (perim < 0.5) {
        x = (r() * 2 - 1) * (POD_X + HOARD);
        z = (perim < 0.25 ? 1 : -1) * (POD_Z + HOARD + 2.4) + jitter;
        heading = r() < 0.5 ? 0 : Math.PI;
        wrap = POD_X * 2;
      } else {
        x = (perim < 0.75 ? 1 : -1) * (POD_X + HOARD + 2.4) + jitter;
        z = (r() * 2 - 1) * (POD_Z + HOARD);
        heading = r() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        wrap = POD_Z * 2;
      }
    } else {
      // INSIDE THE GATE. The apron between the hoarding and the podium, on the
      // street side where the gate opening is.
      x = (r() * 2 - 1) * 9;
      z = POD_Z + 1.5 + r() * 2.4;
      heading = Math.PI + (r() * 2 - 1) * 0.5;
      wrap = 14;
    }

    if (insidePodium(x, z)) continue;
    if (Math.hypot(x, z) > REACH) continue;
    /* Not through a camera. Tested against the ROUTE, because the figure
     * walks it — the placement itself is never the problem. */
    if (eyes.some(([ex, ez]) => distToRoute(ex, ez, x, z, heading, wrap) < CAMERA_CLEAR)) {
      continue;
    }

    out.push({
      p: [x, 0, z],
      ry: heading,
      /*
       * Phase spread over the whole ROUTE, not over one cycle.
       *
       * It already drives both the pose and the travel offset, so widening it
       * to the number of cycles that fills `wrap` starts each figure anywhere
       * along its route instead of at its placement. Placement was only ever
       * distributing START positions, which is why the crowd bunched at the
       * near edge of entry while the far end emptied — and it is why everyone
       * sharing a wrap used to pop at the same instant.
       *
       * Safe because the shader fracts the cycle count before indexing the
       * texture and mods it before travelling; a phase of 168 cycles is a
       * legal pose and a legal distance.
       */
      phase: r() * (wrap / metresPerCycle),
      speed: 0.72 + r() * 0.5,
      wrap,
      scale: 0.94 + r() * 0.12,
    });
  }
  return out;
}
