/**
 * File purpose:
 * The authentication environment. Assembles the five scene layers defined in
 * `styles/system/auth/scene.css` into the product's one cinematic surface.
 *
 * Rendered by:
 * - the auth layout (Phase 2, subsequent unit)
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

/**
 * @param {"full"|"band"} variant
 *   `full`  the scene fills its container — desktop, beside the form.
 *   `band`  a shortened crop — mobile, above the form. Not a scaled copy: the
 *           viewBox is different so the horizon sits where the crop needs it.
 */
function AuthScene({ variant = "full", children }) {
  const band = variant === "band";
  const h = band ? 240 : 900;
  const horizon = band ? 196 : 720;

  return (
    /*
     * This element IS the stage. `scene.css` positions every layer against
     * `.auth-scene`, so the class cannot live on an ancestor -- an earlier
     * draft used a `__stage` wrapper and the layers had no positioning
     * context at all.
     *
     * Content is a slot rather than a sibling, because `.auth-scene__content`
     * carries the z-index that puts the form above all five layers.
     */
    <div className="auth-scene" data-variant={variant}>
      {/* ── sky ─────────────────────────────────────────────────────────
          Gradient only. Dusk rather than night: the transition has to lighten
          from here, and a black start makes that a cut. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="sky">
        <svg viewBox={`0 0 1200 ${h}`} preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="as-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--auth-sky-deep)" />
              <stop offset="0.55" stopColor="var(--auth-sky-mid)" />
              <stop offset="1" stopColor="var(--auth-sky-warm)" />
            </linearGradient>
            <radialGradient id="as-sun" cx="0.72" cy="0.92" r="0.55">
              <stop offset="0" stopColor="var(--auth-glow)" stopOpacity="0.34" />
              <stop offset="1" stopColor="var(--auth-glow)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1200" height={h} fill="url(#as-sky)" />
          <rect width="1200" height={h} fill="url(#as-sun)" />
        </svg>
      </div>

      {/* ── distance ────────────────────────────────────────────────────
          Lowest contrast, no detail, never animated. Dropped entirely at
          mobile widths by scene.css — it is the layer that becomes noise. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="distance">
        <svg viewBox={`0 0 1200 ${h}`} preserveAspectRatio="xMidYMax slice">
          <g fill="var(--auth-sky-deep)" opacity="0.5">
            <rect x="40" y={horizon - 150} width="118" height="150" />
            <rect x="176" y={horizon - 96} width="86" height="96" />
            <rect x="980" y={horizon - 132} width="126" height="132" />
            <rect x="1124" y={horizon - 84} width="76" height="84" />
          </g>
        </svg>
      </div>

      {/* ── structure ───────────────────────────────────────────────────
          The subject. Built form, not activity. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="structure">
        <svg viewBox={`0 0 1200 ${h}`} preserveAspectRatio="xMidYMax slice">
          {/* Mass. Reads as silhouette; leaves during the transition. */}
          <g fill="#080f15">
            <rect x="318" y={horizon - 372} width="196" height="372" />
            <rect x="540" y={horizon - 268} width="150" height="268" />
            <rect x="716" y={horizon - 440} width="168" height="440" />
            <rect x="908" y={horizon - 214} width="104" height="214" />
          </g>

          {/*
            Floor lines. THE load-bearing element — see the header. These are
            the shell's hairlines, drawn on a building. They persist through
            the transition while everything around them resolves.
          */}
          <g
            className="auth-scene__structure-lines"
            stroke="#1b2731"
            strokeWidth="1"
            opacity="0.85"
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line
                key={`a${i}`}
                x1="318"
                x2="514"
                y1={horizon - 40 - i * 44}
                y2={horizon - 40 - i * 44}
              />
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={`b${i}`}
                x1="540"
                x2="690"
                y1={horizon - 40 - i * 44}
                y2={horizon - 40 - i * 44}
              />
            ))}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <line
                key={`c${i}`}
                x1="716"
                x2="884"
                y1={horizon - 40 - i * 44}
                y2={horizon - 40 - i * 44}
              />
            ))}
          </g>

          {/* Ground. One line, because a horizon is one line. */}
          <line
            x1="0"
            x2="1200"
            y1={horizon}
            y2={horizon}
            stroke="#0d151c"
            strokeWidth="2"
          />

          {/* Site illumination. Sparse and warm — the only lit windows are the
              ones someone is still working behind. */}
          <g fill="var(--auth-glow)" opacity="0.42">
            <rect x="352" y={horizon - 128} width="7" height="10" />
            <rect x="446" y={horizon - 260} width="7" height="10" />
            <rect x="596" y={horizon - 84} width="7" height="10" />
            <rect x="762" y={horizon - 348} width="7" height="10" />
            <rect x="826" y={horizon - 172} width="7" height="10" />
          </g>
        </svg>
      </div>

      {/* ── rig ─────────────────────────────────────────────────────────
          The only animated layer. One crane, 48s per sweep, transform only.
          Still enough to read as a site at rest rather than a site working. */}
      <div aria-hidden="true" className="auth-scene__layer" data-layer="rig">
        <svg viewBox={`0 0 1200 ${h}`} preserveAspectRatio="xMidYMax slice">
          <g
            className="auth-rig"
            stroke="#2c3a47"
            strokeWidth="2"
            fill="none"
            strokeLinecap="square"
          >
            {/* mast */}
            <line x1="800" x2="800" y1={horizon - 440} y2={horizon - 660} />
            {/* jib and counter-jib */}
            <line x1="640" x2="1010" y1={horizon - 630} y2={horizon - 630} />
            {/* tie bars */}
            <line x1="800" x2="676" y1={horizon - 668} y2={horizon - 630} />
            <line x1="800" x2="962" y1={horizon - 668} y2={horizon - 630} />
            {/* hoist line and load */}
            <line x1="906" x2="906" y1={horizon - 630} y2={horizon - 556} />
          </g>
          <rect
            x="892"
            y={horizon - 556}
            width="28"
            height="18"
            fill="#2c3a47"
          />
          {/* obstruction light */}
          <circle cx="800" cy={horizon - 668} r="4" fill="var(--auth-glow)" />
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
