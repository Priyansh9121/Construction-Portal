/**
 * Procedural PBR maps for the construction world.
 *
 * Generated into canvases at runtime rather than shipped as image files. A
 * 512px fBm field costs a few milliseconds, weighs nothing, needs no licence
 * and no network request, and — unlike a photo texture — can be authored to
 * match the exact material it describes.
 *
 * Every family emits three maps, because base colour alone is what makes
 * geometry read as coloured plastic:
 *
 *   map           albedo, with real tonal variation
 *   roughnessMap  where the surface is polished and where it is not
 *   normalMap     derived from the same height field by Sobel
 *
 * The normal map is the one that matters most. Flat-shaded concrete is a
 * uniform value across a face; real concrete catches the sun differently
 * across a metre, and that is a surface-normal effect, not a colour one.
 */

/* One seeded generator for every map, so the whole world is reproducible. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Value-noise lattice with smooth interpolation, tileable by construction. */
function lattice(n, rand) {
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i += 1) g[i] = rand();
  return { n, g };
}

function sample({ n, g }, x, y) {
  const fx = x * n;
  const fy = y * n;
  const x0 = Math.floor(fx) % n;
  const y0 = Math.floor(fy) % n;
  const x1 = (x0 + 1) % n;
  const y1 = (y0 + 1) % n;
  const tx = fx - Math.floor(fx);
  const ty = fy - Math.floor(fy);
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = g[y0 * n + x0] + (g[y0 * n + x1] - g[y0 * n + x0]) * sx;
  const b = g[y1 * n + x0] + (g[y1 * n + x1] - g[y1 * n + x0]) * sx;
  return a + (b - a) * sy;
}

/** Fractional Brownian motion: octaves at halving amplitude. The large octaves
 * give pour-to-pour tonal drift, the small ones give aggregate. */
function fbm(octaves, x, y) {
  let v = 0;
  let amp = 1;
  let total = 0;
  for (const o of octaves) {
    v += sample(o, x, y) * amp;
    total += amp;
    amp *= 0.5;
  }
  return v / total;
}

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

/**
 * Sobel a height field into a tangent-space normal map.
 *
 * `strength` is in height units per texel; higher values make the surface read
 * as coarser without changing its colour at all.
 */
function normalFrom(height, size, strength) {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));

      let nx = dx * strength;
      let ny = dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;

      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function toTexture(THREE, canvas, repeat, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * CONCRETE.
 *
 * Two scales of variation, because that is what concrete has: broad drift from
 * one pour to the next, and fine aggregate mottling within a pour. Roughness
 * is inversely correlated with the fine detail — the raised aggregate is
 * slightly polished by the formwork, the pits are not.
 */
function concrete(THREE, { size = 512, tint = [0.66, 0.65, 0.63], seed = 7, repeat = 4 } = {}) {
  const rand = rng(seed);
  const oct = [lattice(4, rand), lattice(10, rand), lattice(28, rand), lattice(64, rand)];

  const albedo = makeCanvas(size);
  const rough = makeCanvas(size);
  const ac = albedo.getContext("2d");
  const rc = rough.getContext("2d");
  const ai = ac.createImageData(size, size);
  const ri = rc.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = sample(oct[0], u, v);
      const fine = fbm(oct.slice(1), u, v);
      const h = fine * 0.75 + broad * 0.25;
      height[y * size + x] = h;

      /* Pour drift is a wide, low-contrast band; aggregate is tight and
       * high-contrast. Combined they never repeat visibly at 4x tiling. */
      const value = 0.78 + broad * 0.16 + (fine - 0.5) * 0.2;
      const i = (y * size + x) * 4;
      ai.data[i] = 255 * tint[0] * value;
      ai.data[i + 1] = 255 * tint[1] * value;
      ai.data[i + 2] = 255 * tint[2] * value;
      ai.data[i + 3] = 255;

      const r = 0.86 - (fine - 0.5) * 0.34;
      ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = 255 * r;
      ri.data[i + 3] = 255;
    }
  }
  ac.putImageData(ai, 0, 0);
  rc.putImageData(ri, 0, 0);

  return {
    map: toTexture(THREE, albedo, repeat, true),
    roughnessMap: toTexture(THREE, rough, repeat, false),
    normalMap: toTexture(THREE, normalFrom(height, size, 2.2), repeat, false),
  };
}

/**
 * COMPACTED SITE GROUND.
 *
 * Coarser and warmer than concrete, with directional drift so it reads as
 * tracked-over earth rather than as noise.
 */
function soil(THREE, { size = 512, repeat = 30, seed = 21 } = {}) {
  const rand = rng(seed);
  const oct = [lattice(3, rand), lattice(8, rand), lattice(22, rand), lattice(52, rand)];
  const albedo = makeCanvas(size);
  const rough = makeCanvas(size);
  const ac = albedo.getContext("2d");
  const rc = rough.getContext("2d");
  const ai = ac.createImageData(size, size);
  const ri = rc.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      /* Stretched sampling: plant and traffic move along the site, so the
       * ground's grain runs with them rather than being isotropic. */
      const h = fbm(oct, u * 1.0, v * 0.42);
      height[y * size + x] = h;

      const value = 0.62 + h * 0.5;
      const i = (y * size + x) * 4;
      ai.data[i] = 255 * 0.42 * value * 1.15;
      ai.data[i + 1] = 255 * 0.37 * value;
      ai.data[i + 2] = 255 * 0.3 * value * 0.9;
      ai.data[i + 3] = 255;

      ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = 255 * (0.95 - h * 0.1);
      ri.data[i + 3] = 255;
    }
  }
  ac.putImageData(ai, 0, 0);
  rc.putImageData(ri, 0, 0);

  return {
    map: toTexture(THREE, albedo, repeat, true),
    roughnessMap: toTexture(THREE, rough, repeat, false),
    normalMap: toTexture(THREE, normalFrom(height, size, 3.4), repeat, false),
  };
}

/**
 * PAINTED INDUSTRIAL STEEL.
 *
 * Machinery paint is not uniform: it chalks on the sun side, collects dirt in
 * the corners and shows the substrate at the edges. Low-frequency mottling
 * plus a roughness break-up is enough to read as worn paint at any distance a
 * crane is actually seen from.
 */
function paint(THREE, { size = 256, repeat = 3, seed = 33 } = {}) {
  const rand = rng(seed);
  const oct = [lattice(3, rand), lattice(9, rand), lattice(26, rand)];
  const albedo = makeCanvas(size);
  const rough = makeCanvas(size);
  const ac = albedo.getContext("2d");
  const rc = rough.getContext("2d");
  const ai = ac.createImageData(size, size);
  const ri = rc.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const h = fbm(oct, x / size, y / size);
      const i = (y * size + x) * 4;
      const wear = 0.82 + h * 0.32;
      ai.data[i] = 255 * Math.min(1, 0.86 * wear);
      ai.data[i + 1] = 255 * Math.min(1, 0.52 * wear);
      ai.data[i + 2] = 255 * Math.min(1, 0.17 * wear);
      ai.data[i + 3] = 255;
      ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = 255 * (0.5 + h * 0.34);
      ri.data[i + 3] = 255;
    }
  }
  ac.putImageData(ai, 0, 0);
  rc.putImageData(ri, 0, 0);
  return {
    map: toTexture(THREE, albedo, repeat, true),
    roughnessMap: toTexture(THREE, rough, repeat, false),
  };
}

/** PLYWOOD FORMWORK: warm, directional grain with panel-scale drift. */
function plywood(THREE, { size = 256, repeat = 2, seed = 51 } = {}) {
  const rand = rng(seed);
  const oct = [lattice(2, rand), lattice(7, rand), lattice(40, rand)];
  const albedo = makeCanvas(size);
  const ac = albedo.getContext("2d");
  const ai = ac.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      /* Grain runs along the sheet: sampled long in x, tight in y. */
      const g = fbm(oct, x / size * 0.3, y / size * 3.2);
      const i = (y * size + x) * 4;
      const v = 0.68 + g * 0.4;
      ai.data[i] = 255 * Math.min(1, 0.78 * v);
      ai.data[i + 1] = 255 * Math.min(1, 0.6 * v);
      ai.data[i + 2] = 255 * Math.min(1, 0.38 * v);
      ai.data[i + 3] = 255;
    }
  }
  ac.putImageData(ai, 0, 0);
  return { map: toTexture(THREE, albedo, repeat, true) };
}

/**
 * TRIPLANAR PROJECTION.
 *
 * Every solid in this world is a unit cube scaled to size, and the columns are
 * scaled 0.62m wide by 36m tall. Standard UVs stretch with the box, so a
 * concrete texture became 58:1 vertical streaks — the columns read as TIMBER,
 * which a render showed at once.
 *
 * Triplanar sampling ignores UVs entirely: it samples the texture three times
 * in world space, on the XY, XZ and YZ planes, and blends by the surface
 * normal. Scale stops mattering, so one material is correct on a column, a
 * slab and a 520-metre ground plane at the same time.
 *
 * Patched into MeshStandardMaterial through onBeforeCompile rather than
 * written as a new ShaderMaterial, so shadows, fog, tone mapping and the whole
 * standard lighting model keep working untouched.
 */
function triplanar(material, scale = 0.35) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = { value: scale };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vTriPos;
         varying vec3 vTriNrm;`
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
         vTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vTriNrm = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uTriScale;
         varying vec3 vTriPos;
         varying vec3 vTriNrm;

         vec4 triSample(sampler2D tex, vec3 p, vec3 n) {
           // Sharpened blend: a soft blend muddies every edge in the scene.
           vec3 w = pow(abs(n), vec3(4.0));
           w /= (w.x + w.y + w.z);
           vec4 x = texture2D(tex, p.zy * uTriScale);
           vec4 y = texture2D(tex, p.xz * uTriScale);
           vec4 z = texture2D(tex, p.xy * uTriScale);
           return x * w.x + y * w.y + z * w.z;
         }

         /*
          * ANALYTIC AMBIENT OCCLUSION.
          *
          * Real ambient light arrives from the sky dome, so how much of it a
          * surface receives is a function of how much sky that surface can
          * see. Two terms approximate that without a single extra pass:
          *
          *   HEIGHT   near the ground, the ground itself blocks half the
          *            hemisphere and neighbouring geometry blocks more. This
          *            is what puts a column INTO the site instead of on it.
          *   NORMAL   a downward-facing surface sees no sky at all. This is
          *            what gives a slab a dark soffit, which is most of what
          *            makes it read as having mass.
          *
          * A screen-space pass would be more correct and cost a full-resolution
          * depth prepass plus a blur. At this scene's complexity the analytic
          * version is visually indistinguishable in stills and free.
          */
         float skyOcclusion(vec3 p, vec3 n) {
           float ground = smoothstep(0.0, 3.2, p.y);
           float facing = n.y * 0.5 + 0.5;
           float soffit = mix(0.30, 1.0, smoothstep(0.15, 0.75, facing));
           return mix(0.42, 1.0, ground) * soffit;
         }

         /*
          * EDGE LIGHT.
          *
          * Perfectly sharp 90-degree edges are one of the strongest "game
          * asset" tells, because a real cast arris is slightly chamfered and
          * catches the key light along its length.
          *
          * The triplanar blend weights already say where an edge is: on a flat
          * face one weight dominates, on an edge two are comparable. That
          * gives an edge mask for free, with no bevelled geometry, no extra
          * vertices and no change to the silhouette — which is exactly what is
          * wanted, since the goal is light catching rather than rounded
          * architecture.
          */
         float edgeMask(vec3 n) {
           vec3 w = pow(abs(n), vec3(4.0));
           w /= (w.x + w.y + w.z);
           float dominant = max(w.x, max(w.y, w.z));
           return smoothstep(0.92, 0.62, dominant);
         }`
      )
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
           diffuseColor *= triSample(map, vTriPos, vTriNrm);
         #endif`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `float roughnessFactor = roughness;
         #ifdef USE_ROUGHNESSMAP
           roughnessFactor *= triSample(roughnessMap, vTriPos, vTriNrm).g;
         #endif`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#ifdef USE_NORMALMAP
           vec3 triN = triSample(normalMap, vTriPos, vTriNrm).xyz * 2.0 - 1.0;
           triN.xy *= normalScale;
           normal = normalize(normal + triN * 0.6);
         #endif`
      )
      /* AO multiplies the INDIRECT term only. Occluding the direct sun as well
       * would darken surfaces the sun demonstrably reaches, which is the
       * mistake that makes cheap AO look like dirt. */
      .replace(
        "#include <aomap_fragment>",
        `float triAO = skyOcclusion(vTriPos, normalize(vTriNrm));
         reflectedLight.indirectDiffuse *= triAO;
         reflectedLight.indirectSpecular *= mix(1.0, triAO, 0.6);

         // The arris takes a little more of the sky than the face beside it.
         float triEdge = edgeMask(normalize(vTriNrm));
         reflectedLight.indirectDiffuse *= (1.0 + triEdge * 0.55);`
      );
  };
  /* Distinct key, or three.js reuses one compiled program for materials whose
   * shaders now differ. */
  material.customProgramCacheKey = () => `tri-${scale}`;
  return material;
}

export function buildMaterialLibrary(THREE) {
  const t0 = performance.now();

  /*
   * Concrete albedo is COOL, deliberately.
   *
   * A neutral tint under a saturated low sun renders orange-brown, and the
   * columns read as timber — visible immediately in a dusk render. Real
   * concrete is identifiable because its lit face goes warm while its shadow
   * face stays cool from sky bounce; biasing the albedo blue is what preserves
   * that split once the key light is warm.
   */
  const conc = concrete(THREE, { tint: [0.6, 0.63, 0.68], seed: 7, repeat: 3 });
  /* A second concrete with a different seed and tint: adjacent pours are never
   * the same colour, and using one texture for the whole frame is exactly what
   * makes a building read as an extrusion. */
  const conc2 = concrete(THREE, { tint: [0.55, 0.58, 0.64], seed: 19, repeat: 2.4 });
  const gnd = soil(THREE, {});
  const pad = concrete(THREE, { tint: [0.63, 0.66, 0.7], seed: 5, repeat: 9 });
  const pnt = paint(THREE, {});
  const ply = plywood(THREE, {});

  const lib = {
    concrete: triplanar(new THREE.MeshStandardMaterial({
      ...conc, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.7, 0.7),
    }), 0.28),
    concreteAlt: triplanar(new THREE.MeshStandardMaterial({
      ...conc2, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.65, 0.65),
    }), 0.22),
    pad: triplanar(new THREE.MeshStandardMaterial({
      ...pad, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.5, 0.5),
    }), 0.12),
    ground: triplanar(new THREE.MeshStandardMaterial({
      ...gnd, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.3, 1.3),
    }), 0.055),
    paint: triplanar(new THREE.MeshStandardMaterial({ ...pnt, metalness: 0.32 }), 0.5),
    /* Galvanised steel: no albedo texture needed at the scale scaffold is seen,
     * but it must be properly metallic or it reads as grey plastic. */
    galv: new THREE.MeshStandardMaterial({
      color: 0x9aa3ab, roughness: 0.42, metalness: 0.9,
    }),
    ply: new THREE.MeshStandardMaterial({ ...ply, roughness: 0.85, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.9, metalness: 0.1 }),
  };

  lib.buildMs = Math.round(performance.now() - t0);
  return lib;
}
