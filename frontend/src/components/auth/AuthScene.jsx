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

/* The drawing's coordinate system. One viewBox serves every breakpoint — see
 * the safe-area arithmetic above — so there is no variant to keep in sync. */
const W = 1600;
const H = 900;
const HORIZON = 720;

/**
 * Left edge, width, height above the horizon.
 *
 * Capped at 240 units, and the cap is structural rather than aesthetic. The
 * safe area allows nothing essential above y=340; a crane needs roughly 130
 * units of clear air between the roofline and its apex to read as a crane at
 * all. The first version gave the buildings 340 and left the mast exactly zero
 * units long, which rendered as a small pitched roof sitting on a block.
 *
 * So the skyline yields to the rig, not the other way round. The rig is the
 * only thing in the frame that is unmistakably a construction site.
 */
const MASSING = [
  [392, 176, 210],
  [568, 138, 150],
  [706, 190, 240],
  [896, 122, 180],
  [1018, 158, 128],
];

/* The rig, in one place so the mast, jib and ties cannot drift apart. */
const RIG = {
  x: 800,
  apex: 350,
  jib: 374,
  jibFrom: 590,
  jibTo: 1050,
  hoist: 962,
  load: 468,
};

function AuthScene({ children }) {
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
            <rect x="150" y={HORIZON - 128} width="104" height="128" />
            <rect x="268" y={HORIZON - 82} width="78" height="82" />
            <rect x="1210" y={HORIZON - 112} width="112" height="112" />
            <rect x="1338" y={HORIZON - 70} width="70" height="70" />
          </g>
        </svg>
      </div>

      {/* ── structure ───────────────────────────────────────────────────
          The subject. Built form, not activity. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="structure">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
          {/* Mass. Reads as silhouette; leaves during the transition. */}
          <g fill="#05080b">
            {MASSING.map(([x, w, h]) => (
              <rect key={`m${x}`} x={x} y={HORIZON - h} width={w} height={h} />
            ))}
          </g>

          {/*
            Floor lines. THE load-bearing element — see the header. These are
            the shell's hairlines, drawn on a building. They persist through
            the transition while everything around them resolves.

            Generated from the same massing table as the blocks, so a change to
            a building cannot leave its floors behind. Each line is inset from
            the block's edges: a floor plate that runs to the silhouette's
            outline reads as a stripe painted on it rather than as a storey
            seen through an unclad frame.
          */}
          <g
            className="auth-scene__structure-lines"
            stroke="#1d2a35"
            strokeWidth="1"
          >
            {MASSING.flatMap(([x, w, h]) =>
              Array.from({ length: Math.floor((h - 24) / 38) }, (_, i) => (
                <line
                  key={`f${x}-${i}`}
                  x1={x + 8}
                  x2={x + w - 8}
                  y1={HORIZON - 30 - i * 38}
                  y2={HORIZON - 30 - i * 38}
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

          {/* Site illumination. Sparse and warm — the only lit windows are the
              ones someone is still working behind. Five, not fifty: a lit grid
              would say the site is busy, and the whole point is that the day
              is over. */}
          <g fill="var(--auth-glow)" opacity="0.5">
            <rect x="430" y={HORIZON - 118} width="8" height="11" />
            <rect x="742" y={HORIZON - 264} width="8" height="11" />
            <rect x="806" y={HORIZON - 150} width="8" height="11" />
            <rect x="932" y={HORIZON - 202} width="8" height="11" />
            <rect x="1060" y={HORIZON - 96} width="8" height="11" />
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
            /*
             * Brighter than the massing, and deliberately so. The silhouettes
             * are read as shape against the sun; the rig is read as LINE, and
             * a line only exists if it separates from what it crosses. At
             * #33424f it measured 1.2:1 against the mid sky and disappeared
             * entirely at 390px, which cost the scene the one object that
             * makes it unmistakably a construction site.
             */
            stroke="#5b6e7f"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="square"
          >
            {/* Mast. Runs to the ground, as a tower crane's does — it stands
                in front of the massing rather than on top of it. The apex is
                at y=350, inside the y=340 floor the safe area allows, so no
                breakpoint crops the top of the crane. */}
            <line x1={RIG.x} x2={RIG.x} y1={RIG.apex} y2={HORIZON} />

            {/* Jib and counter-jib. Asymmetric, as a real tower crane is: the
                working jib is long, the counter-jib short and weighted. */}
            <line x1={RIG.jibFrom} x2={RIG.jibTo} y1={RIG.jib} y2={RIG.jib} />

            {/* Tie bars back to the apex. */}
            <line x1={RIG.x} x2={RIG.jibFrom + 42} y1={RIG.apex} y2={RIG.jib} />
            <line x1={RIG.x} x2={RIG.jibTo - 42} y1={RIG.apex} y2={RIG.jib} />

            {/* Hoist line and its load, hanging still. Still is the point: a
                swinging load would say work is happening. */}
            <line x1={RIG.hoist} x2={RIG.hoist} y1={RIG.jib} y2={RIG.load} />
          </g>

          {/* Counterweight, which is what makes the short arm read as a
              counter-jib rather than as a broken jib. */}
          <rect x={RIG.jibFrom - 6} y={RIG.jib - 9} width="34" height="20" fill="#5b6e7f" />

          <rect x={RIG.hoist - 17} y={RIG.load} width="34" height="21" fill="#5b6e7f" />

          {/* Obstruction light. The one thing in the frame that is on. */}
          <circle cx={RIG.x} cy={RIG.apex} r="4.5" fill="var(--auth-glow)" />
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
