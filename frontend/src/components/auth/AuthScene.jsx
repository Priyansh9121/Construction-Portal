/**
 * File purpose:
 * The authentication environment. Assembles the five scene layers defined in
 * `styles/system/auth/scene.css` into the product's one cinematic surface.
 *
 * Rendered by:
 * - components/auth/AuthShell.jsx, which is the frame for all four auth routes
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS A PICTURE OF, AND WHY
 * ─────────────────────────────────────────────────────────────────────────
 * `PRODUCT_SOUL.md` is explicit that this product is not about construction —
 * it is about **credibility**, because construction work is disputed and the
 * system is the witness.
 *
 * So the scene is not a construction site at work. It is a site at the moment
 * the day's record is closed: low sun, structure standing, one crane still.
 * The building is a *result*, not an activity. That is the difference between
 * illustrating the industry and illustrating the product's purpose.
 *
 * Three compositions were considered:
 *
 *   A. daytime active site — cranes moving, dust, figures. REJECTED: it shows
 *      work happening, which is the one thing this software does not do. It
 *      also reads as stock construction imagery, which the brief bans.
 *   B. pure orthographic linework — elevation drawing only. REJECTED here and
 *      kept for the application: it is the Architectural Instrument language,
 *      and if authentication looks identical to the app there is no arrival.
 *   C. dusk structure, built form, one still crane — ADOPTED. Dark enough to
 *      make the light-up transition mean something, structural enough that its
 *      linework is continuous with the shell's hairlines.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE GEOMETRY IS DERIVED, NOT DRAWN BY EYE
 * ─────────────────────────────────────────────────────────────────────────
 * `preserveAspectRatio="slice"` crops, and the first version was composed
 * without working out what it crops. At 1440x900 it overscaled 1.2x
 * horizontally and cut the crane's apex off the top of the screen; in the
 * mobile band it cut everything above the fifth floor.
 *
 * The safe area is arithmetic, so it is stated here rather than rediscovered:
 *
 *   scale          = max(cw / 1600, ch / 900)
 *   visible height = ch / scale        (900 whenever cw/ch <= 1.78)
 *   visible width  = cw / scale        (1600 whenever cw/ch >= 1.78)
 *
 * The tightest real case is the 768px-wide band — 768x280, ratio 2.74 — which
 * sees only the bottom 583 units. The widest is an ultrawide desktop at ratio
 * 2.37, which sees the bottom 675. So:
 *
 *   nothing essential above y = 340        nothing essential outside x = 200..1400
 *
 * A 16:9 viewBox is what removes the horizontal overscale that caused the
 * original crop: at 1440x900, 1600x900 needs no overscale at all.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE LINEWORK IS LOAD-BEARING
 * ─────────────────────────────────────────────────────────────────────────
 * `.auth-scene__structure-lines` is not decoration and must not be renamed:
 * `auth/transition.css` deliberately gives it no transition, so it persists
 * while the ground lightens beneath it. Floor lines here become hairlines
 * there. That continuity is the whole answer to the dark→light problem.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HONEST SCENE, HONEST DATA
 * ─────────────────────────────────────────────────────────────────────────
 * Nothing here is data-driven and nothing pretends to be. There is no worker
 * count, no live crane telemetry, no weather. `PRODUCT_SOUL.md` permits
 * fictional atmosphere and forbids fictional operations, and this stays on the
 * right side of that line: it is a drawing, and it says nothing about the
 * business.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COST
 * ─────────────────────────────────────────────────────────────────────────
 * Inline SVG, no request, no decode, resolution-independent. Every layer is
 * `aria-hidden` — the scene carries no information, so announcing it would add
 * noise to a form a screen-reader user is trying to complete.
 *
 * One element animates, in `transform` only, and the animation lives in CSS so
 * reduced motion is handled by the stylesheet rather than by a prop.
 */

import SCENE from "./sceneGeometry";
import AuthWorld from "./AuthWorld";

const { W, H, HORIZON, massing: MASSING, floors: FLOORS, rig: RIG,
        lights: LIGHTS, distance: DISTANCE } = SCENE;

function AuthScene({ children, onWorldReady }) {
  return (
    /*
     * This element IS the stage. `scene.css` positions every layer against
     * `.auth-scene`, so the class cannot live on an ancestor -- an earlier
     * draft used a `__stage` wrapper and the layers had no positioning
     * context at all.
     *
     * `data-scheme="dark"` is the whole contract between this scene and the
     * design system. `scene.css` answers it with a block that re-points the
     * semantic tokens, so `.ctl`, `.field`, focus and status all become
     * correct here without a single auth-specific copy of them. It belongs on
     * the element rather than in CSS because the scheme is a property of the
     * ENVIRONMENT, and this component is the environment.
     *
     * Content is a slot rather than a sibling, because `.auth-scene__content`
     * carries the z-index that puts the form above all five layers.
     */
    <div className="auth-scene" data-scheme="dark">
      {/*
        THE REAL-TIME WORLD.

        A WebGL construction site, loaded lazily. Until three.js resolves — and
        permanently, on a device that cannot run it — the authored SVG layers
        below are what is seen. Both are the same place: dusk, the same
        massing, the same crane. The form is mounted and submittable from the
        first frame regardless, because authentication never waits for a world.
      */}
      <AuthWorld onReady={onWorldReady} />

      {/* ── sky ─────────────────────────────────────────────────────────
          Gradient only. Dusk rather than night: the transition has to lighten
          from here, and a black start makes that a cut. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="sky">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="as-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--auth-sky-deep)" />
              <stop offset="0.62" stopColor="var(--auth-sky-mid)" />
              <stop offset="1" stopColor="var(--auth-sky-warm)" />
            </linearGradient>

            {/*
              The low sun. Placed behind the massing rather than beside it, so
              the buildings read as standing in front of the light instead of
              being lit from the side — which is what makes them silhouettes.
            */}
            <radialGradient id="as-sun" cx="0.62" cy="0.82" r="0.5">
              <stop offset="0" stopColor="var(--auth-glow)" stopOpacity="0.44" />
              <stop offset="0.55" stopColor="var(--auth-glow)" stopOpacity="0.16" />
              <stop offset="1" stopColor="var(--auth-glow)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sky occupies only the space above the horizon. Below it is ground,
              and the two are different materials — the first version ran the
              sky gradient to the bottom of the frame, which put a warm haze
              where the earth is and read as water. */}
          <rect width={W} height={HORIZON} fill="url(#as-sky)" />
          <rect width={W} height={HORIZON} fill="url(#as-sun)" />

          {/* Ground. Darker than the deepest sky, because at dusk the earth is
              always the darkest thing in the frame. */}
          <rect y={HORIZON} width={W} height={H - HORIZON} fill="#080b0e" />
        </svg>
      </div>

      {/* ── distance ────────────────────────────────────────────────────
          Lowest contrast, no detail, never animated. Dropped entirely at
          mobile widths by scene.css — it is the layer that becomes noise. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="distance">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
          {/* Near-silhouette. It must recede: the first version drew these at
              50% over the warm band and they came forward as pale blocks. */}
          <g fill="#0a1016" opacity="0.85">
            {DISTANCE.map((d) => (
              <rect
                key={`d${d.x}`}
                x={d.x}
                y={HORIZON - d.h}
                width={d.w}
                height={d.h}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* ── structure ───────────────────────────────────────────────────
          The subject. Built form, not activity. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="structure">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
          {/* Mass. Reads as silhouette; leaves during the transition. */}
          <g fill="#05080b">
            {MASSING.map((b) => (
              <rect key={`m${b.x}`} x={b.x} y={b.y} width={b.w} height={b.h} />
            ))}
          </g>

          {/*
            Floor plates. THE load-bearing element -- see the header. These
            are the shell's hairlines, drawn on a building, and they persist
            through the departure while everything around them resolves.

            They ASSEMBLE on first paint: each plate draws itself from the
            left over a short window, in sequence up the building. That is the
            blueprint-assembly idea, and it is a one-time entrance rather than
            a loop -- the scene is a place that was already there, not a
            construction sequence playing on repeat.

            Generated from the same table as the blocks, so a change to a
            building cannot leave its floors behind.
          */}
          <g
            className="auth-scene__structure-lines"
            stroke="#1d2a35"
            strokeWidth="1"
          >
            {FLOORS.flatMap((rows, b) =>
              rows.map((r, i) => (
                <line
                  key={`f${b}-${i}`}
                  className="auth-floor"
                  x1={r.x1}
                  x2={r.x2}
                  y1={r.y}
                  y2={r.y}
                  style={{ "--i": b * 4 + i }}
                />
              ))
            )}
          </g>

          {/* The horizon. One line, because a horizon is one line. */}
          <line
            x1="0"
            x2={W}
            y1={HORIZON}
            y2={HORIZON}
            stroke="#131c24"
            strokeWidth="2"
          />

          {/*
            Lit windows.

            Atmosphere, not occupancy. Five, never more, each fading on its
            own non-harmonic period so the pattern never visibly repeats
            within a session.

            This is the boundary the amended motion law draws: a light going
            on says nothing countable, sits nowhere near a figure, and would
            be equally true on the company's first day and its last. A lit
            GRID would say the site is busy, which is exactly the claim the
            scene must not make -- the premise is that the day is over.
          */}
          <g fill="var(--auth-glow)">
            {LIGHTS.map((l, i) => (
              <rect
                key={`l${i}`}
                className="auth-window"
                x={l.x}
                y={l.y}
                width="8"
                height="11"
                style={{
                  "--delay": `${l.delay}s`,
                  "--period": `${l.period}s`,
                }}
              />
            ))}
          </g>

        </svg>
      </div>

      {/* ── rig ─────────────────────────────────────────────────────────
          The only animated layer. One crane, 48s per sweep, transform only.
          Still enough to read as a site at rest rather than a site working. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="rig">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
          <g
            className="auth-rig"
            stroke="#5b6e7f"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="square"
          >
            {/* Mast, to the ground. The crane stands among the buildings. */}
            <line x1={RIG.x} x2={RIG.x} y1={RIG.apex} y2={RIG.base} />

            {/* Jib and counter-jib. Asymmetric, as a real tower crane is. */}
            <line x1={RIG.jibFrom} x2={RIG.jibTo} y1={RIG.jib} y2={RIG.jib} />

            {/* Tie bars back to the apex. */}
            <line x1={RIG.x} x2={RIG.tieFrom} y1={RIG.apex} y2={RIG.jib} />
            <line x1={RIG.x} x2={RIG.tieTo} y1={RIG.apex} y2={RIG.jib} />
          </g>

          {/* Counterweight, which is what makes the short arm read as a
              counter-jib rather than as a broken jib. */}
          <rect
            className="auth-rig"
            x={RIG.jibFrom - 6}
            y={RIG.jib - 9}
            width="34"
            height="20"
            fill="#5b6e7f"
          />

          {/*
            The hoist and its load, swaying.

            Its own group so it can pivot about the trolley rather than about
            the scene: a hook swings from the point it hangs from, and getting
            that origin wrong is what makes an animated load look like a
            sticker sliding around. Very slow and very small -- this is a
            still site, and the sway is the one thing that says the air is
            moving.
          */}
          <g className="auth-hook" style={{ "--pivot": `${RIG.hoist}px ${RIG.jib}px` }}>
            <line
              x1={RIG.hoist}
              x2={RIG.hoist}
              y1={RIG.jib}
              y2={RIG.load}
              stroke="#5b6e7f"
              strokeWidth="2.5"
              strokeLinecap="square"
            />
            <rect
              x={RIG.hoist - 17}
              y={RIG.load}
              width="34"
              height="21"
              fill="#5b6e7f"
            />
          </g>

          {/* Obstruction light. The one thing in the frame that is on. */}
          <circle className="auth-beacon" cx={RIG.x} cy={RIG.apex} r="4.5" fill="var(--auth-glow)" />
        </svg>
      </div>

      {/* ── haze ───────────────────────────────────────────────────────
          Atmosphere. One very wide, very soft band drifting across the
          horizon at a speed that is only perceptible if you watch for it.

          It carries no information, sits nowhere near a figure, and is the
          clearest possible case of what the amended motion law permits: it
          would be equally true on the company's first day and its last. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="haze">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="as-haze" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--auth-sky-warm)" stopOpacity="0" />
              <stop offset="0.5" stopColor="var(--auth-sky-warm)" stopOpacity="0.5" />
              <stop offset="1" stopColor="var(--auth-sky-warm)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect
            className="auth-haze"
            x={-W}
            y={HORIZON - 190}
            width={W * 2}
            height="200"
            fill="url(#as-haze)"
          />
        </svg>
      </div>

      {/* ── veil ────────────────────────────────────────────────────────
          The legibility guarantee. Empty by design: scene.css owns the
          gradient so form contrast is measured against a known value. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="veil" />

      {/* The form. Above every layer, and the only part that is not
          aria-hidden -- the scene carries no information, so announcing it
          would add noise to a form someone is trying to complete. */}
      {children ? (
        <div className="auth-scene__content">{children}</div>
      ) : null}
    </div>
  );
}

export default AuthScene;
