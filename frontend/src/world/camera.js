/**
 * The camera rig: a body standing in the site, not a viewer inspecting a model.
 *
 * WHAT WAS WRONG BEFORE
 * ---------------------
 * The previous rig orbited about a station's look-at point by ±0.30 radians of
 * pointer influence — about ±17° — and the wheel scaled the orbit radius.
 *
 * Both are model-viewer behaviours. A ±17° swing cannot change which objects
 * occlude which, so it reads as a parallax novelty rather than as movement. And
 * a radius scale is a ZOOM: the whole image scales together, nothing passes
 * anything else, and no relationship between objects changes. Those two facts
 * are most of why the scene read as a model placed in front of a form.
 *
 * WHAT THIS IS INSTEAD
 * --------------------
 * A spherical rig with four independent inputs, damped separately:
 *
 *   journey     the wheel moves the camera BETWEEN AUTHORED PLACES in the
 *               site. Each station has its own target, standing distance,
 *               bearing, eye height and focal length, so moving through them
 *               changes where the camera IS — foreground sweeps, backgrounds
 *               creep, and objects occlude in a different order at each one.
 *
 *   drag        unbounded azimuth. 0 -> 360 -> 720 keeps going, because sin
 *               and cos do not care how many turns have accumulated. This is
 *               the input that proves the site is a world: you can walk right
 *               around it and see the far elevation.
 *
 *   pointer     a bounded, decaying drift about wherever the camera currently
 *               is. Cinematic response to presence, not navigation.
 *
 *   focus       the form asking for a small, specific recomposition.
 *
 * THE CAMERA TRAVELS; THE SITE DOES NOT ROTATE
 * --------------------------------------------
 * Every position is computed in WORLD space about a world-space target, and
 * the target itself moves between stations. Nothing is ever applied to the
 * scene's transform. That distinction is the whole point: rotating the world
 * about its own centre would move every object by the same angle and produce
 * no parallax at all.
 *
 * DAMPING IS FRAMERATE-INDEPENDENT
 * --------------------------------
 * `1 - exp(-rate * dt)`, not a fixed fraction per frame. A fixed fraction makes
 * the camera's weight depend on the display's refresh rate, so the same rig
 * feels heavy at 120 Hz and twitchy at 30 Hz.
 */

const TAU = Math.PI * 2;

/** Exponential smoothing toward a target, independent of frame rate. */
function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function smoothstep(t) {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

export class CameraRig {
  constructor(THREE, cam, journey, { portrait = false } = {}) {
    this.THREE = THREE;
    this.cam = cam;
    this.stations = journey;
    this.portrait = portrait;

    /* Where along the journey the camera is, as a float index. */
    this.progress = 0;
    this.progressTo = 0;

    /* Drag: unbounded azimuth, so a full turn is just a bigger number. */
    this.dragAz = 0;
    this.dragAzTo = 0;
    this.dragEl = 0;
    this.dragElTo = 0;
    this.dragging = false;
    this.lastDrag = null;
    /* True once the user has taken manual control, which suppresses the
     * ambient composition drift so the two never fight. */
    this.explored = false;

    /* Pointer drift: bounded and decaying. */
    this.driftAz = 0;
    this.driftAzTo = 0;
    this.driftEl = 0;
    this.driftElTo = 0;
    this.pointerAt = 0;

    /* How much the pointer is allowed to move the camera right now. Drops
     * while the pointer is over the form, so operating a control does not
     * swing the world under it. */
    this.calm = 1;
    this.calmTo = 1;

    /* Damped spherical state, seeded from the first station so the world does
     * not have to ease in from an arbitrary origin. */
    const s = this.stations[0];
    this.target = new THREE.Vector3(...s.target);
    this.radius = s.radius;
    this.azimuth = s.azimuth;
    this.elevation = s.elevation;
    this.fov = s.fov;
    this.settled = false;
  }

  /* ---- inputs ---------------------------------------------------------- */

  /** Normalised pointer, -1..1 on each axis. */
  setPointer(nx, ny, now) {
    this.driftAzTo = -nx * 0.34;
    this.driftElTo = -ny * 0.13;
    this.pointerAt = now;
  }

  /** Reduce the pointer's authority — used while the form is being operated. */
  setCalm(value) {
    this.calmTo = value;
  }

  beginDrag(x, y) {
    this.dragging = true;
    this.explored = true;
    this.lastDrag = { x, y };
  }

  /**
   * Direct orbit. Deliberately UNCLAMPED in azimuth: the acceptance test for
   * this world is being able to walk right around it, so 0 -> 360 -> 720 must
   * simply keep going rather than stopping or snapping.
   */
  drag(x, y, viewport) {
    if (!this.dragging || !this.lastDrag) return;
    const dx = (x - this.lastDrag.x) / viewport.width;
    const dy = (y - this.lastDrag.y) / viewport.height;
    this.lastDrag = { x, y };
    this.dragAzTo -= dx * TAU * 1.15;
    this.dragElTo -= dy * 1.5;
  }

  endDrag() {
    this.dragging = false;
    this.lastDrag = null;
  }

  /**
   * The wheel moves ALONG THE JOURNEY, not toward the subject.
   *
   * Returns true when the gesture was consumed, so the caller can decide
   * whether the page should scroll instead — the world must never trap a
   * user who is trying to reach something below it.
   */
  wheel(delta) {
    const before = this.progressTo;
    this.progressTo = Math.max(
      0, Math.min(this.stations.length - 1, this.progressTo + delta * 0.0022));
    this.explored = true;
    return this.progressTo !== before;
  }

  /** Jump the journey to a named station (the form's focus responses). */
  goTo(name, { immediate = false } = {}) {
    const i = this.stations.findIndex((s) => s.name === name);
    if (i < 0) return;
    this.progressTo = i;
    if (immediate) this.progress = i;
  }

  /* ---- the interpolated station ---------------------------------------- */

  stationAt(p) {
    const n = this.stations.length;
    const i = Math.max(0, Math.min(n - 1, Math.floor(p)));
    const j = Math.min(n - 1, i + 1);
    const f = smoothstep(p - i);
    const a = this.stations[i];
    const b = this.stations[j];
    const mix = (u, v) => u + (v - u) * f;
    return {
      tx: mix(a.target[0], b.target[0]),
      ty: mix(a.target[1], b.target[1]),
      tz: mix(a.target[2], b.target[2]),
      radius: mix(a.radius, b.radius),
      /* Azimuth is interpolated DIRECTLY, not by shortest arc. The stations
       * are authored as a walk around the site, so the long way round is
       * often the intended path. */
      azimuth: mix(a.azimuth, b.azimuth),
      elevation: mix(a.elevation, b.elevation),
      fov: mix(a.fov, b.fov),
    };
  }

  /* ---- per-frame ------------------------------------------------------- */

  update(dt, now, reduced) {
    if (reduced) {
      /* A composed still: the authored station, no drift, no journey. */
      const s = this.stationAt(this.progressTo);
      this.applySpherical(s.tx, s.ty, s.tz, s.radius, s.azimuth, s.elevation,
                          s.fov);
      return;
    }

    /* Pointer drift decays back toward the authored composition when the
     * pointer has been still, so an unattended page returns to its framing
     * rather than holding whatever angle it was left at. */
    if (now - this.pointerAt > 3200) {
      this.driftAzTo = 0;
      this.driftElTo = 0;
    }

    this.calm = damp(this.calm, this.calmTo, 6, dt);
    this.progress = damp(this.progress, this.progressTo, 2.6, dt);
    /* Drag is the heaviest input: it is the one the user is actively pushing,
     * and mass is what makes it feel like a body rather than a slider. */
    this.dragAz = damp(this.dragAz, this.dragAzTo, this.dragging ? 9 : 3.4, dt);
    this.dragEl = damp(this.dragEl, this.dragElTo, this.dragging ? 9 : 3.4, dt);
    this.driftAz = damp(this.driftAz, this.driftAzTo * this.calm, 2.2, dt);
    this.driftEl = damp(this.driftEl, this.driftElTo * this.calm, 2.2, dt);

    const s = this.stationAt(this.progress);
    const azimuth = s.azimuth + this.dragAz + this.driftAz;
    const elevation = s.elevation + this.dragEl + this.driftEl;

    this.applySpherical(s.tx, s.ty, s.tz, s.radius, azimuth, elevation, s.fov);
    this.settled = Math.abs(this.progress - this.progressTo) < 0.01;
  }

  /**
   * Write the camera from spherical coordinates about a world-space target.
   *
   * The elevation clamp is DYNAMIC: it is expressed as a minimum eye height
   * above the ground rather than as a fixed angle, because the same angle puts
   * the camera underground at 80 m radius and at head height at 19 m. A fixed
   * clamp is how a rig ends up filming from inside the earth at one station
   * and from the air at another.
   */
  applySpherical(tx, ty, tz, radius, azimuth, elevation, fov) {
    const MIN_EYE = 1.5;
    const MAX_EL = 1.15;                   // ~66°, short of a plan view
    let el = Math.min(MAX_EL, elevation);
    if (ty + Math.sin(el) * radius < MIN_EYE) {
      el = Math.asin(Math.max(-1, Math.min(1, (MIN_EYE - ty) / radius)));
    }

    const cosEl = Math.cos(el);
    this.cam.position.set(
      tx + Math.sin(azimuth) * cosEl * radius,
      ty + Math.sin(el) * radius,
      tz + Math.cos(azimuth) * cosEl * radius,
    );
    this.cam.lookAt(tx, ty, tz);

    if (Math.abs(this.cam.fov - fov) > 0.01) {
      this.cam.fov = fov;
      this.cam.updateProjectionMatrix();
    }
    this.azimuth = azimuth;
    this.elevation = el;
    this.radius = radius;
    this.fov = fov;
    this.target.set(tx, ty, tz);
  }

  /** Read-only state, for verification harnesses. */
  probe() {
    return {
      station: this.stations[Math.round(this.progress)]?.name,
      progress: +this.progress.toFixed(3),
      azimuth: +this.azimuth.toFixed(3),
      /* Total turn taken by drag, in degrees. The 360-degree acceptance
       * test reads this. */
      turnedDeg: +((this.dragAz / TAU) * 360).toFixed(1),
      elevation: +this.elevation.toFixed(3),
      radius: +this.radius.toFixed(2),
      fov: +this.fov.toFixed(2),
      eye: [+this.cam.position.x.toFixed(2), +this.cam.position.y.toFixed(2),
            +this.cam.position.z.toFixed(2)],
    };
  }
}
