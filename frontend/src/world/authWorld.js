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
import { createSky, TIMES } from "./sky";

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
  /* Distant massing is ATMOSPHERE, not architecture. At 0x2a3542 the blocks
   * behind the sun rendered as black silhouettes — correct lighting, wrong
   * reading: they punched holes in the sky. Light enough that fog dominates
   * them at range, which is what distance actually looks like. */
  far: 0x8697a8,
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

  /* Wheel intent accumulates into a bounded dolly along the camera's own view
   * axis. Clamped, damped, and never trapping the page: the caller decides
   * whether a given wheel event belongs to the world. */
  dolly(delta) {
    this.dollyTarget = Math.max(-1, Math.min(1, (this.dollyTarget || 0) + delta * 0.0009));
  }

  update(now, reduced) {
    /* Heavy: the pointer sets a target and the camera closes 4.5% of the
     * remaining distance per frame. A raw write is the novelty tilt every
     * portfolio site has. */
    /* Heavy. The pointer sets a target and the camera closes a fixed fraction
     * of the gap each frame; a raw write is the novelty tilt every portfolio
     * site has. The orbit is large enough to explore with and clamped so the
     * structure can never be walked through. */
    this.px += (this.tx - this.px) * 0.05;
    this.py += (this.ty - this.py) * 0.05;
    this.dolly0 = (this.dolly0 || 0) + ((this.dollyTarget || 0) - (this.dolly0 || 0)) * 0.06;

    const k = reduced ? 1 : Math.min(1, (now - this.t0) / this.dur);
    const e = Machinery.ease(k);
    this.pos.lerpVectors(this.from.pos, this.to.pos, e);
    this.look.lerpVectors(this.from.look, this.to.look, e);
    this.fov = this.from.fov + (this.to.fov - this.from.fov) * e;

    /*
     * Orbit, not pan. The camera swings about the station's look-at point, so
     * moving the pointer reveals the site's other side instead of sliding the
     * whole scene sideways — and because it is an arc about a fixed centre, it
     * cannot clip into the structure it is orbiting.
     */
    const off = this.pos.clone().sub(this.look);
    const radius = off.length();
    const yaw = Math.atan2(off.x, off.z) + this.px * 0.30;
    const pitchNow = Math.asin(Math.max(-1, Math.min(1, off.y / radius)));
    const pitch = Math.max(0.06, Math.min(0.95, pitchNow + this.py * 0.16));
    const r = radius * (1 - this.dolly0 * 0.42);
    const cr = Math.cos(pitch) * r;

    this.cam.position.set(
      this.look.x + Math.sin(yaw) * cr,
      this.look.y + Math.sin(pitch) * r,
      this.look.z + Math.cos(yaw) * cr
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

/**
 * A small tileable ground break-up, drawn once into a canvas.
 *
 * Value noise at three octaves plus a few darker patches. 256px, generated at
 * runtime in about a millisecond, no asset to download and nothing to license.
 * Its only job is to stop a 520-metre plane reading as one flat colour under a
 * moving sun.
 */
function groundTexture(THREE) {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(S, S);

  let seed = 20260811;
  const rand = () => {
    seed = (1664525 * seed + 1013904223) & 0xffffffff;
    return seed / 0xffffffff;
  };
  const grid = [];
  for (let o = 0; o < 3; o += 1) {
    const n = 4 << o;
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i += 1) g[i] = rand();
    grid.push({ n, g });
  }
  const sample = ({ n, g }, x, y) => {
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
  };

  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const u = x / S;
      const v = y / S;
      let n = sample(grid[0], u, v) * 0.55 + sample(grid[1], u, v) * 0.3 +
              sample(grid[2], u, v) * 0.15;
      n = 0.62 + n * 0.5;
      const i = (y * S + x) * 4;
      img.data[i] = 255 * n * 0.86;
      img.data[i + 1] = 255 * n * 0.82;
      img.data[i + 2] = 255 * n * 0.74;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 26);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
    /* Unlit-ish: distant massing takes almost no key light, so its value comes
     * from the fog it sits in rather than from which way it faces. */
    far: mat(PALETTE.far, { roughness: 1, metalness: 0, emissive: 0x2c3a49, emissiveIntensity: 0.55 }),
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

  /*
   * The ground is where the scene stops being a model.
   *
   * A flat black plane gives the eye nothing to measure against and no surface
   * for the sun to land on. This is compacted site earth with a procedural
   * roughness break-up, a poured slab zone under the frame, and a haul road
   * running past it — generated, not textured, so it costs one small canvas
   * and no network asset.
   */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE.ground, SITE.ground, 1, 1),
    new THREE.MeshStandardMaterial({
      color: PALETTE.ground,
      roughness: 0.97,
      metalness: 0,
      map: groundTexture(THREE),
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = !portrait;
  scene.add(ground);

  /* The poured slab the frame stands on: lighter, flatter, and squarely
   * under the structure, which is what tells the eye the building has
   * foundations rather than resting on dirt. */
  const g = SITE.frame.grid;
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(g.bays_x * g.bay + 14, g.bays_z * g.bay + 14),
    new THREE.MeshStandardMaterial({ color: 0x6f6f6c, roughness: 0.92 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.03, 0);
  pad.receiveShadow = !portrait;
  scene.add(pad);

  /* Haul road: compacted, darker, running across the site's near edge. */
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE.ground * 0.7, 11),
    new THREE.MeshStandardMaterial({ color: 0x40382e, roughness: 1 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, g.oz + 34);
  road.receiveShadow = !portrait;
  scene.add(road);

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

function buildLights(THREE, scene, portrait, preset, sunDir) {
  /*
   * Every light here is DERIVED FROM THE SKY. The key sits at the sun's own
   * direction and takes its colour from the same preset the sky shader is
   * rendering, so the scene can never be lit from a direction the sky does not
   * show — which is the tell that separates a lit scene from a model with
   * lamps pointed at it.
   */
  const key = new THREE.DirectionalLight(preset.key, preset.keyI);
  key.position.copy(sunDir).multiplyScalar(140);
  key.castShadow = !portrait;
  if (!portrait) {
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = -85; c.right = 85; c.top = 85; c.bottom = -85; c.far = 320;
    key.shadow.bias = -0.0009;
    key.shadow.normalBias = 0.4;
  }
  scene.add(key);

  /* Sky above, site below. Two colours, because the ground of a construction
   * site is not the colour of its sky. */
  scene.add(new THREE.HemisphereLight(preset.fill, 0x1a1712, preset.fillI));

  /* Practical work lamps. Their intensity comes from the time of day: at noon
   * they are all but off, at dusk they are the scene. */
  const lamps = SITE.lights.map((l) => {
    const s = new THREE.SpotLight(
      l.warm ? PALETTE.work : 0xbcd6ff,
      (l.warm ? 300 : 190) * preset.work,
      110,
      Math.PI / 6.5,
      0.62,
      1.5
    );
    s.position.set(...l.p);
    s.target.position.set(...l.aim);
    scene.add(s);
    scene.add(s.target);
    return { light: s, base: (l.warm ? 300 : 190) * preset.work };
  });

  return { key, lamps };
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

  const time = opts.time || "dusk";
  const preset = TIMES[time];

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

  renderer.toneMappingExposure = 1.35;

  const scene = new THREE.Scene();
  /* Fog takes the SKY's colour, so distance dissolves into the horizon rather
   * than into an unrelated grey. */
  scene.fog = new THREE.FogExp2(preset.fog, preset.fogD * (portrait ? 1.25 : 1));

  const cam = new THREE.PerspectiveCamera(
    36,
    canvas.clientWidth / canvas.clientHeight,
    0.5,
    900
  );

  const sky = createSky(THREE, scene, time);
  const rigParts = buildSite(THREE, scene, portrait);
  const lights = buildLights(THREE, scene, portrait, preset, sky.sun);
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

  /* The wheel drives the dolly only while the pointer is over the world, and
   * only when the page itself is not the thing being scrolled. Outside the
   * canvas, wheel behaves exactly as it always did. */
  const onWheel = (e) => {
    if (reduced) return;
    e.preventDefault();
    rig.dolly(e.deltaY);
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
    if (!reduced) {
      machinery.update(elapsed, rigParts);
      /* The sun moves and the key light moves with it: shadows swing across
       * the concrete over minutes rather than seconds. */
      sky.advance(elapsed, lights.key);
      /* Lamps breathe very slightly, out of step with each other. */
      lights.lamps.forEach((l, i) => {
        l.light.intensity = l.base * (0.94 + 0.06 * Math.sin(elapsed * 0.35 + i * 1.7));
      });
    }
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
  if (fine && !reduced) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    canvas.addEventListener("wheel", onWheel, { passive: false });
  }
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
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose?.();
      });
      sky.dispose();
      renderer.dispose();
    },
  };
}
