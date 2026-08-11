/**
 * File purpose:
 * The construction world, rendered as a true 3D scene.
 *
 * Rendered by:
 * - pages/DashboardPage.jsx, once as a fixed room and once as a band
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ONE SPACE, NOT FIVE LAYERS
 * ─────────────────────────────────────────────────────────────────────────
 * Geometry comes from tools/scene/generate_world3d.py, which places every
 * object in one coordinate system (x east, y up, z away from the camera) and
 * projects it axonometrically. A world unit is the same length wherever it
 * sits, which is how construction drawings are drawn and the reason the crane
 * at the back and the scaffold at the front can share a single rule.
 *
 * The previous generator emitted stroked planes at different opacities. That
 * is layering: it cannot occlude, cannot give an object volume, and cannot let
 * anything move through depth.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * OCCLUSION IS THE DRAW ORDER
 * ─────────────────────────────────────────────────────────────────────────
 * Every solid is three filled faces — front, side, top — and the generator
 * sorts the scene by depth before writing it. Near objects are painted last,
 * so they cover what is behind them for the same reason they would in life.
 * There is no opacity trick anywhere.
 *
 * Between bands, occlusion is band order. That is what lets the crane's load
 * pass BEHIND the frame it serves and IN FRONT of the distant massing, and be
 * covered by the foreground scaffold at one end of its travel: it simply
 * occupies a depth between them.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LIGHT
 * ─────────────────────────────────────────────────────────────────────────
 * The generator computes each face's luminance from its normal against one
 * world light and then attenuates it with depth. It emits a scalar, never a
 * colour, so the palette stays in CSS and the theme can move without
 * regenerating the world.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE WORLD IS NEVER DATA
 * ─────────────────────────────────────────────────────────────────────────
 * Seeded and deterministic. It may vary by route and by viewport; it may never
 * vary by business state. `active` and `alert` decide how many zones are lit
 * and whether a beacon burns — never where a building is, how far along it is,
 * or that anything is being built while you watch.
 */

import { useEffect, useState } from "react";

import { WORLDS } from "./worldGeometry";

/* What each surface takes of the world. The room sees the whole site; the
 * window takes a nearer, tighter frame of the same place, and a phone takes
 * one crane and its structure at legible scale rather than all of it as
 * threads. */
const CROP = {
  room: null,
  band: [420, 90, 1700, 620],
  bandNarrow: [700, 120, 780, 560],
};

/** One solid: three faces, each carrying its own computed luminance. */
function Solid({ s }) {
  return (
    <g className={`w-s w-${s.kind}`}>
      {s.faces.map((f, i) => (
        <path key={i} className={`w-f w-f--${f.f}`} style={{ "--s": f.s }} d={f.d} />
      ))}
    </g>
  );
}

/**
 * A parallax band. Its own HTML layer so the camera moves it on the
 * compositor — measured at 60fps against 600 filled quads, where the same
 * scene under WebGL ran 56.6.
 */
function Band({ index, depth, children, viewBox, fit }) {
  return (
    <div className="ui-world__plane" style={{ "--depth": depth }} data-band={index}>
      <svg
        className="ui-world__svg"
        viewBox={viewBox}
        preserveAspectRatio={fit}
        aria-hidden="true"
        focusable="false"
      >
        {children}
      </svg>
    </div>
  );
}

/* Depth coefficients per band. Near things move most; that is the mechanism. */
const BAND_DEPTH = [0.06, 0.2, 0.38, 0.72];

function World({
  variant = "operations",
  surface = "room",
  active = 0,
  alert = 0,
}) {
  const w = WORLDS[variant] || WORLDS.operations;
  const [, , vw, vh] = w.viewBox;

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
  const viewBox = crop ? crop.join(" ") : `0 0 ${vw} ${vh}`;
  const fit = crop ? "xMidYMax meet" : "xMidYMax slice";

  /*
   * A phone gets fewer bands. Not a smaller camera — a composed one: the
   * distant massing is dropped entirely, so the silhouette that remains reads
   * at arm's length instead of dissolving into threads.
   */
  /*
   * Which bands each surface renders.
   *
   * The room is CONTEXT at 13% opacity: its plant and its foreground are
   * invisible there, so rendering them is paint and continuous animation
   * bought for nothing. It keeps the distant massing and the frame, which is
   * all that reads through the sheets.
   *
   * A phone drops the distant band instead — a composed camera, not a smaller
   * one, so the silhouette that remains reads at arm's length.
   */
  const bands =
    surface === "room" ? [0, 1] : narrow ? [1, 2, 3] : [0, 1, 2, 3];

  return (
    <>
      {bands.map((b) => (
        <Band key={b} index={b} depth={BAND_DEPTH[b]} viewBox={viewBox} fit={fit}>
          {/* The ground and its setting-out grid belong to the far band, drawn
              IN the plane rather than laid over it, so the grid recedes with
              the same skew as everything standing on it. */}
          {b === 1 ? (
            <g className="w-ground">
              {w.ground.map((g, i) => (
                <path key={i} style={{ "--s": g.s }} d={g.d} />
              ))}
            </g>
          ) : null}

          {w.bands[b].map((s, i) => (
            <Solid key={i} s={s} />
          ))}

          {/* Plant lives in band 2, between the frame it serves and the
              scaffold in front of it. */}
          {b === 2 ? <Plant w={w} active={active} alert={alert} /> : null}
        </Band>
      ))}
    </>
  );
}

/**
 * The machinery, and the only continuously moving things in the world.
 *
 * Each system runs its own authored cycle at its own duration and offset, with
 * idle holds written into the keyframes, so no two ever fall into step and the
 * scene never reveals a loop boundary.
 */
function Plant({ w, active, alert }) {
  const f = w.frame;
  const h = w.hoist;

  return (
    <g className="w-plant">
      {w.paths.map((p, i) => {
        const dx = p.to[0] - p.from[0];
        const dy = p.to[1] - p.from[1];
        return (
          <g
            key={p.tag}
            className="w-trolley"
            style={{
              "--x": `${p.from[0]}px`,
              "--y": `${p.from[1]}px`,
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              "--i": i,
            }}
          >
            <rect className="w-trolley-car" x="-9" y="-7" width="18" height="13" />
            {/*
              The load hangs on a cable that CHANGES LENGTH: the hook is
              lowered and raised as part of the cycle, so the machine reads as
              doing work rather than sliding along a rail.
            */}
            <g className="w-hook">
              <line className="w-cable" x1="0" y1="4" x2="0" y2="0" />
              <rect className="w-load" x="-13" y="0" width="26" height="11" />
            </g>
          </g>
        );
      })}

      {/* The hoist runs the face of the core, inside the frame band, so the
          frame's own columns pass in front of it at either end of its run. */}
      <g
        className="w-hoist"
        style={{
          "--x": `${h.x + h.z * w.skew[0]}px`,
          "--y0": `${w.horizon - h.y0 - h.z * w.skew[1]}px`,
          "--rise": `${h.y1 - h.y0}px`,
        }}
      >
        <rect x="0" y="-26" width={h.w} height="26" />
      </g>

      {/*
        Lit bays. The COUNT comes from the Dashboard's own running-tender
        figure; which bays light is geometry. This world represents system
        activity, not a building anyone is putting up.
      */}
      {Array.from({ length: Math.min(active, 8) }, (_, n) => {
        const col = (n * 3) % f.bays;
        const row = (n * 2) % f.storeys;
        const x = f.x0 + col * f.bay_w + f.z0 * w.skew[0];
        const y = w.horizon - (row + 1) * f.storey - f.z0 * w.skew[1];
        return (
          <rect
            key={`bay${n}`}
            className="w-bay"
            style={{ "--d": `${(n % 5) * 2.7}s`, "--dur": `${13 + (n % 4) * 3.5}s` }}
            x={x}
            y={y}
            width={f.bay_w}
            height={f.storey - 10}
          />
        );
      })}

      {alert > 0 ? (
        <g className="w-alert">
          <circle className="w-beacon-ring" cx={f.x0 - 40} cy={w.horizon - 470} r="5" />
          <circle className="w-beacon" cx={f.x0 - 40} cy={w.horizon - 470} r="4.5" />
        </g>
      ) : null}
    </g>
  );
}

export default World;
