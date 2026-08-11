/**
 * The authentication world: a real-time construction site.
 *
 * This module owns the WebGL side of the auth routes and nothing else. It is
 * imported lazily, so no route that does not show the world pays for three.js
 * (133 kB gzip tree-shaken).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SEPARATION
 * ─────────────────────────────────────────────────────────────────────────
 *   siteGeometry.json  world layout in METRES, from generate_site3d.py
 *   buildSite()        geometry and materials
 *   Machinery          the crane and hoist as a state machine
 *   CameraRig          stations, flights and the damped pointer offset
 *   createAuthWorld()  lifecycle: mount, resize, visibility, dispose
 *
 * The form is never in here. It is ordinary DOM with real focus, real autofill
 * and real screen-reader output, and the world sits behind it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE WORLD NEVER GATES AUTHENTICATION
 * ─────────────────────────────────────────────────────────────────────────
 * Nothing here can delay, block or fail a sign-in. If WebGL is unavailable the
 * caller keeps its authored fallback and the form behaves identically.
 */

import SITE from "./siteGeometry.json";

/* Cinematic construction palette. Materials carry identity, not just colour:
 * concrete is rough and matt, steel is smooth and metallic, plant is emissive
 * enough to hold an edge against the sky at distance. */
const PALETTE = {
  concreteWarm: 0xa9a29a,
  concreteCool: 0x8d97a3,
  steel: 0x59636e,
  plant: 0xf0932f,
  pour: 0x7d55ff,
  instrument: 0x2fc7de,
  far: 0x2a3542,
  ground: 0x14181d,
  fog: 0x0d141c,
  key: 0xcfe0f2,
  fill: 0x5b82b4,
  work: 0xffb45c,
};

export const CAPABLE = () => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
};

/**
 * Machinery as PHASES, not loops.
 *
 * A crane does not oscillate. It slews, holds while the hook works, runs the
 * trolley out, holds, lowers, holds again, raises, returns, and rests. The
 * holds are the whole difference between machinery and a metronome, and each
 * system's cycle length is deliberately coprime with the others so the site
 * never resets in unison.
 */
class Machinery {
  constructor(THREE, crane, grid) {
    this.THREE = THREE;
    this.c = crane;
    this.grid = grid;
    /* Periods chosen to share no small common factor: 47, 31, 23, 53. The
     * site's total cycle is therefore ~19 hours, which is another way of
     * saying the user will never see it repeat. */
    this.T = { slew: 47, trolley: 31, hook: 23, hoist: 53 };
  }

  /** A phase curve with holds at both ends: 0 → 1 → hold → 0 → hold. */
  static phase(t, period, out = 0.28, hold = 0.22) {
    const u = (t % period) / period;
    if (u < out) return Machinery.ease(u / out);
    if (u < out + hold) return 1;
    if (u < out * 2 + hold) return 1 - Machinery.ease((u - out - hold) / out);
    return 0;
  }

  static ease(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  }

  update(t, rig) {
    const { slew, trolley, cable, load, swing, hoist } = rig;
    const c = this.c;

    /* The slew is the slowest thing on the site and never completes a circle:
     * a crane serves an arc, it does not spin. */
    const s = Machinery.phase(t, this.T.slew, 0.34, 0.18);
    slew.rotation.y = 0.15 + s * 0.85;

    const u = Machinery.phase(t, this.T.trolley, 0.26, 0.24);
    trolley.position.x = c.trolley[0] + (c.trolley[1] - c.trolley[0]) * u;

    /* The cable pays out while the trolley is stopped. Scaling the cylinder is
     * what makes it read as cable rather than as a rod that grew. */
    const drop = c.hook_drop[0] + (c.hook_drop[1] - c.hook_drop[0]) * Machinery.phase(t, this.T.hook, 0.3, 0.2);
    cable.scale.y = drop;
    cable.position.y = -drop / 2;
    load.position.y = -drop;

    /* Sway follows the trolley's VELOCITY, not its position, so the load
     * trails when the machine accelerates and settles when it stops. That lag
     * is the only reason it reads as mass. */
    const dt = 0.016;
    const vel = (Machinery.phase(t, this.T.trolley, 0.26, 0.24) -
      Machinery.phase(t - dt, this.T.trolley, 0.26, 0.24)) / dt;
    this.sway = (this.sway || 0) * 0.94 + vel * -0.55;
    swing.rotation.z = this.sway;
    swing.rotation.x = Math.sin(t / 17) * 0.02;

    const h = Machinery.phase(t, this.T.hoist, 0.22, 0.3);
    hoist.position.y = 4 + h * (this.grid.storeys * this.grid.storey - 9);
  }

  /** The composed still: every system parked where it was designed to sit. */
  rest(rig) {
    const c = this.c;
    rig.slew.rotation.y = 0.62;
    rig.trolley.position.x = c.trolley[0] + (c.trolley[1] - c.trolley[0]) * 0.72;
    const drop = c.hook_drop[0] + (c.hook_drop[1] - c.hook_drop[0]) * 0.55;
    rig.cable.scale.y = drop;
    rig.cable.position.y = -drop / 2;
    rig.load.position.y = -drop;
    rig.swing.rotation.z = 0.02;
    rig.hoist.position.y = 4 + 0.45 * (this.grid.storeys * this.grid.storey - 9);
  }
}

/**
 * The camera rig.
 *
 * Movement is always BETWEEN NAMED STATIONS. A camera that wanders has no
 * composition; a camera that cuts has no continuity. Every flight eases from
 * wherever the camera currently is, so an interrupted move continues from its
 * real position rather than snapping back to a station it already left.
 */
class CameraRig {
  constructor(THREE, cam, stations) {
    this.THREE = THREE;
    this.cam = cam;
    this.stations = stations;
    const s = stations.approach;
    this.pos = new THREE.Vector3(...s.pos);
    this.look = new THREE.Vector3(...s.look);
    this.fov = s.fov;
    this.from = { pos: this.pos.clone(), look: this.look.clone(), fov: s.fov };
    this.to = { ...this.from };
    this.t0 = 0;
    this.dur = 1;
    this.px = 0;
    this.py = 0;
    this.tx = 0;
    this.ty = 0;
    this.onArrive = null;
  }

  fly(name, ms, now, onArrive = null) {
    const s = this.stations[name];
    if (!s) return;
    this.from = { pos: this.pos.clone(), look: this.look.clone(), fov: this.fov };
    this.to = {
      pos: new this.THREE.Vector3(...s.pos),
      look: new this.THREE.Vector3(...s.look),
      fov: s.fov,
    };
    this.t0 = now;
    this.dur = ms;
    this.onArrive = onArrive;
    this.arrived = false;
  }

  point(x, y) {
    this.tx = x;
    this.ty = y;
  }

  update(now, reduced) {
    /* Heavy: the pointer sets a target and the camera closes 4.5% of the
     * remaining distance per frame. A raw write is the novelty tilt every
     * portfolio site has. */
    this.px += (this.tx - this.px) * 0.045;
    this.py += (this.ty - this.py) * 0.045;

    const k = reduced ? 1 : Math.min(1, (now - this.t0) / this.dur);
    const e = Machinery.ease(k);
    this.pos.lerpVectors(this.from.pos, this.to.pos, e);
    this.look.lerpVectors(this.from.look, this.to.look, e);
    this.fov = this.from.fov + (this.to.fov - this.from.fov) * e;

    this.cam.position.set(
      this.pos.x - this.px * 2.2,
      this.pos.y + this.py * 1.1,
      this.pos.z
    );
    this.cam.lookAt(this.look);
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();

    if (k >= 1 && !this.arrived) {
      this.arrived = true;
      this.onArrive?.();
    }
  }
}

function buildSite(THREE, scene, portrait) {
  const mat = (color, o = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...o });

  const M = {
    concrete: mat(PALETTE.concreteWarm, { roughness: 0.94 }),
    concreteCool: mat(PALETTE.concreteCool, { roughness: 0.9 }),
    steel: mat(PALETTE.steel, { roughness: 0.55, metalness: 0.6 }),
    plant: mat(PALETTE.plant, {
      roughness: 0.4,
      metalness: 0.5,
      emissive: 0x5a2f06,
      emissiveIntensity: 0.4,
    }),
    pour: mat(PALETTE.pour, { roughness: 0.65, emissive: 0x2a1170, emissiveIntensity: 0.55 }),
    far: mat(PALETTE.far, { roughness: 1 }),
    dark: mat(0x2c343d, { roughness: 0.95 }),
  };

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const o = new THREE.Object3D();
  const add = (list, material, cast = true) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(unit, material, list.length);
    list.forEach((b, i) => {
      o.position.set(b.p[0], b.p[1], b.p[2]);
      o.scale.set(b.s[0], b.s[1], b.s[2]);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.castShadow = cast && !portrait;
    m.receiveShadow = !portrait;
    scene.add(m);
    return m;
  };

  const F = SITE.frame;
  /* Columns alternate warm and cool concrete. One material for every column
   * makes a frame read as a single extrusion; two makes it read as poured in
   * separate pours, which is what actually happened. */
  add(F.columns.filter((_, i) => i % 2 === 0), M.concrete);
  add(F.columns.filter((_, i) => i % 2 === 1), M.concreteCool);
  add(F.slabs.filter((s) => s.k === "slab"), M.concrete);
  add(F.slabs.filter((s) => s.k === "slab-pour"), M.pour, false);
  add([F.core], M.concreteCool);
  add(SITE.massing, M.far, false);
  add(SITE.works, M.dark);
  if (!portrait) {
    add(SITE.scaffold.standards, M.steel);
    add(SITE.scaffold.ledgers, M.steel, false);
    add(SITE.scaffold.boards, M.dark, false);
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE.ground, SITE.ground),
    mat(PALETTE.ground, { roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = !portrait;
  scene.add(ground);

  /* ---- The crane, as an articulated rig ---- */
  const C = SITE.crane;
  const rigRoot = new THREE.Group();
  rigRoot.position.set(C.base[0], 0, C.base[2]);
  const mast = new THREE.Mesh(
    new THREE.BoxGeometry(C.mast_w * 1.4, C.mast_h, C.mast_w * 1.4),
    M.plant
  );
  mast.position.y = C.mast_h / 2;
  mast.castShadow = !portrait;
  rigRoot.add(mast);

  const slew = new THREE.Group();
  slew.position.y = C.mast_h;
  rigRoot.add(slew);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(C.jib, 0.85, 0.85), M.plant);
  jib.position.set(C.jib / 2, 1.2, 0);
  slew.add(jib);
  const back = new THREE.Mesh(new THREE.BoxGeometry(C.back, 0.85, 0.85), M.plant);
  back.position.set(-C.back / 2, 1.2, 0);
  slew.add(back);
  const cwt = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.7, 2.2), M.dark);
  cwt.position.set(-C.back, 1.2, 0);
  slew.add(cwt);

  const trolley = new THREE.Group();
  trolley.position.y = 1.2;
  slew.add(trolley);
  trolley.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.0), M.plant));
  const swing = new THREE.Group();
  trolley.add(swing);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5), M.steel);
  swing.add(cable);
  const load = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.7), M.dark);
  load.castShadow = !portrait;
  swing.add(load);
  scene.add(rigRoot);

  const hoist = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.7, 2.1), M.plant);
  hoist.position.set(
    F.grid.ox + F.grid.bays_x * F.grid.bay + 1.4,
    4,
    F.grid.oz + 3
  );
  hoist.castShadow = !portrait;
  scene.add(hoist);

  return { slew, trolley, cable, load, swing, hoist, materials: M };
}

function buildLights(THREE, scene, portrait) {
  /* Key: cool and high, the moonlit half of a night site. */
  const key = new THREE.DirectionalLight(PALETTE.key, 2.0);
  key.position.set(-60, 95, 55);
  key.castShadow = !portrait;
  if (!portrait) {
    key.shadow.mapSize.set(1024, 1024);
    const c = key.shadow.camera;
    c.left = -75; c.right = 75; c.top = 75; c.bottom = -75; c.far = 280;
    key.shadow.bias = -0.0012;
  }
  scene.add(key);

  /* Fill from the sky, ground bounce from the site. Two colours, because the
   * ground of a construction site is not the same colour as its sky. */
  scene.add(new THREE.HemisphereLight(PALETTE.fill, 0x141a21, 1.15));

  /* A cool back light whose only job is to put an edge on the steel: a
   * silhouette is what makes machinery legible at distance, not more key. */
  const rim = new THREE.DirectionalLight(0x86b4ff, 1.4);
  rim.position.set(75, 45, -85);
  scene.add(rim);

  /* Practical work lamps, aimed at the work. Warm, low, and few. */
  const lamps = SITE.lights.map((l) => {
    const s = new THREE.SpotLight(
      l.warm ? PALETTE.work : 0x9fc4ff,
      l.warm ? 260 : 160,
      95,
      Math.PI / 7,
      0.6,
      1.6
    );
    s.position.set(...l.p);
    s.target.position.set(...l.aim);
    scene.add(s);
    scene.add(s.target);
    return { light: s, warm: l.warm };
  });

  return { key, rim, lamps };
}

/**
 * Mount the world. Returns a controller; every method is safe to call after
 * dispose, which matters because auth routes unmount under a user who is
 * mid-interaction.
 */
export async function createAuthWorld(canvas, opts = {}) {
  const THREE = await import("three");
  const portrait = opts.portrait ?? window.innerWidth < 700;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !portrait,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, portrait ? 1.5 : 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = !portrait;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.fog, portrait ? 0.0072 : 0.0052);
  scene.background = new THREE.Color(0x080c11);

  const cam = new THREE.PerspectiveCamera(
    36,
    canvas.clientWidth / canvas.clientHeight,
    0.5,
    900
  );

  const rigParts = buildSite(THREE, scene, portrait);
  buildLights(THREE, scene, portrait);
  const machinery = new Machinery(THREE, SITE.crane, SITE.frame.grid);
  const stations = portrait ? SITE.camerasPortrait : SITE.cameras;
  const rig = new CameraRig(THREE, cam, stations);

  let raf = 0;
  let alive = true;
  let started = performance.now();
  let paused = false;

  rig.fly("station", reduced ? 0 : 5400, performance.now());
  if (reduced) machinery.rest(rigParts);

  const onPointer = (e) => {
    rig.point(
      (e.clientX / window.innerWidth - 0.5) * 2,
      (e.clientY / window.innerHeight - 0.5) * 2
    );
  };

  const onResize = () => {
    if (!alive) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };

  /* A hidden tab must not burn a GPU. */
  const onVisibility = () => {
    paused = document.hidden;
    if (!paused && alive) {
      started = performance.now() - elapsed * 1000;
      loop(performance.now());
    }
  };

  let elapsed = 0;

  function loop(now) {
    if (!alive || paused) return;
    elapsed = (now - started) / 1000;
    if (!reduced) machinery.update(elapsed, rigParts);
    rig.update(now, false);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  }

  if (reduced) {
    rig.update(performance.now(), true);
    renderer.render(scene, cam);
  } else {
    raf = requestAnimationFrame(loop);
  }

  const fine = window.matchMedia("(pointer: fine)").matches;
  if (fine && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  return {
    reduced,
    portrait,
    /** Micro-spatial responses. Field focus is not a camera flight. */
    focus(which) {
      if (reduced || !alive) return;
      rig.fly(which === "password" ? "focus" : "station", 900, performance.now());
    },
    /*
     * The cinematic handover into the destination is the next phase's work.
     * It is deliberately NOT stubbed here: the camera stations it needs
     * ("through", then "operational") are generated and waiting, but wiring a
     * departure that does not yet hand over would put a flight in front of a
     * route change and make sign-in slower for no gain.
     */

    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose?.();
      });
      renderer.dispose();
    },
  };
}
