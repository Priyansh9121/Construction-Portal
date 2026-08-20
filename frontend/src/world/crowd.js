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
  const uniforms = {
    uVat: { value: texture },
    uVatSize: { value: new THREE.Vector2(meta.vertices, meta.frames) },
    uVatLo: { value: new THREE.Vector3(...meta.lo) },
    uVatSpan: { value: new THREE.Vector3(
      meta.hi[0] - meta.lo[0], meta.hi[1] - meta.lo[1], meta.hi[2] - meta.lo[2]) },
    uTime: { value: 0 },
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
        attribute float aVertexId;
        attribute float aPhase;
        attribute float aSpeed;
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
      `);
  };
  /* Changing the shader source means the program has to be rebuilt. */
  mat.customProgramCacheKey = () => "crowd-vat";
  mat.needsUpdate = true;

  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const dummy = new THREE.Object3D();
  const phases = new Float32Array(placements.length);
  const speeds = new Float32Array(placements.length);

  placements.forEach((pl, i) => {
    dummy.position.set(pl.p[0], pl.p[1], pl.p[2]);
    dummy.rotation.set(0, pl.ry || 0, 0);
    dummy.scale.setScalar(pl.scale || 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    /* A crowd in step is a parade. Phase is the cure and it is free. */
    phases[i] = pl.phase ?? Math.random();
    speeds[i] = pl.speed ?? 0.7 + Math.random() * 0.5;
  });
  geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  geo.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speeds, 1));

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
