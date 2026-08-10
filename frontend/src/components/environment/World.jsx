/**
 * File purpose:
 * The construction world the workspace sits inside, drawn as five depth planes.
 *
 * Rendered by:
 * - pages/DashboardPage.jsx, once as a fixed room and once as a band
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY FIVE PLANES AND NOT ONE DRAWING
 * ─────────────────────────────────────────────────────────────────────────
 * An elevation has no depth. It cannot parallax, cannot occlude, cannot carry
 * light across surfaces at different distances, and cannot vary — which is
 * exactly why one fixed strip reads as a watermark in a header rather than as
 * a place.
 *
 * Each plane is its own absolutely-positioned `<div>` holding its own `<svg>`,
 * sharing one viewBox so the planes register exactly.
 *
 * The division into separate ELEMENTS is a performance decision, measured.
 * Five planes drawn as `<g>` siblings inside one SVG and translated by SVG
 * transforms held 60fps at rest and fell to 52 during scroll: Chrome does not
 * promote an SVG group transform to the compositor, so every frame repainted
 * the whole drawing. Translating an HTML element instead gives each plane its
 * own layer and makes the movement a composite rather than a paint.
 *
 * The cost is four extra `<svg>` elements. The benefit is the difference
 * between a world that moves and a world that stutters.
 *
 *   0  haze      atmospheric bands, no geometry, slowest
 *   1  distant   silhouette massing, lightest ink
 *   2  frame     the structure: columns, floor beams, bracing, partial slab
 *   3  rigs      tower cranes on two independent depth planes
 *   4  near      scaffold and survey setting-out marks, heaviest ink, fastest
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE WORLD IS NEVER DATA
 * ─────────────────────────────────────────────────────────────────────────
 * Geometry comes from a seeded generator (tools/scene/generate_world.py). The
 * same seed always produces the same world, so a variant is reproducible and
 * diffable. A route may choose its own seed; nothing else may choose one.
 *
 * The world must never vary by business state. Not by project count, not by
 * money, not by progress, not by how many things are overdue. `EXPERIENCE_
 * LANGUAGE` §6: the data must never pretend, the interface may feel alive. A
 * world that grew a crane when a tender was won would be the data pretending.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A BAND IS NOT A ROOM
 * ─────────────────────────────────────────────────────────────────────────
 * Slicing a 2400x900 world into a 150px strip shows the 86 units above the
 * ground line — column bases and nothing else, measured. So a band gets a
 * CROP: the vertical range that actually contains structure, at an aspect the
 * band can hold, drawn with `meet` so the whole of it reads.
 */

import { useEffect, useState } from "react";

import { WORLDS } from "./worldGeometry";

/* The crop each surface takes of the world.
 *
 * `room` takes everything and slices, because it is as tall as the viewport.
 * `band` takes the structural range only — from above the taller crane's apex
 * down past the ground line — and fits it. `bandNarrow` crops horizontally as
 * well: at 390 a 2400-wide world reduces to threads, so the band shows a
 * SECTION of the site at legible scale rather than all of it illegibly. */
const CROP = {
  room: null,
  /* Aspect-matched to the window it is drawn in. At 1840x580 (3.17:1) inside a
   * 4.35:1 band, `meet` fits by HEIGHT and leaves ~150px of empty ground at
   * each side -- measured off a screenshot. At 4.09:1 the site fills its
   * window and the structure reads at a useful scale. */
  band: [560, 210, 1840, 450],
  /* A phone gets a PORTION of the site at real scale rather than all of it as
   * threads: the tall crane, its frame, and the ground beneath them. Reduction
   * rather than scaling -- the same decision the band's depth already makes. */
  bandNarrow: [860, 190, 620, 470],
};

function Haze({ bands, width }) {
  return (
    <g className="ui-world__haze">
      {bands.map((b, i) => (
        <rect key={i} x="0" y={b.y} width={width} height={b.h} opacity={b.o} />
      ))}
    </g>
  );
}

function Distant({ blocks, lights }) {
  return (
    <g className="ui-world__distant">
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} />
      ))}

      {/*
       * Lit floors on the distant massing. They represent NOTHING — they are
       * weather, not telemetry — which is why they are placed by geometry and
       * never by any value the product holds.
       */}
      {lights
        ? blocks
            .filter((_, i) => i % 3 === 1)
            .map((b, i) => (
              <rect
                key={`l${i}`}
                className="ui-world__lit"
                style={{ "--i": i }}
                x={b.x + b.w * 0.35}
                y={b.y + b.h * 0.28}
                width={Math.min(14, b.w * 0.2)}
                height="7"
              />
            ))
        : null}
    </g>
  );
}

/**
 * Live systems on the frame.
 *
 * `active` is the Dashboard's own count of work in flight and `alert` its
 * count of overdue work. They decide HOW MANY bays are lit and WHETHER a
 * beacon burns — never where a building is or how far along it is. This world
 * represents system activity, not project geometry, and inventing progress
 * would be the data pretending.
 */
function Live({ f, active, alert }) {
  const bayW = f.cols.length > 1 ? f.cols[1].x - f.cols[0].x : 118;
  const rows = f.beams.length;
  const lit = Math.min(active, rows * 2);

  const bays = [];
  for (let n = 0; n < lit; n += 1) {
    /* Spread by a coprime stride so consecutive counts do not light adjacent
     * cells and the pattern never reads as a bar chart. */
    const col = (n * 3) % (f.cols.length - 1);
    const row = (n * 2) % rows;
    const y = f.beams[row].y;
    const style = { "--d": `${(n % 5) * 2.3}s`, "--dur": `${12 + (n % 4) * 3}s` };
    bays.push(
      <g key={`bay${n}`}>
        <rect
          className="ui-world__bay"
          style={style}
          x={f.cols[col].x}
          y={y}
          width={bayW}
          height={f.storey}
        />
        <line
          className="ui-world__bay-edge"
          x1={f.cols[col].x}
          y1={y + f.storey}
          x2={f.cols[col].x + bayW}
          y2={y + f.storey}
        />
      </g>
    );
  }

  const rise = f.beams[0].y - f.top;

  return (
    <g>
      {bays}

      {/* The hoist runs the face of the frame on its own long rhythm. */}
      <rect
        className="ui-world__hoist"
        style={{ "--rise": rise, "--dur": "21s", "--d": "-6s" }}
        x={f.x1 + 6}
        y={f.beams[0].y - 16}
        width={13}
        height={17}
      />

      {alert > 0 ? (
        <g className="ui-world__alert">
          <circle className="ui-world__beacon-ring" cx={f.x0 - 26} cy={f.top - 18} r="4" />
          <circle className="ui-world__beacon" cx={f.x0 - 26} cy={f.top - 18} r="3.5" />
        </g>
      ) : null}
    </g>
  );
}

function Frame({ f, active = 0, alert = 0 }) {
  return (
    <g className="ui-world__frame">
      {f.cols.map((c, i) => (
        <line key={`c${i}`} x1={c.x} y1={c.y0} x2={c.x} y2={c.y1} />
      ))}

      {/* Beams carry the arrival sequence: the structure is SET OUT once, in
       * order, bottom to top. Looping it would say the building is being built
       * while you watch. */}
      {f.beams.map((b, i) => (
        <line
          key={`b${i}`}
          className="ui-world__beam"
          style={{ "--i": i }}
          x1={b.x0}
          y1={b.y}
          x2={b.x1}
          y2={b.y}
        />
      ))}

      {f.braces.map((b, i) => (
        <line
          key={`x${i}`}
          className="ui-world__brace"
          x1={b.x0}
          y1={b.y0}
          x2={b.x1}
          y2={b.y1}
        />
      ))}

      {/* The top storey is under construction, so its slab stops short. A
       * frame whose every floor is complete is a finished building. */}
      <line
        className="ui-world__partial"
        x1={f.partial.x0}
        y1={f.partial.y}
        x2={f.partial.x1}
        y2={f.partial.y}
      />

      <Live f={f} active={active} alert={alert} />
    </g>
  );
}

function Crane({ g, index }) {
  const a = g.apex;
  const jy = g.jib.y;

  return (
    <g
      className="ui-world__crane"
      style={{
        "--jib": `${g.jib.x1 - g.jib.x0}px`,
        "--from": g.travel.from,
        "--to": g.travel.to,
        "--i": index,
      }}
    >
      <line x1={a.x} y1={a.y} x2={g.base.x} y2={g.base.y} />
      {g.ties.map((y, i) => (
        <line key={i} x1={a.x - 9} y1={y} x2={a.x + 9} y2={y} />
      ))}
      <line x1={g.tower_top.x0} y1={a.y} x2={g.tower_top.x1} y2={a.y} />
      <line x1={g.jib.x0} y1={jy} x2={g.jib.x1} y2={jy} />
      <line x1={g.back.x0} y1={jy} x2={g.back.x1} y2={jy} />

      {/* Pennant stays. Without the diagonals from the mast head out to the
       * jib and counter-jib, a crane reads as a plus sign. */}
      <line x1={a.x} y1={a.y - 26} x2={g.jib.x0 + (g.jib.x1 - g.jib.x0) * 0.62} y2={jy} />
      <line x1={a.x} y1={a.y - 26} x2={g.back.x0} y2={jy} />
      <line x1={a.x} y1={a.y} x2={a.x} y2={a.y - 26} />

      <rect x={g.cwt.x} y={g.cwt.y} width={g.cwt.w} height={g.cwt.h} />
      <rect x={g.cab.x} y={g.cab.y} width={g.cab.w} height={g.cab.h} />

      {/*
       * The trolley carries its own cable and load, so the whole assembly
       * travels as one transform and the hook sways INSIDE it — about the
       * trolley, not about the drawing. That is what makes the load read as
       * something being carried rather than as a rectangle translating.
       */}
      <g
        className="ui-world__trolley"
        style={{ "--x0": `${g.jib.x0}px`, "--y": `${jy}px` }}
      >
        <rect x="-7" y="-5" width="14" height="10" />
        <g className="ui-world__hook">
          <line x1="0" y1="0" x2="0" y2={g.hook_drop} />
          <rect x="-11" y={g.hook_drop} width="22" height="9" />
        </g>
      </g>
    </g>
  );
}

function Near({ near, ground, dust }) {
  return (
    <g className="ui-world__near">
      {near.standards.map((s, i) => (
        <line key={`s${i}`} x1={s.x} y1={s.y0} x2={s.x} y2={s.y1} />
      ))}
      {near.ledgers.map((l, i) => (
        <line key={`g${i}`} x1={l.x0} y1={l.y} x2={l.x1} y2={l.y} />
      ))}

      {/* A setting-out signal crossing the ground line, on its own long
       * rhythm so it never falls into step with the plant above it. */}
      <line
        className="ui-world__scan"
        style={{ "--dur": "26s" }}
        x1="0"
        y1={ground + 4}
        x2="150"
        y2={ground + 4}
      />

      {/* Survey setting-out marks. The convention that says a site has been
       * measured, which is the difference between a drawing and a picture. */}
      {near.marks.map((m) => (
        <g key={m.label}>
          <line
            className="ui-world__mark"
            x1={m.x}
            y1={ground - 16}
            x2={m.x}
            y2={ground + 16}
          />
          <text className="ui-world__mark-t" x={m.x + 6} y={ground + 26}>
            {m.label}
          </text>
        </g>
      ))}

      {/*
       * Particulate in the work light. Local to the band by policy: it is the
       * one effect whose whole value is being seen closely, and spreading it
       * across a full viewport buys nothing but paint.
       */}
      {dust
        ? Array.from({ length: 14 }, (_, i) => (
            <circle
              key={`d${i}`}
              className="ui-world__mote"
              style={{ "--i": i, "--d": `${(i % 7) * 1.7}s` }}
              cx={((i * 137) % 100) / 100 * 2400}
              cy={ground - 40 - (((i * 71) % 100) / 100) * 300}
              r={1 + (i % 3) * 0.6}
            />
          ))
        : null}
    </g>
  );
}

/**
 * One plane: a layer element that carries the transform, and an SVG that
 * carries the drawing. Same viewBox on every plane, so they register.
 */
function Plane({ name, depth, viewBox, fit, children }) {
  return (
    <div className="ui-world__plane" style={{ "--depth": depth }}>
      <svg
        className="ui-world__svg"
        viewBox={viewBox}
        preserveAspectRatio={fit}
        /* Decorative in the strictest sense: it carries no information, so it
         * carries no accessible name and takes no focus. */
        aria-hidden="true"
        focusable="false"
        data-plane={name}
      >
        {children}
      </svg>
    </div>
  );
}

function World({
  variant = "operations",
  surface = "room",
  lights = false,
  dust = false,
  /* Real Dashboard counts. Absent means an inert site, which is the correct
   * reading before the route's data has arrived. */
  active = 0,
  alert = 0,
}) {
  const w = WORLDS[variant] || WORLDS.operations;
  const [, , vw, vh] = w.viewBox;

  /* The band picks its crop from the viewport, because the choice is between
   * two different compositions and not between two sizes. */
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 48rem)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 48rem)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const crop = CROP[surface === "band" && narrow ? "bandNarrow" : surface];
  const box = crop ? crop.join(" ") : `0 0 ${vw} ${vh}`;
  const fit = crop ? "xMidYMax meet" : "xMidYMax slice";

  /* Depth coefficients. Near things move most; that is the whole mechanism. */
  return (
    <>
      <Plane name="haze" depth={0.04} viewBox={box} fit={fit}>
        <Haze bands={w.haze} width={vw} />
      </Plane>

      <Plane name="distant" depth={0.1} viewBox={box} fit={fit}>
        <Distant blocks={w.distant} lights={lights} />
      </Plane>

      <Plane name="frame" depth={0.24} viewBox={box} fit={fit}>
        <Frame f={w.frame} active={active} alert={alert} />
      </Plane>

      <Plane name="rigs" depth={0.38} viewBox={box} fit={fit}>
        <g className="ui-world__rigs">
          {w.rigs.map((g, i) => (
            <Crane key={i} g={g} index={i} />
          ))}
        </g>
      </Plane>

      <Plane name="near" depth={0.62} viewBox={box} fit={fit}>
        <Near near={w.near} ground={w.ground} dust={dust} />
      </Plane>
    </>
  );
}

export default World;
