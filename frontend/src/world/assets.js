/**
 * Authored GLB assets: loading, instancing and — most importantly — failing
 * safely.
 *
 * THE CONTRACT
 * ------------
 * An authored asset is an UPGRADE over the procedural box that stands in its
 * place, never a dependency. The world is built first from the generated
 * layout, entirely from procedural geometry. When a GLB arrives, the boxes for
 * that kind are removed and the authored mesh is instanced at exactly the same
 * positions. If the fetch 404s, the decode fails, or the network never
 * answers, nothing is removed and the site is still coherent — just blockier.
 *
 * That ordering is deliberate. It means:
 *
 *   - the world never waits on a network request to appear
 *   - a broken asset degrades one object, not the scene
 *   - authentication is untouched either way, because the form has never had
 *     any relationship with this module
 *
 * INSTANCING
 * ----------
 * A GLB exported from Blender arrives as one mesh with one primitive per
 * material. Cloning the whole scene per placement would multiply draw calls by
 * the number of placements; instead each primitive becomes a single
 * InstancedMesh carrying every placement of that asset. Four cabins therefore
 * cost five draw calls — the same as one cabin.
 *
 * Geometry is baked into world space at load, so the instance transform only
 * ever carries position and a Y rotation. Placements never scale: these assets
 * are modelled at real size, and scaling one would be as wrong here as it was
 * for the bevelled boxes.
 */

const BASE = "/world/assets/";

/**
 * Load a set of GLBs. Never rejects: a failure is reported as a missing entry
 * so the caller keeps its procedural geometry rather than losing the object.
 */
export async function loadAssets(THREE, names, { signal } = {}) {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();

  /*
   * Meshopt decoding.
   *
   * The assets ship meshopt-compressed: 334 kB of GLB becomes 82 kB, a 76%
   * saving with no change to triangle count, normals or silhouette, because
   * nothing is simplified — only the vertex streams are quantised and packed.
   *
   * The decoder is the one three already ships, so this costs no new
   * dependency. It is loaded alongside the loader and both are inside the
   * lazily-imported world chunk, so a route without the world pays for
   * neither. If this import ever fails the loader reports the asset as
   * unavailable and the procedural geometry stays — the same path as a 404.
   */
  try {
    const { MeshoptDecoder } = await import(
      "three/examples/jsm/libs/meshopt_decoder.module.js");
    loader.setMeshoptDecoder(MeshoptDecoder);
  } catch (err) {
    console.warn("[world] meshopt decoder unavailable", err);
  }

  const out = new Map();

  await Promise.all(names.map((name) => new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    loader.load(
      `${BASE}${name}.glb`,
      (gltf) => {
        try {
          out.set(name, extract(THREE, gltf));
        } catch (err) {
          report(name, err);
        }
        resolve();
      },
      undefined,
      (err) => { report(name, err); resolve(); },
    );
  })));

  return out;
}

function report(name, err) {
  /* Deliberately a warning, not a throw. A missing hero asset is a visual
   * regression, not a broken page, and the console is where that belongs. */
  console.warn(`[world] asset "${name}" unavailable; keeping procedural form`, err);
}

/**
 * Flatten a loaded glTF into world-space primitives ready to instance.
 */
function extract(THREE, gltf) {
  gltf.scene.updateMatrixWorld(true);
  const prims = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geometry = o.geometry.clone();
    dequantize(THREE, geometry);

    /*
     * AN InstancedMesh IS AN isMesh, AND ITS PLACEMENTS ARE NOT IN matrixWorld.
     *
     * EXT_mesh_gpu_instancing arrives from the loader as an InstancedMesh whose
     * own matrixWorld is the Empty's — identity — with every real placement in
     * `instanceMatrix`. Baking matrixWorld and dropping instanceMatrix
     * therefore collapsed all 17 clad floors of the tower into ONE, at z = 0,
     * inside the podium: the export was correct, the GLB carried the extension,
     * the loader built the InstancedMesh, and the world drew a building with no
     * floors. Nothing threw, and the byte gate was delighted.
     *
     * So instanced nodes keep their geometry in local space and carry their
     * matrices out, composed with the node's own world transform.
     */
    if (o.isInstancedMesh && o.instanceMatrix) {
      geometry.computeBoundingSphere();
      const m = new THREE.Matrix4();
      const world = o.matrixWorld;
      const matrices = [];
      for (let i = 0; i < o.count; i += 1) {
        o.getMatrixAt(i, m);
        matrices.push(new THREE.Matrix4().multiplyMatrices(world, m));
      }
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((material) => prims.push({ geometry, material, matrices }));
      return;
    }

    /* Bake the node transform. Blender's exporter may nest the mesh under a
     * root node, and an un-baked transform would place every instance at the
     * origin of that node instead of at its placement. */
    geometry.applyMatrix4(o.matrixWorld);
    geometry.computeBoundingSphere();
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach((material) => prims.push({ geometry, material }));
  });
  if (!prims.length) throw new Error("no meshes in asset");
  return prims;
}

/**
 * Widen quantised attributes to float BEFORE any transform is baked in.
 *
 * Meshopt-compressed assets arrive with positions and normals stored as
 * NORMALIZED INTEGERS, with the scale that maps them back to metres carried on
 * the node transform. `BufferGeometry.applyMatrix4` transforms the position
 * attribute in place — so it computes correct float coordinates and then
 * writes them straight back into an Int16Array, where they are truncated to
 * the integer grid.
 *
 * The result is not subtle: the cabins rendered as flattened slivers. It was
 * invisible in every number — file sizes fell 70%, triangle counts were
 * unchanged, no warning was logged, frame time did not move — and only showed
 * up by cropping the compound out of a screenshot and looking at it.
 */
function dequantize(THREE, geometry) {
  for (const name of ["position", "normal", "tangent", "uv", "uv1"]) {
    const attr = geometry.getAttribute(name);
    if (!attr || attr.array instanceof Float32Array) continue;
    const out = new Float32Array(attr.count * attr.itemSize);
    /* Read through the accessor, which applies the normalization, rather than
     * copying the raw integer array. */
    for (let i = 0; i < attr.count; i += 1) {
      out[i * attr.itemSize] = attr.getX(i);
      if (attr.itemSize > 1) out[i * attr.itemSize + 1] = attr.getY(i);
      if (attr.itemSize > 2) out[i * attr.itemSize + 2] = attr.getZ(i);
      if (attr.itemSize > 3) out[i * attr.itemSize + 3] = attr.getW(i);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
  }
}

/**
 * Instance one asset at a list of placements.
 *
 * `placements` are `{ p: [x, y, z], ry?: radians }` — a ground position and an
 * optional yaw. The asset's own origin sits at its ground contact, which is
 * what makes `p` a position on the site rather than a mesh centre that every
 * caller would have to offset by half a height.
 */
export function placeAsset(THREE, scene, prims, placements, {
  cast = true, receive = true, envIntensity = 1,
} = {}) {
  if (!prims?.length || !placements.length) return [];
  const dummy = new THREE.Object3D();
  const meshes = [];

  for (const { geometry, material } of prims) {
    const mat = material.clone();
    mat.envMapIntensity = envIntensity;
    const mesh = new THREE.InstancedMesh(geometry, mat, placements.length);
    placements.forEach((placement, i) => {
      dummy.position.set(placement.p[0], placement.p[1], placement.p[2]);
      dummy.rotation.set(0, placement.ry || 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.frustumCulled = true;
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

/**
 * Count what an asset actually costs, so "the cabin is authored now" comes
 * with a number rather than a claim.
 */
export function assetCost(prims, count) {
  let tris = 0;
  for (const { geometry } of prims) {
    const index = geometry.getIndex();
    tris += (index ? index.count : geometry.getAttribute("position").count) / 3;
  }
  return { draws: prims.length, tris: Math.round(tris * count) };
}
