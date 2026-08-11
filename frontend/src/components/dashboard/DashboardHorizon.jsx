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
 * Cost: inline SVG generated at build time, no request, no decode. Every
 * animated property is `transform` or `opacity`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE BAND IS NOW A WINDOW ONTO A WORLD
 * ─────────────────────────────────────────────────────────────────────────
 * This component previously drew a single orthographic elevation. An
 * elevation has no depth: it cannot parallax, cannot occlude, cannot carry
 * light across surfaces at different distances, and cannot vary — which is
 * why, recorded and reviewed, it read as a watermark in a header rather than
 * as a place.
 *
 * The drawing is now five depth planes from a seeded generator, and this
 * section is the frame that holds the window onto them. Its job is unchanged
 * and deliberately small: wrap the attention list, clip the environment to
 * the top of the section so it sits behind the greeting and the headline —
 * which are words — and stop above the rows, which are figures.
 */

import World from "../environment/World";

function DashboardHorizon({ children, active = 0, alert = 0 }) {
  return (
    <section className="ui-horizon">
      {/*
        The window. `aria-hidden` on the SVG itself because it carries no
        information: it is a generic site, identical for every company, and
        announcing it would put decoration in front of the sentence a
        screen-reader user actually needs.

        The band's world is a DIFFERENT seed from the room's. They are the
        same site seen from two distances; sharing a seed would make the
        window look like a magnified crop of the wall behind it.
      */}
      {/* The site itself continues into the field workspace. */}
      <div className="ui-world ui-world--band" data-origin="site">
        <World variant="register" surface="band" lights dust active={active} alert={alert} />
        <span className="ui-world__light" />
      </div>

      <div className="ui-horizon__content">{children}</div>
    </section>
  );
}

export default DashboardHorizon;
