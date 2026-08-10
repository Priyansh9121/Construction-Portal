/**
 * File purpose:
 * The workspace's environmental band — the one place on an operational route
 * where atmosphere is permitted.
 *
 * Rendered by:
 * - pages/DashboardPage.jsx, as the page's opening zone
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS AN ELEVATION AND NOT THE LOGIN SKYLINE
 * ─────────────────────────────────────────────────────────────────────────
 * The threshold speaks Cinematic Site Intelligence: a photograph of a place at
 * dusk, drawn in FILL, lit. The workspace speaks Architectural Instrument: a
 * measured orthographic drawing of the same place, in LINE, annotated, with a
 * dimension line and a sheet reference.
 *
 * Reusing the login geometry here at a smaller size would import the wrong
 * grammar onto an operational surface — it would make the dashboard look like
 * the sign-in screen rather than like the drawing the sign-in screen was
 * always a photograph of. Two renderings of one site is the point.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHERE ATMOSPHERE IS ALLOWED TO BE
 * ─────────────────────────────────────────────────────────────────────────
 * Here, and nowhere else on the page.
 *
 * `EXPERIENCE_LANGUAGE` §6 as amended permits environmental motion and
 * forbids it anywhere it could be mistaken for a reading. This band holds the
 * page's opening SENTENCE — a greeting and a count of what needs the user —
 * and no figures. Everything below it is data on plain ground.
 *
 * That division is the rule the whole route obeys: the environment moves, and
 * it moves above the evidence rather than behind it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SHALLOW, DELIBERATELY
 * ─────────────────────────────────────────────────────────────────────────
 * A horizon, not a hero. It establishes that the workspace has depth and
 * place, then gets out of the way. A tall banner on a route somebody opens
 * forty times a day is a tax, and `PRODUCT.md` puts fast completion above
 * visual spectacle.
 *
 * Cost: inline SVG generated at build time, no request, no decode, ~2 kB.
 * Every animated property is `transform` or `opacity`.
 */

import HORIZON from "./horizonGeometry";

const { W, H, GROUND, blocks, datums, rig, dimension } = HORIZON;

function DashboardHorizon({ children }) {
  return (
    <section className="ui-horizon">
      {/*
        The drawing. `aria-hidden` because it carries no information: it is a
        picture of a generic site, identical for every company, and announcing
        it would put decoration in front of the sentence a screen-reader user
        actually needs.
      */}
      <div className="ui-horizon__scene" aria-hidden="true">
        {/*
            `meet`, not `slice`.
            
            `slice` filled the band but showed only half the elevation, cut
            through the middle of a building at each end — a screenshot made
            that plain. An elevation that is cropped is not an elevation; it
            is stray rectangles. `meet` fits the whole drawing and anchors it
            to the band's baseline, so the site reads complete at every width
            and the ground line always lands where the content begins.
          */}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMax meet">
          {/* Volumes, in outline. An elevation shows edges, not masses. */}
          <g className="ui-horizon__mass" fill="none" strokeWidth="1">
            {blocks.map((b) => (
              <rect key={`b${b.x}`} x={b.x} y={b.y} width={b.w} height={b.h} />
            ))}
          </g>

          {/*
            Storey datums — the same hairline the application rules its tables
            with, drawn on a building. This is the literal continuity the
            threshold hands over: those lines became these lines.
          */}
          <g className="ui-horizon__datums" strokeWidth="1">
            {datums.flatMap((rows, b) =>
              rows.map((r, i) => (
                <line
                  key={`d${b}-${i}`}
                  x1={r.x1}
                  x2={r.x2}
                  y1={r.y}
                  y2={r.y}
                  style={{ "--d": b * 3 + i }}
                />
              ))
            )}
          </g>

          {/* The rig, reduced to its structural diagram. */}
          <g className="ui-horizon__rig" fill="none" strokeWidth="1.25">
            <line x1={rig.x} x2={rig.x} y1={rig.apex} y2={rig.base} />
            <line x1={rig.from} x2={rig.to} y1={rig.jib} y2={rig.jib} />
            <line x1={rig.x} x2={rig.from + 40} y1={rig.apex} y2={rig.jib} />
            <line x1={rig.x} x2={rig.to - 40} y1={rig.apex} y2={rig.jib} />
          </g>

          {/* The load, swaying about the trolley it hangs from. */}
          <g className="ui-horizon__hook" strokeWidth="1.25">
            <line x1={rig.hoist} x2={rig.hoist} y1={rig.jib} y2={rig.load} />
            <rect x={rig.hoist - 11} y={rig.load} width="22" height="12" />
          </g>

          {/*
            The dimension line. One convention does more than any other to say
            "this was measured rather than drawn": a witness line, two ticks
            and a figure. It is the drawing's own claim to precision, and it is
            why this band reads as an instrument rather than as wallpaper.
          */}
          <g className="ui-horizon__dim" strokeWidth="1">
            <line
              x1={dimension.x}
              x2={dimension.x}
              y1={dimension.top}
              y2={dimension.bottom}
            />
            <line
              x1={dimension.x - 5}
              x2={dimension.x + 5}
              y1={dimension.top}
              y2={dimension.top}
            />
            <line
              x1={dimension.x - 5}
              x2={dimension.x + 5}
              y1={dimension.bottom}
              y2={dimension.bottom}
            />
          </g>

          {/* Ground. One line, because a ground line is one line. */}
          <line
            className="ui-horizon__ground"
            x1="0"
            x2={W}
            y1={GROUND}
            y2={GROUND}
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/*
        Light crossing the drawing. A single wide, very soft band on a two
        minute pass — slow enough that it registers as the room rather than as
        an element, which is the whole test for whether atmosphere is
        atmosphere.
      */}
      <div className="ui-horizon__light" aria-hidden="true" />

      {/*
        The attention section. Its greeting and headline sit inside the
        drawing's depth; its rows fall below where the drawing has already
        faded out. The band is a wrapper rather than a replacement — see the
        note in horizon.css for why that was the cheaper arrangement.
      */}
      <div className="ui-horizon__content">{children}</div>
    </section>
  );
}

export default DashboardHorizon;
