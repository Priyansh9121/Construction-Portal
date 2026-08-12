/**
 * Bevelled and profiled geometry for the construction world.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * Every solid in the world was a unit cube scaled to size. A cube has perfect
 * 90-degree arrises, and a perfect arris does one thing no real edge does: it
 * presents zero area to the light. Cast concrete has a chamfer or at minimum a
 * broken arris; fabricated steel has a formed edge; a sheet-metal cabin has a
 * folded return. Each of those catches a highlight along its length, and the
 * absence of that highlight everywhere at once is the dominant remaining
 * "cheap game asset" signal in the scene.
 *
 * The shader edge-light already added a highlight, but it is a shading trick:
 * it cannot change the SILHOUETTE, and against the sky the silhouette is what
 * the eye reads. This changes the geometry.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE INSTANCING PROBLEM, AND THE ANSWER
 * ─────────────────────────────────────────────────────────────────────────
 * InstancedMesh shares one geometry across every instance, and instances here
 * have wildly different scales — a 0.62 x 36 m column and a 43 x 0.3 m slab.
 * Scaling a cube with a baked 20 mm chamfer by those factors produces a 20 mm
 * chamfer on one axis and a 1.2 m chamfer on another. That is worse than no
 * bevel at all.
 *
 * So the bevel is baked in WORLD UNITS and the instance transform carries no
 * scale. Solids are bucketed by their exact dimensions, and each bucket gets
 * one geometry and one InstancedMesh. In this world that collapses to a small
 * number of buckets — every column is identical, every prop is identical, most
 * downstands share a section — so the draw-call cost barely moves while every
 * member gets a physically correct edge.
 */

/**
 * A chamfered rectangular solid, dimensions and chamfer in world units.
 *
 * Built as 6 face quads (each inset by the chamfer), 12 edge chamfer quads,
 * and 8 corner triangles: 44 triangles against a cube's 12. The chamfer is
 * FLAT, not rounded — this is cast concrete and folded steel, not soap.
 *
 * Normals are per-face rather than smoothed, because a chamfer that shades
 * smoothly into its neighbours reads as a fillet and loses the crisp double
 * highlight that makes it legible.
 */
export function bevelBox(THREE, w, h, d, chamfer) {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;

  /* Never eat more than 40% of the smallest dimension: a chamfer that large
   * stops being an edge treatment and starts being the shape. */
  const b = Math.max(0.001, Math.min(chamfer, Math.min(hx, hy, hz) * 0.4));

  const ix = hx - b;
  const iy = hy - b;
  const iz = hz - b;

  const pos = [];
  const nor = [];
  const uv = [];

  const push = (p, n, u) => {
    pos.push(p[0], p[1], p[2]);
    nor.push(n[0], n[1], n[2]);
    uv.push(u[0], u[1]);
  };

  const quad = (a, bb, c, dd, n) => {
    push(a, n, [0, 0]); push(bb, n, [1, 0]); push(c, n, [1, 1]);
    push(a, n, [0, 0]); push(c, n, [1, 1]); push(dd, n, [0, 1]);
  };

  const tri = (a, bb, c, n) => {
    push(a, n, [0, 0]); push(bb, n, [1, 0]); push(c, n, [1, 1]);
  };

  const N = (x, y, z) => {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };

  /* ---- Six inset faces ------------------------------------------------- */
  quad([-ix, -iy, hz], [ix, -iy, hz], [ix, iy, hz], [-ix, iy, hz], [0, 0, 1]);
  quad([ix, -iy, -hz], [-ix, -iy, -hz], [-ix, iy, -hz], [ix, iy, -hz], [0, 0, -1]);
  quad([hx, -iy, -iz], [hx, -iy, iz], [hx, iy, iz], [hx, iy, -iz], [1, 0, 0]);
  quad([-hx, -iy, iz], [-hx, -iy, -iz], [-hx, iy, -iz], [-hx, iy, iz], [-1, 0, 0]);
  quad([-ix, hy, iz], [ix, hy, iz], [ix, hy, -iz], [-ix, hy, -iz], [0, 1, 0]);
  quad([-ix, -hy, -iz], [ix, -hy, -iz], [ix, -hy, iz], [-ix, -hy, iz], [0, -1, 0]);

  /* ---- Twelve edge chamfers -------------------------------------------- */
  /* Vertical edges (four), running in y. */
  const vert = [
    [1, 1, ix, iz, hx, hz], [1, -1, ix, -iz, hx, -hz],
    [-1, -1, -ix, -iz, -hx, -hz], [-1, 1, -ix, iz, -hx, hz],
  ];
  for (const [sx, sz, ax, az, bx, bz] of vert) {
    quad([ax, -iy, bz], [bx, -iy, az], [bx, iy, az], [ax, iy, bz], N(sx, 0, sz));
  }

  /* Horizontal edges in x (top and bottom, front and back). */
  const horzX = [
    [1, 1, hy, iz, iy, hz], [1, -1, hy, -iz, iy, -hz],
    [-1, -1, -hy, -iz, -iy, -hz], [-1, 1, -hy, iz, -iy, hz],
  ];
  for (const [sy, sz, ay, az, by, bz] of horzX) {
    quad([-ix, ay, az], [ix, ay, az], [ix, by, bz], [-ix, by, bz], N(0, sy, sz));
  }

  /* Horizontal edges in z (top and bottom, left and right). */
  const horzZ = [
    [1, 1, hy, ix, iy, hx], [1, -1, hy, -ix, iy, -hx],
    [-1, -1, -hy, -ix, -iy, -hx], [-1, 1, -hy, ix, -iy, hx],
  ];
  for (const [sy, sx, ay, ax, by, bx] of horzZ) {
    quad([ax, ay, -iz], [ax, ay, iz], [bx, by, iz], [bx, by, -iz], N(sx, sy, 0));
  }

  /* ---- Eight corners ---------------------------------------------------- */
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        tri(
          [sx * hx, sy * iy, sz * iz],
          [sx * ix, sy * hy, sz * iz],
          [sx * ix, sy * iy, sz * hz],
          N(sx, sy, sz)
        );
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/**
 * Chamfer sizes, by what the object IS.
 *
 * Not one radius everywhere: a cast concrete arris and a folded sheet-metal
 * return are different manufacturing processes at different scales, and using
 * one value for both is what makes procedural geometry look procedural.
 *
 * Values are the real thing, in metres.
 */
export const CHAMFER = {
  /* Cast concrete: a 20 mm chamfer strip in the formwork, or a broken arris.
   * Deliberately small — this is reinforced concrete and must stay heavy and
   * rectilinear, not soft. */
  column: 0.02,
  slab: 0.025,
  beam: 0.022,
  core: 0.03,
  pad: 0.04,

  /* Fabricated steel: a formed or welded edge, larger than cast concrete. */
  cwt: 0.05,
  deck: 0.04,
  cab: 0.05,

  /* Sheet products: a folded return, larger again relative to thickness. */
  cabin: 0.06,
  hoard: 0.02,
  gate: 0.02,
  sign: 0.015,
  barrier: 0.05,
  plant: 0.05,
  lamp: 0.04,

  /* Timber and stacked material: sawn edges, and stacks are not precise. */
  ply: 0.012,
  pallet: 0.02,
  "rebar-stack": 0.01,

  /* Repeated small members keep the shader edge treatment: at 90 mm section a
   * geometric chamfer is sub-pixel from every camera station, and 44 triangles
   * each across ~500 props is 20k triangles bought for nothing. */
  prop: 0,
  rebar: 0,
  rail: 0,
  mass: 0,
};

/**
 * Bucket solids by exact dimension so each bucket can share one bevelled
 * geometry and one InstancedMesh.
 *
 * Keyed on millimetre-rounded size, which is finer than any real difference in
 * this world and coarse enough that floating-point noise cannot split a bucket.
 */
export function bucketBySize(solids) {
  const buckets = new Map();
  for (const s of solids) {
    const key = `${Math.round(s.s[0] * 1000)}|${Math.round(s.s[1] * 1000)}|${Math.round(s.s[2] * 1000)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { size: s.s, items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(s);
  }
  return [...buckets.values()];
}
