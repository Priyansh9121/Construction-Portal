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
import CRANE from "./craneGeometry.json";
import SCAFFOLD from "./scaffoldGeometry.json";
import HOIST from "./hoistGeometry.json";
import { createSky } from "./sky";
import { buildMaterialLibrary } from "./textures";
import { bevelBox, CHAMFER, bucketBySize } from "./geometry";
import { loadAssets, placeAsset, assetCost } from "./assets";
import { createDust } from "./dust";
import { CameraRig } from "./camera";
import { worldEnvironment } from "./environment";
import {
  SITE_LAYERS, SITE_JOURNEY, checkSiteScale, loadSurfaceMaps,
} from "./loginSite";

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

/*
 * Renderers that report themselves as software rasterisers.
 *
 * A software-backed WebGL context works, and it runs this scene at about 6fps
 * at 1440. Measured on the same machine: filling five form fields took 5,214ms
 * under SwiftShader against 111ms on the GPU — a 47x slowdown that makes the
 * whole page feel broken, and starved a registration test badly enough to
 * exceed a 30-second budget.
 *
 * `failIfMajorPerformanceCaveat` does NOT catch this: ANGLE-over-SwiftShader
 * declares no caveat. The renderer string is the only reliable signal.
 */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|software/i;

export const CAPABLE = () => {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;

    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) {
      const name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "");
      /* A device that can only software-render gets the authored still. That
       * is the better experience, not a lesser one. */
      if (SOFTWARE.test(name)) return false;
    }
    return true;
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
/**
 * ONE WORLD WIND.
 *
 * A single environmental state that every wind-affected system reads. Without
 * it each element invents its own sine and the site stops behaving like one
 * place — which is the difference between "several things are moving" and
 * "it is breezy".
 *
 * Base direction plus slowly-varying gusts, on periods long enough that the
 * user perceives weather rather than animation.
 */
class Wind {
  constructor() {
    this.dir = Math.PI * 0.32;      // from the west-south-west
    this.speed = 0;
  }

  update(t) {
    /* Three incommensurate terms: a slow swell, a medium gust, and a fast
     * flutter. Real wind is gusty, not sinusoidal. */
    const swell = Math.sin(t / 37) * 0.5 + 0.5;
    const gust = Math.sin(t / 11.3 + 1.7) * 0.5 + 0.5;
    const flutter = Math.sin(t / 3.1) * 0.5 + 0.5;
    this.speed = 0.28 + swell * 0.42 + gust * 0.22 + flutter * 0.08;
    this.dir += Math.sin(t / 53) * 0.0006;
    this.x = Math.sin(this.dir) * this.speed;
    this.z = Math.cos(this.dir) * this.speed;
  }
}

/**
 * The crane, performing a JOB.
 *
 * Not a loop of phases: a task with a beginning and an end, driven by a state
 * machine whose transitions are decided by whether the previous action has
 * finished. That is what produces uneven timing — a real lift takes as long as
 * it takes — and why the user never sees a cycle boundary.
 *
 * The suspended load is a DAMPED PENDULUM driven by the trolley's and slew's
 * accelerations plus the world wind, integrated each frame. It is four lines
 * of physics and it is the single thing that makes the load read as mass
 * rather than as a box parented to a rail.
 */
class CraneTask {
  constructor(range, drop) {
    this.range = range;
    this.dropRange = drop;

    this.state = "rest";
    this.t = 0;
    this.hold = 6;

    /* Actuator states: where each axis is, and where it has been told to go.
     * Motion is always toward a target at a limited rate, never a lerp along a
     * fixed duration, so acceleration and braking fall out naturally. */
    this.slew = 0.35;
    this.slewTo = 0.35;
    this.trolley = range[0];
    this.trolleyTo = range[0];
    this.drop = drop[0];
    this.dropTo = drop[0];

    /* Pendulum state, in radians, about two axes. */
    this.swingX = 0;
    this.swingZ = 0;
    this.velX = 0;
    this.velZ = 0;
    this.laden = false;
  }

  static approach(cur, target, rate, dt) {
    const d = target - cur;
    const step = Math.sign(d) * Math.min(Math.abs(d), rate * dt);
    return cur + step;
  }

  arrived(a, b, eps = 0.02) {
    return Math.abs(a - b) < eps;
  }

  /** The job, as a sequence of intentions rather than a timeline. */
  advance(dt) {
    this.t += dt;
    const R = this.range;
    const D = this.dropRange;

    switch (this.state) {
      case "rest":
        if (this.t > this.hold) this.go("to-pickup");
        break;
      case "to-pickup":
        this.slewTo = 0.1;
        this.trolleyTo = R[0] + (R[1] - R[0]) * 0.16;
        if (this.arrived(this.slew, this.slewTo, 0.01) &&
            this.arrived(this.trolley, this.trolleyTo, 0.3)) this.go("lower");
        break;
      case "lower":
        this.dropTo = D[1];
        if (this.arrived(this.drop, this.dropTo, 0.2)) this.go("hook-on", 2.4);
        break;
      case "hook-on":
        /* Dwell while the load is slung. The crane is still; the load is not,
         * because it is still settling from the descent. */
        if (this.t > this.hold) { this.laden = true; this.go("lift"); }
        break;
      case "lift":
        this.dropTo = D[0] + (D[1] - D[0]) * 0.25;
        if (this.arrived(this.drop, this.dropTo, 0.3)) this.go("settle", 3.2);
        break;
      case "settle":
        /* Wait for the pendulum to calm before slewing. A real operator does
         * exactly this, and it is why cranes look slow. */
        if (this.t > this.hold && Math.abs(this.velZ) < 0.06) this.go("to-place");
        break;
      case "to-place":
        this.slewTo = 0.92;
        this.trolleyTo = R[0] + (R[1] - R[0]) * 0.82;
        if (this.arrived(this.slew, this.slewTo, 0.01) &&
            this.arrived(this.trolley, this.trolleyTo, 0.3)) this.go("place");
        break;
      case "place":
        this.dropTo = D[1] * 0.62;
        if (this.arrived(this.drop, this.dropTo, 0.25)) this.go("release", 2.0);
        break;
      case "release":
        if (this.t > this.hold) { this.laden = false; this.go("clear"); }
        break;
      case "clear":
        this.dropTo = D[0];
        if (this.arrived(this.drop, this.dropTo, 0.3)) this.go("return");
        break;
      case "return":
        this.slewTo = 0.35;
        this.trolleyTo = R[0] + (R[1] - R[0]) * 0.45;
        if (this.arrived(this.slew, this.slewTo, 0.015) &&
            this.arrived(this.trolley, this.trolleyTo, 0.4)) {
          /* Rest length varies, so the job never repeats on a fixed beat. */
          this.go("rest", 9 + (Math.sin(this.t) * 0.5 + 0.5) * 14);
        }
        break;
      default:
        this.state = "rest";
    }
  }

  go(state, hold = 5) {
    this.state = state;
    this.t = 0;
    this.hold = hold;
  }

  update(dt, wind) {
    this.advance(dt);

    const prevTrolleyV = this.trolleyV || 0;
    const prevSlewV = this.slewV || 0;

    const nt = CraneTask.approach(this.trolley, this.trolleyTo, 2.6, dt);
    const ns = CraneTask.approach(this.slew, this.slewTo, 0.055, dt);
    this.trolleyV = (nt - this.trolley) / Math.max(dt, 1e-4);
    this.slewV = (ns - this.slew) / Math.max(dt, 1e-4);
    this.trolley = nt;
    this.slew = ns;
    this.drop = CraneTask.approach(this.drop, this.dropTo, 3.4, dt);

    /* Damped pendulum. The rope length sets the natural frequency, so a long
     * drop swings slowly and a short one quickly — which is correct, and is
     * why this is integrated rather than keyframed. */
    const L = Math.max(2, this.drop);
    const w2 = 9.81 / L;
    const damping = this.laden ? 0.55 : 0.95;

    const accT = (this.trolleyV - prevTrolleyV) / Math.max(dt, 1e-4);
    const accS = (this.slewV - prevSlewV) / Math.max(dt, 1e-4);
    const windForce = this.laden ? 0.55 : 1.3;

    this.velZ += (-w2 * this.swingZ - damping * this.velZ - accT * 0.055
                  + wind.x * windForce * 0.045) * dt;
    this.velX += (-w2 * this.swingX - damping * this.velX - accS * 2.2
                  + wind.z * windForce * 0.045) * dt;
    this.swingZ += this.velZ * dt;
    this.swingX += this.velX * dt;
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
function buildSite(THREE, scene, portrait, MAT, opts = {}) {
  /*
   * MINIMAL: the authored site is doing the work, so none of the procedural
   * geometry below is built.
   *
   * The crane and hoist are skipped too. They are procedural machinery placed
   * in the OLD site's coordinates, and Concept C has no tower crane -- it is a
   * plot too tight for one, which is why it has a mast climber instead, and
   * that is already part of the authored scaffold layer. Machinery returns in
   * M5, authored and placed against this site.
   *
   * Stubs are returned in the shape the animation loop expects, so every
   * machinery update still runs and simply moves nothing.
   */
  if (opts.minimal) {
    const stub = () => new THREE.Object3D();
    const group = stub();
    scene.add(group);
    return {
      slew: stub(), trolley: stub(), cable: stub(), load: stub(),
      swing: stub(), hoist: group,
      materials: { concrete: MAT.concrete, dark: MAT.dark },
      stats: { draws: 0, tris: 0, buckets: 0 },
      swappable: new Map(),
    };
  }

  /*
   * Materials come from the PBR library, not from flat colours. Every surface
   * that the camera can approach carries albedo variation, a roughness map and
   * a normal map — the last of which is what stops a face reading as one
   * uniform value under a moving sun.
   */
  const M = {
    concrete: MAT.concrete,
    concreteCool: MAT.concreteAlt,
    steel: MAT.galv,
    plant: MAT.paint,
    /* The active pour is WET CONCRETE.
     *
     * It was emissive violet, and it read as a neon strip laid along the
     * seventh floor — the one object in the scene that announced itself as
     * graphics. Fresh concrete is darker than cured concrete, slightly blue,
     * and above all WET: the low roughness is what does the work here,
     * because a wet surface returns the sky as a broad sheen and that is
     * exactly how a fresh slab reads from across a site. */
    pour: new THREE.MeshStandardMaterial({
      color: 0x6a7078, roughness: 0.26, metalness: 0.0,
    }),
    far: new THREE.MeshStandardMaterial({
      color: PALETTE.far, roughness: 1, metalness: 0,
      emissive: 0x2c3a49, emissiveIntensity: 0.55,
    }),
    dark: MAT.dark,
    ply: MAT.ply,
  };

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const o = new THREE.Object3D();

  /*
   * Solids are drawn with BEVELLED geometry wherever the object type calls for
   * it, and with the plain unit cube where it does not.
   *
   * The bevel is baked in world units, so the instance transform carries no
   * scale — which means solids must be bucketed by exact dimension, one
   * geometry and one InstancedMesh per bucket. In practice this world collapses
   * to a handful of buckets per material (every column is identical, every
   * downstand shares a section), so the draw-call cost barely moves.
   *
   * `stats` records what that actually cost, because "add real geometry" is
   * exactly the kind of change that should be measured rather than assumed.
   */
  const stats = { draws: 0, tris: 0, buckets: 0 };

  const add = (list, material, cast = true) => {
    if (!list.length) return [];
    const chamfer = CHAMFER[list[0].k] ?? 0;
    const made = [];

    if (!chamfer) {
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
      stats.draws += 1;
      stats.tris += list.length * 12;
      return [m];
    }

    for (const bucket of bucketBySize(list)) {
      const geom = bevelBox(THREE, bucket.size[0], bucket.size[1], bucket.size[2], chamfer);
      const m = new THREE.InstancedMesh(geom, material, bucket.items.length);
      bucket.items.forEach((b, i) => {
        o.position.set(b.p[0], b.p[1], b.p[2]);
        o.scale.set(1, 1, 1);
        o.quaternion.identity();
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.castShadow = cast && !portrait;
      m.receiveShadow = !portrait;
      scene.add(m);
      made.push(m);
      stats.draws += 1;
      stats.buckets += 1;
      stats.tris += bucket.items.length * 44;
    }
    return made;
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

  /* Perimeter downstands: the horizontal band and shadow line that give each
   * floor visible depth. A flat plate has neither. */
  add(F.beams, M.concreteCool);

  /* The construction zone. Falsework, deck formwork, starter bars and edge
   * protection — the things that say this frame is being worked on rather than
   * finished and empty. All instanced; the props alone are ~500 members in one
   * draw call. */
  add(F.props, MAT.galv, false);
  add(F.forms, MAT.ply);
  add(F.rebar, MAT.galv, false);
  add(F.edge, MAT.galv, false);
  /* Distant massing is where a phone saves its budget: it is atmosphere, and
   * atmosphere survives having half of it removed. */
  add(portrait ? SITE.massing.filter((_, i) => i % 2 === 0) : SITE.massing, M.far, false);
  /* Site clusters, by material rather than by heap: hoarding and cabins in
   * painted panel, timber stacks in plywood, everything else in steel. */
  const worksOf = (...kinds) => SITE.works.filter((w) => kinds.includes(w.k));
  add(worksOf("gate", "sign", "barrier", "hoard"), M.dark);
  add(worksOf("ply", "pallet"), MAT.ply);
  add(worksOf("rebar-stack"), MAT.galv);

  /*
   * UPGRADEABLE OBJECTS.
   *
   * These kinds have an authored GLB counterpart. They are still built here as
   * procedural solids, so the world is complete the moment it is constructed
   * and stays complete if the network never delivers the assets. `swappable`
   * hands the loader the meshes to remove and the ground placements to build
   * from, and nothing happens until a GLB has actually decoded.
   *
   * `p` is a box CENTRE, so the ground contact is the centre less half the
   * height — the authored assets have their origin on the ground precisely so
   * that this conversion happens once, here.
   */
  const swappable = new Map();
  /*
   * `anchor` is the kind that defines WHERE the asset stands; `also` are the
   * other procedural kinds the authored asset subsumes. A light tower is a
   * mast plus a lamp head — two boxes, one object — so its placement comes
   * from the mast alone while the swap removes both.
   */
  const upgradeable = (asset, anchor, material, also = []) => {
    const list = worksOf(anchor);
    if (!list.length) return;
    const meshes = add(list, material);
    for (const kind of also) meshes.push(...add(worksOf(kind), material));
    swappable.set(asset, {
      meshes,
      placements: list.map((b) => ({ p: [b.p[0], b.p[1] - b.s[1] / 2, b.p[2]] })),
    });
  };
  upgradeable("cabin", "cabin", M.dark);
  upgradeable("light-tower", "mast", MAT.galv, ["lamp"]);
  add(worksOf("plant"), MAT.galv);

  /*
   * HUMAN SCALE.
   *
   * Three figures, five boxes each. Not population — scale: a 3.6 m storey
   * means nothing to the eye until something of known size stands beside it,
   * and a site with nobody on it reads as abandoned. Hi-vis and a hard hat are
   * all that need to register at these distances, and building them from boxes
   * avoids the uncanny result of a poor animated character.
   */
  const hiviz = new THREE.MeshStandardMaterial({
    color: 0xd8e83a, roughness: 0.72, metalness: 0,
    emissive: 0x3a4208, emissiveIntensity: 0.35,
  });
  const workwear = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a6a52, roughness: 0.85 });
  const hat = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.55 });
  const PEOPLE = { hiviz, "hiviz-dark": workwear, skin, hat };
  const peopleBoxes = [];
  Object.entries(PEOPLE).forEach(([kind, material]) => {
    peopleBoxes.push(...add((SITE.workers || []).filter((w) => w.k === kind), material));
  });
  /* The authored figure replaces all five boxes of all three people at once.
   * Anchors carry a yaw, so the same mesh reads as three different people. */
  if (SITE.workerAt?.length) {
    swappable.set("worker", { meshes: peopleBoxes, placements: SITE.workerAt });
  }
  /*
   * The scaffold is HERO geometry: it stands closer to the lens than the
   * building it serves, so it is the most closely inspected object in the
   * shot. 512 members to real tube-and-fitting dimensions — standards on base
   * plates and sole boards, ledgers at every lift, transoms at every standard,
   * boarded working platforms with guard rails, mid rails and toe boards,
   * facade bracing in a zig-zag and ledger bracing across the width, and ties
   * back to the frame.
   *
   * Three draw calls: tube, plate, board. The rotated members need per-member
   * quaternions, so this uses the same transform path as the crane lattice.
   */
  const scaffoldOf = (kind) => SCAFFOLD.members.filter((m) => m.k === kind);
  const addRotated = (list, material, cast = true) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(unit, material, list.length);
    const e = new THREE.Euler();
    list.forEach((b, i) => {
      o.position.set(b.p[0], b.p[1], b.p[2]);
      o.scale.set(b.s[0], b.s[1], b.s[2]);
      if (b.r) {
        e.set(b.r[0], b.r[1], b.r[2], "YXZ");
        o.quaternion.setFromEuler(e);
      } else {
        o.quaternion.identity();
      }
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.castShadow = cast && !portrait;
    mesh.receiveShadow = !portrait;
    scene.add(mesh);
  };

  /*
   * The scaffold ships on MOBILE TOO.
   *
   * It was excluded as a cost saving, back when it was four rectangles. It is
   * now the best object in the shot and the one that proves depth at any
   * viewport, so the phone keeps it and saves elsewhere: fewer background
   * blocks, no shadows, half the pixel ratio.
   */
  addRotated(scaffoldOf("tube"), MAT.galv);
  addRotated(scaffoldOf("plate"), MAT.galv, false);
  addRotated(scaffoldOf("board"), MAT.ply);

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
    new THREE.PlaneGeometry(SITE.ground, SITE.ground, portrait ? 48 : 96, portrait ? 48 : 96),
    MAT.ground
  );
  /*
   * GRADED, NOT FLAT.
   *
   * A perfectly flat plane is the single most reliable signal that a scene is
   * rendered rather than photographed: real ground has fall, and fall is what
   * makes the sun's grazing light break into long soft bands instead of one
   * uniform value. Two octaves at long wavelengths are enough — this is
   * compacted site earth, not terrain, and anything more reads as a landscape.
   *
   * The working area is held FLAT. Every placed object stands at y = 0, and a
   * cabin half-buried in a hummock is a worse defect than a flat plane. The
   * mask is a smooth ramp from 45 m (every placed object is inside that) to
   * 100 m, so
   * there is no crease where it lets go.
   */
  {
    const pos = ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);           /* plane is authored in XY, rotated below */
      const r = Math.hypot(x, y);
      const mask = Math.min(1, Math.max(0, (r - 45) / 55));
      const fall =
        Math.sin(x * 0.021 + 1.3) * Math.cos(y * 0.017 - 0.4) * 0.85 +
        Math.sin(x * 0.058 - 2.1) * Math.cos(y * 0.049 + 1.1) * 0.28;
      pos.setZ(i, fall * mask * mask);
    }
    pos.needsUpdate = true;
    ground.geometry.computeVertexNormals();
  }
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = !portrait;
  scene.add(ground);

  /* The poured slab the frame stands on, as a SLAB rather than a decal.
   *
   * It was a plane at y = 0.03, and a plane has no edge — so the lighter
   * rectangle ended in a razor line and the building read as standing on a
   * floating platform. 180 mm of thickness gives the edge a face for the sun
   * to catch, which is what says "poured" rather than "painted". */
  const g = SITE.frame.grid;
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(g.bays_x * g.bay + 14, 0.18, g.bays_z * g.bay + 14),
    MAT.pad
  );
  pad.position.set(0, 0.06, 0);
  pad.receiveShadow = !portrait;
  scene.add(pad);

  /* The crane's foundation. A tower crane transfers its whole overturning
   * moment into a mass-concrete base; without one the mast grows out of bare
   * soil, which is the same class of error the hoist's missing mast was. */
  const craneBase = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.7, 7.4), MAT.pad
  );
  craneBase.position.set(SITE.crane.base[0], 0.3, SITE.crane.base[2]);
  craneBase.receiveShadow = !portrait;
  craneBase.castShadow = !portrait;
  scene.add(craneBase);

  /* Haul road: compacted, darker, running across the site's near edge. */
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE.ground * 0.7, 11),
    new THREE.MeshStandardMaterial({
      color: 0x4a4136, roughness: 1,
      map: MAT.ground.map, normalMap: MAT.ground.normalMap,
    })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, g.oz + 34);
  road.receiveShadow = !portrait;
  scene.add(road);

  /* ---- The crane: real lattice steelwork ---------------------------------
   *
   * 374 members from generate_crane.py — four chords, ties at every section,
   * K-bracing on all four faces, a tapering flat-top jib. Drawn as one
   * InstancedMesh per section, so the whole machine is four draw calls.
   *
   * The previous crane was four boxes. A solid rectangular mast reads as a
   * model OF a crane; the lattice is most of what the eye uses to identify one,
   * and it was the single strongest reason the scene looked cheap.
   */
  const C = SITE.crane;
  const rigRoot = new THREE.Group();
  rigRoot.position.set(C.base[0], 0, C.base[2]);

  /* Real steel: rough, properly metallic, and dark enough that the highlight
   * does the work rather than the base colour. */
  const painted = MAT.paint;
  const galv = MAT.galv;

  const memberGeom = new THREE.BoxGeometry(1, 1, 1);
  const euler = new THREE.Euler();
  const addMembers = (list, material, parent) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(memberGeom, material, list.length);
    list.forEach((b, i) => {
      o.position.set(b.p[0], b.p[1], b.p[2]);
      o.scale.set(b.s[0], b.s[1], b.s[2]);
      if (b.r) {
        euler.set(b.r[0], b.r[1], b.r[2], "YXZ");
        o.quaternion.setFromEuler(euler);
      } else {
        o.quaternion.identity();
      }
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.castShadow = !portrait;
    m.receiveShadow = !portrait;
    parent.add(m);
  };

  addMembers(CRANE.mast, painted, rigRoot);

  const slew = new THREE.Group();
  rigRoot.add(slew);
  addMembers(CRANE.jib, painted, slew);
  addMembers(CRANE.back, painted, slew);

  const BODY = { deck: galv, cab: galv, cwt: M.dark, pad: M.concreteCool };
  CRANE.bodies.forEach((b) => {
    /* Counterweight, machinery deck and cab are fabricated steel: their edges
     * are formed, not cast, so they take a larger chamfer than the concrete
     * and are built as individual meshes since each is a different size. */
    const chamfer = CHAMFER[b.k] ?? 0.04;
    const mesh = new THREE.Mesh(
      bevelBox(THREE, b.s[0], b.s[1], b.s[2], chamfer),
      BODY[b.k] || galv
    );
    mesh.position.set(b.p[0], b.p[1], b.p[2]);
    mesh.castShadow = !portrait;
    mesh.receiveShadow = !portrait;
    (b.k === "pad" ? rigRoot : slew).add(mesh);
    stats.draws += 1;
  });

  const trolley = new THREE.Group();
  trolley.position.y = CRANE.trolley.y;
  slew.add(trolley);
  const tb = CRANE.trolley.body;
  trolley.add(new THREE.Mesh(new THREE.BoxGeometry(tb[0], tb[1], tb[2]), galv));

  const swing = new THREE.Group();
  trolley.add(swing);
  /* Two falls of rope, not one rod: a hook block hangs on a reeved cable. */
  const cable = new THREE.Group();
  const ropeGeom = new THREE.CylinderGeometry(0.035, 0.035, 1, 5);
  const ropeA = new THREE.Mesh(ropeGeom, galv);
  const ropeB = new THREE.Mesh(ropeGeom, galv);
  ropeA.position.x = -0.16;
  ropeB.position.x = 0.16;
  cable.add(ropeA, ropeB);
  swing.add(cable);

  const hb = CRANE.hook.block;
  const load = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(hb[0], hb[1], hb[2]), galv);
  load.add(block);
  /* A slung load: a banded pallet of material, not a floating cube. */
  const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.5), M.dark);
  pallet.position.y = -1.25;
  pallet.castShadow = !portrait;
  load.add(pallet);
  swing.add(load);
  scene.add(rigRoot);

  /*
   * THE HOIST.
   *
   * Previously one orange box positioned against the facade — and the box was
   * the lesser problem. It had NO MAST. A rack-and-pinion hoist climbs a tied
   * lattice mast, so a car floating on a facade with nothing to climb does not
   * read as a coarse detail, it reads as a mistake.
   *
   * The split follows the same rule as everywhere else: the mast is repeated
   * lattice and is generated, the car is one fabricated product and is
   * authored. The ties, base enclosure and per-floor landing gates are what
   * make the car's stops mean something — it arrives AT A LANDING rather than
   * at an altitude.
   */
  addRotated(HOIST.mast.filter((m) => m.k === "steel"), MAT.galv, false);
  addRotated(HOIST.mast.filter((m) => m.k === "rack"), M.dark, false);
  addRotated(HOIST.ties, MAT.galv, false);
  addRotated(HOIST.base.filter((m) => m.k === "cage"), MAT.galv, false);
  addRotated(HOIST.base.filter((m) => m.k === "pad"), M.concrete);
  addRotated(HOIST.landings.filter((m) => m.k === "gate"), MAT.galv, false);
  addRotated(HOIST.landings.filter((m) => m.k === "deck"), MAT.ply);

  /* The car is a GROUP, not a mesh, so the authored GLB can replace its
   * contents without the animation code knowing anything changed. Its y is
   * driven by the hoist state machine; x and z come from the generator, which
   * is also what guarantees the car sits on its own mast. */
  const hoist = new THREE.Group();
  const carBox = new THREE.Mesh(
    new THREE.BoxGeometry(HOIST.car.size[0], HOIST.car.size[1], HOIST.car.size[2]),
    M.plant,
  );
  /* The authored car's origin is its ground contact; the stand-in box's is its
   * centre, so it is lifted by half its height to agree with it. */
  carBox.position.y = HOIST.car.size[1] / 2;
  carBox.castShadow = !portrait;
  hoist.add(carBox);
  hoist.position.set(HOIST.car.at[0], HOIST.car.travel[0], HOIST.car.at[2]);
  scene.add(hoist);
  swappable.set("hoist", { meshes: [], group: hoist, stand: carBox });

  return { slew, trolley, cable, load, swing, hoist, materials: M, stats, swappable };
}

/**
 * Give one imported glTF material its real surface.
 *
 * Matched by NAME, which is why the production export preserves the concept's
 * material slots exactly. A slot with no entry keeps its factors: metals and
 * glass are defined by how they reflect the environment, not by an albedo map,
 * and painting diffuse detail onto them would flatten the very response that
 * makes them read as metal.
 */
function dressSurface(THREE, material, surfaces) {
  const slot = String(material.name || "").split(".")[0];
  const surface = surfaces.get(slot);
  if (!surface) return material;

  material.map = surface.map;
  material.roughnessMap = surface.roughnessMap;
  material.normalMap = surface.normalMap;
  /* Shallow. A strong normal on concrete reads as rock, and this is micro
   * relief -- aggregate and formwork grain, not geology. */
  material.normalScale = new THREE.Vector2(0.6, 0.6);
  /* The albedo map already carries the colour, so the factor must go white or
   * it multiplies the texture down and the surface reads muddy. */
  material.color.setRGB(1, 1, 1);
  material.roughness = 1;
  material.metalness = material.metalness > 0.5 ? material.metalness : 0;
  /*
   * NO TRIPLANAR. The GLB now carries UVs cube-projected at the material's
   * real world tile, so this is ordinary glTF PBR -- one texture fetch per
   * map instead of three, and the world scale is decided once at authoring
   * time rather than being re-guessed here.
   */
  material.needsUpdate = true;
  return material;
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

  /*
   * THE MOON IS NOT A SECOND SUN.
   *
   * Moonlight is about 400,000x weaker than sunlight, so this exists to give
   * night a DIRECTION and a cool cast, not to illuminate the site. Its
   * intensity is the illuminated fraction times how far the sun is below the
   * horizon, which means a new moon contributes exactly nothing -- and that
   * is why some nights here are genuinely dark and others are not.
   */
  const moon = new THREE.DirectionalLight(0xb9c9e8, 0);
  moon.castShadow = false;
  scene.add(moon);

  /* Sky above, site below. Two colours, because the ground of a construction
   * site is not the colour of its sky. */
  const hemi = new THREE.HemisphereLight(preset.fill, preset.bounce ?? 0x1a1712, preset.fillI);
  scene.add(hemi);

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
    /* `warmBase` is the lamp's full output; `base` is what it is currently
     * set to. Keeping both means the environment can rescale by time of day
     * without the value decaying toward zero on every update. */
    const warmBase = l.warm ? 300 : 190;
    return { light: s, warmBase, base: warmBase * preset.work };
  });

  return { key, moon, hemi, lamps };
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

  /*
   * THE WORLD RUNS ON THE REAL CLOCK.
   *
   * `opts.at` lets a harness drive the world to a chosen instant — a night
   * scene has to be verifiable without waiting until night — but the default
   * is now, in Asia/Kolkata, the same timezone the product's business logic
   * uses to decide what "today" means.
   */
  let env = worldEnvironment(opts.at ? new Date(opts.at) : new Date());
  const preset = env.grade;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !portrait,
    powerPreference: "high-performance",
    /*
     * REFUSE a software-rendered context.
     *
     * When the GPU is unavailable the browser will happily give back a WebGL
     * context backed by a software rasteriser. It works, and it runs this
     * scene at about 6fps at 1440 — measured. That is worse than no world at
     * all, and it starved the auth routes badly enough to time a registration
     * test out under parallel workers.
     *
     * Refusing the context means `createAuthWorld` throws, the caller keeps
     * its authored SVG still, and the form is untouched. A weak device gets
     * the composed scene rather than a stuttering one.
     */
    failIfMajorPerformanceCaveat: true,
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

  const sky = createSky(THREE, scene, env.grade, env.sun.dir);

  /*
   * ENVIRONMENT LIGHTING FROM THE SKY ITSELF.
   *
   * Until now every material was lit by one directional light and a flat
   * two-colour hemisphere. That is why steel had nothing to reflect and why
   * concrete in shadow was a single dead value: there was no environment, only
   * lamps.
   *
   * PMREMGenerator renders the procedural sky dome into a prefiltered
   * mipmapped radiance map, which three then uses as the indirect term for
   * every MeshStandardMaterial in the scene. The sky the user can see becomes
   * the sky the surfaces are lit by — so shadowed concrete picks up the
   * horizon's warmth, galvanised tube picks up a real specular gradient, and
   * the crane's paint gets a highlight that moves with the sun.
   *
   * Cost: one render of twelve triangles into a 256px cube, once. It is
   * regenerated only when the sun has moved far enough to matter, not per
   * frame.
   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const skyOnly = new THREE.Scene();
  const envDome = sky.dome.clone();
  envDome.material = sky.material;
  skyOnly.add(envDome);

  let envRT = null;
  const bakeEnvironment = () => {
    const next = pmrem.fromScene(skyOnly, 0.04);
    /* Dispose AFTER the swap: releasing the live target first leaves every
     * material referencing a destroyed texture for a frame. */
    const previous = envRT;
    envRT = next;
    scene.environment = next.texture;
    previous?.dispose();
  };
  bakeEnvironment();

  /*
   * THE PRESENTATION BRIDGE.
   *
   * The world publishes its lighting state as CSS custom properties on the
   * document root, so the DOM form can be lit by the same sun as the concrete
   * behind it. Written imperatively at a low rate — the values change over
   * minutes, not frames — so React never re-renders for this and the style
   * recalculation is one element's inline properties.
   *
   * Presentation only. No business state crosses this bridge in either
   * direction.
   */
  const hex = (c) => `#${c.getHexString()}`;
  /*
   * CSS VARIABLES GO ON THE SCENE, NOT ON THE DOCUMENT.
   *
   * Every consumer of `--auth-world-*` lives in styles/system/auth/scene.css,
   * inside `.auth-scene`. Publishing them on documentElement invalidated
   * inherited custom properties for the WHOLE DOCUMENT, and the next
   * style-dependent read in the pointer path then paid for a full recalc.
   * Measured: a 184 ms long task and a 483 ms worst frame while crossing the
   * form boundary. Scoping the write to the subtree that reads it is the fix.
   */
  const root = canvas.closest(".auth-scene") || document.documentElement;
  /* Last published values, so an unchanged colour never re-invalidates style.
   * The sun moves over minutes; most publishes write identical strings. */
  const published = new Map();
  const put = (name, value) => {
    if (published.get(name) === value) return;
    published.set(name, value);
    root.style.setProperty(name, value);
  };
  /* Reused, so publishing does not allocate two Colors every time. */
  const scratch = new THREE.Color();
  const publishLight = () => {
    const s = sky.material.uniforms;
    put("--auth-world-key", `#${scratch.setHex(preset.key).getHexString()}`);
    put("--auth-world-fill", `#${scratch.setHex(preset.fill).getHexString()}`);
    put("--auth-world-horizon", hex(s.uHorizon.value));
    put("--auth-world-zenith", hex(s.uZenith.value));
    put("--auth-world-sun", hex(s.uSunTint.value));
    /* Which side of the form the sun is on, as a signed number the CSS can
     * use to place the warm edge without knowing any geometry. */
    put("--auth-world-sun-x", s.uSun.value.x.toFixed(3));

    /*
     * HOW BRIGHT THE WORLD CURRENTLY IS, 0..1.
     *
     * The veil that guarantees the form's contrast was tuned against a world
     * that was permanently at dusk. The moment the sky became real, a 3 pm
     * capture put pale sunlit ground behind the supporting copy and the body
     * text stopped being readable — a genuine accessibility regression
     * introduced by a lighting change, which is exactly the kind of coupling
     * a fixed veil cannot survive.
     *
     * Publishing the scene's luminance lets the veil answer the sky instead
     * of assuming it. Derived from the sun's altitude rather than sampled
     * pixels: it is the cause, it is free, and it cannot flicker.
     */
    const luma = Math.min(1, Math.max(0, (env.sun.altitude + 6) / 26));
    put("--auth-world-luma", luma.toFixed(3));
  };
  publishLight();
  const MAT = buildMaterialLibrary(THREE);
  /*
   * THE SITE IS AUTHORED, NOT GENERATED.
   *
   * `buildSite()` assembles the old procedural world from boxes. Three concept
   * rounds established that box assembly is what made this read as BIM, so the
   * architecture now arrives as GLB from tools/blender/concept_c.py.
   *
   * The old path stays reachable behind `opts.procedural` purely so a visual
   * regression can be bisected against it — not as a second permanent
   * representation of the same site.
   */
  const useProcedural = opts.procedural === true;
  const rigParts = buildSite(THREE, scene, portrait, MAT, { minimal: !useProcedural });
  const lights = buildLights(THREE, scene, portrait, preset, sky.sun);
  /* Travel ranges come from the crane ASSET, so the trolley can never run off
   * the end of a jib whose length the generator changed. */
  const wind = new Wind();
  /*
   * Suspended dust, on the world wind.
   *
   * Kept deliberately sparse, and halved on a phone where the same count would
   * cover proportionally more of a smaller screen. Under reduced motion the
   * field is still built and still drawn — it is atmosphere, and removing it
   * would leave a thinner scene rather than a calmer one — but it does not
   * move.
   */
  const dust = createDust(THREE, scene, {
    count: portrait ? 210 : 420,
    tint: preset.work,
  });
  if (reduced) dust.freeze();
  const task = new CraneTask(CRANE.trolley.range, CRANE.hook.drop);

  /* The hoist stops AT landings, dwells, and departs later — it does not
   * shuttle. Levels are the frame's own storeys, so it can only ever stop
   * where a floor exists. */
  const storey = SITE.frame.grid.storey;
  const topFloor = SITE.frame.grid.storeys - 1;
  const hoistState = { y: storey, to: storey * 4, wait: 0, floor: 4 };
  /*
   * The journey is authored in metres by the generator, so the camera stands
   * in places on the site rather than at coordinates that happened to frame
   * the model. Portrait uses the same journey: the stations are positions in a
   * world, and a phone is standing in the same world — what changes for
   * portrait is the focal length, handled per-station below.
   */
  const rig = new CameraRig(THREE, cam, useProcedural ? SITE.journey : SITE_JOURNEY, { portrait });
  if (portrait) {
    /* A 390 px-wide viewport crops a horizontal frame hard. Widening each
     * station keeps the same SUBJECT in shot rather than a slice of it. */
    for (const st of rig.stations) st.fov = Math.min(72, st.fov * 1.28);
  }

  let raf = 0;
  let alive = true;
  let started = performance.now();
  let paused = false;

  /*
   * AUTHORED ASSETS ARRIVE LATE, OR NOT AT ALL.
   *
   * The site above is already complete and already on screen. This replaces
   * the procedural stand-ins for objects that have an authored counterpart —
   * a cabin is a manufactured shell, not a chamfered box, and no amount of
   * generation gets there.
   *
   * Deliberately fire-and-forget. Nothing awaits it, no frame is held for it,
   * and `loadAssets` never rejects: if the GLBs are missing the boxes simply
   * stay. The form has never had any relationship with this module either way.
   */
  /*
   * Push the current environment into every system that depends on it: the
   * sky shader, the key light's direction and colour, the moon, the sky
   * bounce, the fog, the exposure and the work lamps.
   *
   * One function, so those can never disagree about what time it is.
   */
  let lastEnv = 0;
  const applyEnvironment = () => {
    const g = env.grade;
    sky.applyGrade(g, env.sun.dir);

    lights.key.color.setHex(g.key);
    /* Below the horizon the sun contributes nothing. Without this the key
     * keeps lighting the site from underneath all night. */
    lights.key.intensity = env.sun.up ? g.keyI : 0;
    lights.key.position.set(...env.sun.dir).multiplyScalar(140);

    lights.moon.intensity = env.moon.intensity;
    lights.moon.position.set(...env.moon.dir).multiplyScalar(160);

    lights.hemi.color.setHex(g.fill);
    /* The lower half of a hemisphere light is BOUNCE OFF THE GROUND, and at
     * midday a sunlit site throws a great deal of warm light back up. Left at
     * a fixed near-black it crushed every shadowed facade to black the moment
     * the world first ran in real daylight. */
    lights.hemi.groundColor.setHex(g.bounce);
    lights.hemi.intensity = g.fillI;

    scene.fog.color.setHex(g.fog);
    scene.fog.density = g.fogD * (portrait ? 1.25 : 1);
    renderer.toneMappingExposure = g.exposure;

    for (const l of lights.lamps) l.base = l.warmBase * g.work;
  };

  /*
   * THE AUTHORED SITE, LOADED PROGRESSIVELY.
   *
   * Layer by layer, in the order they matter, so the form is usable long
   * before the world finishes and a slow connection gets architecture before
   * it gets street furniture. Nothing here is awaited: authentication has
   * never had any relationship with this module and still does not.
   *
   * Geometry arrives already in world coordinates, so each layer is added at
   * the origin -- no placement, no scaling. Scaling an authored asset would
   * be exactly as wrong here as it was for the bevelled boxes.
   */
  /*
   * BAKED SURFACES.
   *
   * The GLB materials arrive as flat factors named after the concept's own
   * slots. `dressSurface` turns a name into a real surface: albedo, roughness
   * and normal from the Blender bake, projected TRIPLANAR in world space.
   *
   * Triplanar rather than UVs because these meshes have none worth using --
   * a 34 m party wall and a 600 mm column joined into one mesh cannot share a
   * sane unwrap, and stretching is one of the failure modes this milestone is
   * judged on. Sampling three times by world position and blending on the
   * normal makes scale a property of the WORLD, not of the mesh.
   */
  const surfaces = loadSurfaceMaps(THREE);

  const siteAbort = new AbortController();
  if (!useProcedural) {
    const wanted = SITE_LAYERS.filter((l) => (portrait ? l.mobile : true));
    loadAssets(THREE, wanted.map((l) => l.name), { signal: siteAbort.signal })
      .then((loaded) => {
        if (!alive) return;
        let tris = 0;
        for (const layer of wanted) {
          const prims = loaded.get(layer.name);
          if (!prims) continue;
          for (const { geometry, material } of prims) {
            dressSurface(THREE, material, surfaces);
            const mesh = new THREE.Mesh(geometry, material);
            /* Everything here is static architecture: it both casts and
             * receives, which is what puts the window reveals into shadow and
             * the scaffold onto the facade. */
            mesh.castShadow = !portrait;
            mesh.receiveShadow = true;
            mesh.name = layer.name;
            scene.add(mesh);
            const idx = geometry.getIndex();
            tris += (idx ? idx.count : geometry.getAttribute("position").count) / 3;
          }
        }
        rigParts.stats.site = Math.round(tris);
        canvas.__siteScale = checkSiteScale(THREE, scene);

        /*
         * PRE-WARM SHADERS ONCE THE WORLD IS COMPLETE.
         *
         * Frustum culling means a material is only compiled when something
         * using it first becomes visible. The camera is still at its opening
         * station, so the moment the pointer moves and the view swings, every
         * newly-revealed material compiles AT THAT INSTANT -- measured as a
         * single ~100 ms frame on the first pointer interaction and never
         * again afterwards.
         *
         * `compileAsync` walks the scene and compiles up front. Deliberately
         * fire-and-forget and deliberately AFTER the site has loaded: it must
         * never delay the form, and there is no point compiling a scene that
         * is still missing half its geometry.
         */
        renderer.compileAsync?.(scene, cam)
          ?.then(() => {
            /* Compiling programs is not the whole cost: a TEXTURE is uploaded
             * to the GPU the first time something using it is drawn. The
             * camera opens on one station, so half the site's maps upload the
             * instant the pointer first swings the view. `initTexture` forces
             * them up front, spread across the load rather than concentrated
             * in the user's first interaction. */
            scene.traverse((o) => {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              for (const m of mats) {
                if (!m) continue;
                for (const slot of ["map", "roughnessMap", "normalMap",
                                    "metalnessMap", "aoMap", "emissiveMap"]) {
                  if (m[slot]) renderer.initTexture?.(m[slot]);
                }
              }
            });
          })
          ?.catch((err) => console.warn("[world] pre-warm skipped", err));
      })
      .catch((err) => console.warn("[world] authored site unavailable", err));
  }

  const assetAbort = new AbortController();

  loadAssets(THREE, [...rigParts.swappable.keys()], { signal: assetAbort.signal })
    .then((assets) => {
      if (!alive) return;
      for (const [name, prims] of assets) {
        const slot = rigParts.swappable.get(name);
        if (!slot) continue;

        if (slot.group) {
          /* A MOVING object: the authored meshes go inside the group the
           * animation already drives, so nothing about the motion changes. */
          for (const { geometry, material } of prims) {
            dressSurface(THREE, material, surfaces);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = !portrait;
            mesh.receiveShadow = !portrait;
            slot.group.add(mesh);
          }
          slot.group.remove(slot.stand);
          slot.stand.geometry.dispose();
        } else {
          placeAsset(THREE, scene, prims, slot.placements, {
            cast: !portrait, receive: !portrait,
          });
          for (const mesh of slot.meshes) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.dispose?.();
          }
          slot.meshes = [];
        }
        const cost = assetCost(prims, slot.placements?.length ?? 1);
        rigParts.stats.authored = (rigParts.stats.authored || 0) + cost.tris;
      }

      /*
       * Under reduced motion the world draws ONE frame and then stops asking
       * for more. The assets arrive after that frame, so without this the
       * swap happened correctly and was simply never rendered — the still
       * showed procedural boxes for the cabins and light tower while the
       * animated view showed the authored assets.
       *
       * Reduced motion means no CONTINUOUS animation. It does not mean the
       * canvas may never be redrawn when its contents change.
       */
      if (reduced) renderer.render(scene, cam);
    })
    .catch((err) => console.warn("[world] asset upgrade skipped", err));

  /*
   * Enter the site rather than cutting to a composition: the camera starts at
   * the entrance and walks in to the hoarding station.
   *
   * NOT further. Station 2 (the scaffold, 19 m out) is the most striking frame
   * in the journey and the wrong ESTABLISHING one -- at that distance there is
   * no sky, no crane and no building, only an abstract lattice, and the
   * supporting copy became unreadable against it. The default has to say
   * "this is a construction site" before it says anything else; the dramatic
   * frames are one wheel-notch away.
   */
  /*
   * Station 0 IS the composition. The old entry eased to 0.28, which in the
   * generated journey was a gentle push toward a similar station -- in the
   * authored journey station 1 is 11 m closer, so the same number landed the
   * default inside the scaffold instead of on the far footpath.
   *
   * The entry is now a PULL-BACK: it starts part-way in and settles out to the
   * street view, which reveals the site rather than diving into it.
   */
  rig.progress = reduced ? 0 : 0.45;
  rig.progressTo = 0;
  /* A slow azimuth settle on entry, damped by the rig's own drag channel. The
   * site arrives as if the viewer has just turned to face it, rather than
   * cutting to a composed frame. */
  if (!reduced) { rig.dragAz = 0.20; rig.dragAzTo = 0; }
  if (reduced) {
    /* The composed still: the load slung mid-lift, the hoist at a landing. */
    task.trolley = CRANE.trolley.range[0] +
      (CRANE.trolley.range[1] - CRANE.trolley.range[0]) * 0.62;
    task.drop = CRANE.hook.drop[0] + (CRANE.hook.drop[1] - CRANE.hook.drop[0]) * 0.4;
    task.slew = 0.55;
    rigParts.slew.rotation.y = 0.15 + task.slew * 0.85;
    rigParts.trolley.position.x = task.trolley;
    rigParts.cable.scale.y = task.drop;
    rigParts.cable.position.y = -task.drop / 2;
    rigParts.load.position.y = -task.drop;
    rigParts.swing.rotation.z = 0.03;
    rigParts.hoist.position.y = storey * 4;
  }

  /*
   * Whether the pointer is over the form's controls.
   *
   * Maintained by enter/leave on the card, so a pointermove reads a boolean
   * instead of walking the DOM. `pointerover`/`pointerout` bubble, which is
   * what makes a single pair of listeners on the card sufficient even though
   * the card contains inputs and buttons.
   */
  let overCard = false;
  const onCardEnter = () => { overCard = true; };
  const onCardLeave = (e) => {
    /* Ignore moves BETWEEN descendants of the card. */
    if (e.relatedTarget && card && card.contains(e.relatedTarget)) return;
    overCard = false;
  };

  const onPointer = (e) => {
    rig.setPointer(
      (e.clientX / window.innerWidth - 0.5) * 2,
      (e.clientY / window.innerHeight - 0.5) * 2,
      performance.now(),
    );
    if (rig.dragging) rig.drag(e.clientX, e.clientY,
                               { width: window.innerWidth, height: window.innerHeight });
    /* Region state is maintained by pointerenter/pointerleave on the card
     * itself (see below) and read here as a boolean. It used to run
     * `e.target.closest(...)` on EVERY pointermove -- a DOM traversal at
     * pointer frequency, which combined with the document-wide style
     * invalidation above to produce a 184 ms long task.
     *
     * The old selector also included `.auth-scene__content`, which is a
     * full-viewport layer -- so it matched almost everywhere and the pointer's
     * authority was being suppressed across the whole scene rather than only
     * over the controls. */
    rig.setCalm(overCard ? 0.22 : 1);
  };

  /*
   * DRAG TO ORBIT.
   *
   * Bound on the canvas, not the window, so a drag that starts on the form is
   * a text selection and a drag that starts on the world is an orbit. Pointer
   * capture keeps the gesture alive when it leaves the canvas mid-turn, which
   * matters because a full 360 will always leave it.
   */
  /*
   * WHERE THE WORLD'S GESTURES ARE BOUND.
   *
   * Not to the canvas. `.auth-scene__content` is a full-viewport layer at
   * z-index 5 carrying the form, so it sits over the canvas EVERYWHERE and
   * swallows every pointerdown and wheel before the canvas can see one.
   * Binding to the canvas produced a drag handler and a wheel handler that
   * could never fire — and the failure hid itself, because pointer DRIFT is
   * bound to the window and kept answering the mouse just enough to look like
   * the camera was working.
   *
   * So the gestures live on the scene root and are rejected by target instead:
   * anything starting inside the form, its role list, or any control or text
   * element belongs to the DOM, and everything else is the world.
   */
  const surface = canvas.closest(".auth-scene") || canvas.parentElement || canvas;
  const card = surface.querySelector?.(".auth-card") || null;
  const OWNED_BY_DOM = ".auth-card, .auth-brand-list, a, button, input, label, [role=\"button\"]";

  const onPointerDown = (e) => {
    if (reduced || e.button !== 0) return;
    if (e.target?.closest?.(OWNED_BY_DOM)) return;
    rig.beginDrag(e.clientX, e.clientY);
    surface.setPointerCapture?.(e.pointerId);
    surface.style.cursor = "grabbing";
  };
  /* Touch: no hover channel, so drag moves arrive here. */
  const onTouchDrag = (e) => {
    if (!rig.dragging) return;
    rig.drag(e.clientX, e.clientY,
             { width: window.innerWidth, height: window.innerHeight });
  };

  const onPointerUp = (e) => {
    if (!rig.dragging) return;
    rig.endDrag();
    surface.releasePointerCapture?.(e.pointerId);
    surface.style.cursor = "";
  };

  /* The wheel drives the dolly only while the pointer is over the world, and
   * only when the page itself is not the thing being scrolled. Outside the
   * canvas, wheel behaves exactly as it always did. */
  /*
   * The wheel walks the journey.
   *
   * `preventDefault` only when the gesture was actually consumed: at the ends
   * of the journey the event is released so the page can scroll and the world
   * never traps someone trying to reach what is below it.
   */
  const onWheel = (e) => {
    if (reduced) return;
    if (e.target?.closest?.(".auth-card")) return;
    if (rig.wheel(e.deltaY)) e.preventDefault();
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
  let lastPublish = 0;
  let lastBake = 0;

  let lastFrame = performance.now();

  function loop(now) {
    if (!alive || paused) return;
    /* Clamped so a backgrounded tab returning does not integrate the pendulum
     * through a two-second step and fling the load. */
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;
    elapsed = (now - started) / 1000;
    if (!reduced) {
      wind.update(elapsed);
      task.update(dt, wind);
      /* Dust drifts on the SAME wind vector as the clouds and the slung load,
       * which is what makes a gust read as weather rather than as three
       * animations that happen to be running. */
      dust?.update(dt, wind, elapsed);

      rigParts.slew.rotation.y = 0.15 + task.slew * 0.85;
      rigParts.trolley.position.x = task.trolley;
      rigParts.cable.scale.y = task.drop;
      rigParts.cable.position.y = -task.drop / 2;
      rigParts.load.position.y = -task.drop;
      rigParts.swing.rotation.z = task.swingZ;
      rigParts.swing.rotation.x = task.swingX;
      rigParts.load.visible = true;

      /* Hoist: travel, decelerate into the landing, dwell, depart. */
      if (hoistState.wait > 0) {
        hoistState.wait -= dt;
        if (hoistState.wait <= 0) {
          const next = Math.max(1, Math.min(topFloor,
            hoistState.floor + (Math.random() < 0.5 ? -3 : 3)));
          hoistState.floor = next;
          hoistState.to = storey * next;
        }
      } else {
        const d = hoistState.to - hoistState.y;
        const speed = Math.min(2.2, Math.max(0.35, Math.abs(d) * 0.55));
        hoistState.y += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
        if (Math.abs(d) < 0.05) hoistState.wait = 5 + Math.random() * 9;
      }
      rigParts.hoist.position.y = hoistState.y;

      /* A read-only probe for verification harnesses. Written on the canvas
       * rather than through React so it costs one property write and cannot
       * influence rendering. */
      canvas.__geom = { ...rigParts.stats, drawCalls: renderer.info.render.calls,
                        triangles: renderer.info.render.triangles };
      /* Camera state, so a harness can assert that a drag really produced a
       * full turn rather than trusting that it looked like one. */
      canvas.__camera = rig.probe();
      /* A handle for the performance harness to bisect against at runtime --
       * DPR, shadows and materials can be toggled without a rebuild, which is
       * the only way to get a like-for-like A/B on the same loaded scene. */
      canvas.__perf = { renderer, scene, THREE, rig, lights };
      canvas.__probe = {
        state: task.state,
        slew: +task.slew.toFixed(3),
        trolley: +task.trolley.toFixed(2),
        drop: +task.drop.toFixed(2),
        swing: +task.swingZ.toFixed(4),
        laden: task.laden,
        hoist: +hoistState.y.toFixed(2),
        wind: +wind.speed.toFixed(3),
      };
      /* The sun moves and the key light moves with it: shadows swing across
       * the concrete over minutes rather than seconds. */
      sky.advance(elapsed, wind);

      /*
       * THE WORLD FOLLOWS THE REAL CLOCK.
       *
       * Re-read the environment every two seconds rather than every frame:
       * the sun moves a quarter of a degree in that time, which is far below
       * anything visible, and it keeps three trig-heavy calls plus their
       * allocations off the frame budget.
       *
       * Nothing is snapped. The state is continuous because real time is
       * continuous, so a two-second step in a value that changes over hours
       * cannot produce a visible jump — there is no cross-fade to write.
       */
      if (elapsed - lastEnv > 2) {
        lastEnv = elapsed;
        env = worldEnvironment(opts.at ? new Date(opts.at) : new Date());
        applyEnvironment();
      }
      /* Republish at ~2 Hz: the sun moves over minutes, so a per-frame write
       * would be 60x the cost for no visible difference. */
      if (elapsed - (lastPublish || 0) > 0.5) {
        lastPublish = elapsed;
        publishLight();
      }
      /* Re-bake the environment every twelve seconds. The sun moves about a
       * degree a minute, so anything faster is spending a cube render on a
       * change nobody can see. */
      if (elapsed - lastBake > 12) {
        lastBake = elapsed;
        bakeEnvironment();
      }
      /* Lamps breathe very slightly, out of step with each other. */
      lights.lamps.forEach((l, i) => {
        l.light.intensity = l.base * (0.94 + 0.06 * Math.sin(elapsed * 0.35 + i * 1.7));
      });
    }
    rig.update(dt, now, false);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  }

  if (reduced) {
    rig.update(0.016, performance.now(), true);
    renderer.render(scene, cam);
  } else {
    raf = requestAnimationFrame(loop);
  }

  const fine = window.matchMedia("(pointer: fine)").matches;
  if (!reduced) {
    /*
     * DRAG WORKS ON TOUCH TOO.
     *
     * Hover-drift and the wheel are mouse behaviours and stay gated behind a
     * fine pointer, but orbiting is the interaction that proves this is a
     * world rather than a picture, and withholding it from phones would make
     * the mobile build a different — lesser — experience.
     *
     * `touch-action: none` on the canvas is what lets a horizontal drag orbit
     * instead of being claimed by the browser as a scroll. It is set on the
     * canvas alone, so the page still scrolls normally everywhere else.
     */
    if (card) {
      card.addEventListener("pointerover", onCardEnter);
      card.addEventListener("pointerout", onCardLeave);
    }
    surface.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    /* `pan-y`, not `none`: a vertical swipe still scrolls the page, a
     * horizontal one orbits. Blanket `none` here would trap a phone. */
    surface.style.touchAction = "pan-y";
    if (fine) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      surface.addEventListener("wheel", onWheel, { passive: false });
      surface.style.cursor = "grab";
    } else {
      /* Touch has no hover channel, so drag is the only orbit input. */
      surface.addEventListener("pointermove", onTouchDrag, { passive: true });
    }
  }
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  return {
    reduced,
    portrait,
    /**
     * Micro-spatial responses. Field focus is not a camera flight.
     *
     * Each field gets a DISTINCT response, because repeating one animation for
     * every focus teaches the user that nothing specific happened. The email
     * station settles the shot; the password station pushes fractionally
     * closer; leaving both returns to the working station.
     */
    focus(which) {
      if (reduced || !alive) return;
      /* Each field recomposes to a different place on the site. Email is the
       * approach; password moves in to the scaffold, closer and tighter. */
      if (which === "password") rig.goTo("scaffold");
      else if (which === "email") rig.goTo("hoarding");
      else rig.goTo("scaffold");
    },

    /**
     * The Sign In press, before authentication resolves.
     *
     * The world TIGHTENS: the work lamps come up and the camera holds. It does
     * not depart — nothing here anticipates success, because the request has
     * not been answered yet. `relax()` puts it back, which is what a failed
     * sign-in calls.
     */
    arm() {
      if (!alive) return;
      lights.lamps.forEach((l) => { l.light.intensity = l.base * 1.45; });
      if (!reduced) rig.goTo("lift");
    },

    relax() {
      if (!alive) return;
      lights.lamps.forEach((l) => { l.light.intensity = l.base; });
      if (!reduced) rig.goTo("scaffold");
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
      /* An auth route can unmount while a GLB is still in flight. Aborting
       * stops the loader resolving into a scene that is being torn down. */
      assetAbort.abort();
      siteAbort.abort();
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      if (card) {
        card.removeEventListener("pointerover", onCardEnter);
        card.removeEventListener("pointerout", onCardLeave);
      }
      surface.removeEventListener("pointerdown", onPointerDown);
      surface.removeEventListener("pointermove", onTouchDrag);
      surface.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose?.();
      });
      dust?.dispose();
      envRT?.dispose();
      pmrem.dispose();
      sky.dispose();
      renderer.dispose();
    },
  };
}
