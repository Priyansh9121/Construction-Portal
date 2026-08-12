/**
 * Suspended site dust.
 *
 * WHAT THIS IS FOR
 * ----------------
 * A construction site is not clean air. Cutting, sweeping, plant movement and
 * dry ground put fine material into suspension, and it hangs in the low sun as
 * drifting light rather than as visible specks. That drift is what makes an
 * outdoor scene read as AIR instead of vacuum — the same job atmospheric haze
 * does for distance, but close to the camera where haze cannot reach.
 *
 * WHAT THIS IS NOT FOR
 * --------------------
 * Not a particle demo. There is no burst, no emitter shower, no sparkle. The
 * brief for this world is restraint: if the dust is noticeable as an effect it
 * has failed, because real dust is something you see THROUGH, not something
 * you look at.
 *
 * ONE WIND
 * --------
 * Every particle is advected by the world's single wind vector — the same one
 * that drives the clouds and the crane's suspended load. Giving dust its own
 * random drift is what makes a scene stop being one place, because the eye
 * reads two disagreeing directions as two unrelated animations.
 *
 * COST
 * ----
 * One Points draw call. Positions are updated on the CPU, which at this count
 * is cheaper than the uniform churn a GPU simulation would need, and keeps the
 * whole thing readable. Particles wrap within a box around the camera's
 * subject rather than being respawned, so there is no popping and no
 * allocation after construction.
 */

/* Soft round sprite. Generated rather than fetched: a 32 px canvas costs
 * nothing and avoids a network asset that could fail independently. */
function sprite(THREE) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.28)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDust(THREE, scene, {
  count = 420, box = [150, 34, 130], centre = [0, 12, 10], tint = 0xd8c9ae,
} = {}) {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  /* Per-particle drift factor. Real suspended material is graded: the fine
   * fraction moves with the air, the coarse fraction lags. One value per
   * particle is enough to stop the field translating as a rigid block. */
  const lag = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * box[0] + centre[0];
    positions[i * 3 + 1] = Math.random() * box[1] + (centre[1] - box[1] * 0.5);
    positions[i * 3 + 2] = (Math.random() - 0.5) * box[2] + centre[2];
    scales[i] = 0.5 + Math.random() * 0.9;
    lag[i] = 0.35 + Math.random() * 0.8;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));

  const material = new THREE.PointsMaterial({
    // Sized to be VISIBLE at the distance the site is seen from. At 0.34 it
    // was sub-pixel past 30 m, which is a cost with no image to show for it.
    size: 1.15,
    map: sprite(THREE),
    color: tint,
    transparent: true,
    opacity: 0.34,
    /* Additive would make dust glow, which is what a particle demo looks
     * like. Normal blending with depth-write off keeps it as suspended
     * material that the structure occludes correctly. */
    blending: THREE.NormalBlending,
    depthWrite: false,
    sizeAttenuation: true,
    /* Sorting hundreds of soft sprites every frame buys nothing at this
     * opacity and costs real time. */
    alphaTest: 0.01,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);

  const half = [box[0] / 2, box[1] / 2, box[2] / 2];
  const lo = [centre[0] - half[0], centre[1] - half[1], centre[2] - half[2]];

  return {
    points,

    /**
     * Advect on the world wind and settle slowly.
     *
     * `wind.x/z` is the same vector the clouds drift on and the crane load
     * swings against, so a gust moves the whole site at once.
     */
    update(dt, wind, t) {
      const arr = geometry.attributes.position.array;
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3;
        const drift = lag[i];
        arr[i3] += wind.x * drift * dt * 2.6;
        arr[i3 + 2] += wind.z * drift * dt * 2.6;
        /* Settling, with a slow vertical stir so the field never looks like
         * it is on rails. Fine dust does not fall straight. */
        arr[i3 + 1] += (Math.sin(t * 0.35 + i) * 0.16 - 0.09) * dt;

        /* Wrap rather than respawn: no allocation, and no particle ever
         * appears or vanishes in view. */
        for (let a = 0; a < 3; a += 1) {
          const v = arr[i3 + a];
          if (v < lo[a]) arr[i3 + a] = v + box[a];
          else if (v > lo[a] + box[a]) arr[i3 + a] = v - box[a];
        }
      }
      geometry.attributes.position.needsUpdate = true;
    },

    /** Reduced motion keeps the dust as haze, but stops it moving. */
    freeze() {
      this.update = () => {};
    },

    dispose() {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      scene.remove(points);
    },
  };
}
