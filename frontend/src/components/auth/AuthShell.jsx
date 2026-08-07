/**
 * File purpose:
 * The frame every unauthenticated screen sits in — Login, Register, Forgot
 * Password and Reset Password.
 *
 * PUBLIC API IS STABLE. The internals below were rewritten completely for the
 * fresh design programme, but these props are unchanged and all four routes
 * pass exactly what they passed before:
 *
 * - eyebrow     small line above the supporting panel's title
 * - title       the supporting panel's heading (desktop only)
 * - intro       one supporting sentence under it
 * - aside       optional extra supporting content (Login lists the roles)
 * - heading     the form column's own heading — this is the page's <h1>
 * - subheading  one line under the form heading
 * - children    the form
 * - footer      the links row beneath the form
 *
 * Keeping this contract stable is what let all four routes move onto the new
 * system in one atomic pass rather than one route at a time. AuthShell is
 * genuinely shared architecture: there is no state in which one route is
 * migrated and its siblings are not.
 *
 * Concept:
 * "Signing in is an act of routing, not passing a gate." Orientation,
 * progression and destination come from typography, position and the
 * Approach visual — never from coloured panels or signage.
 *
 * Composition:
 * NOT a split screen and NOT a card on a gradient; both are explicitly
 * rejected. The form sits directly on the canvas with no card behind it, and
 * the layout is asymmetric rather than bisected, so there is no seam down the
 * middle. `.auth-card` keeps its class name because four Playwright tests
 * assert on it; it is no longer a card in the visual sense.
 *
 * Reading order:
 * The form column is FIRST in the DOM now. Its heading is the page's single
 * <h1> and names the task ("Sign in"), not the product. The supporting panel
 * is placed to its right by grid, is entirely decorative, and is aria-hidden
 * so a screen reader reaches the form immediately.
 *
 * Mobile:
 * The supporting panel is hidden below 900px — on a phone a decorative panel
 * eating the top third just pushes the form under the fold. Rather than
 * leaving mobile as desktop-minus, the phone gets its own orientation mark:
 * a single resolved rule under the heading, costing about 2px of height
 * instead of a third of the viewport.
 *
 * Important notes:
 * - Presentational only. It owns no form state, performs no submission and
 *   makes no API call; each page keeps its own logic exactly as it was.
 */

import { Link } from "react-router-dom";

import Approach from "./Approach";

function AuthShell({
  eyebrow,
  title,
  intro,
  aside = null,
  heading,
  subheading,
  children,
  footer = null,
}) {
  return (
    <div className="auth-shell">
      {/*
        The form column, first in the DOM so the reading order starts with the
        thing the user came to do. Grid places it left of centre on desktop.
      */}
      <section className="auth-card">
        <header className="auth-card-head">
          {/* Visible on mobile only, where the supporting panel is hidden. */}
          <span className="auth-card-brand">Construction Portal</span>

          <h1>{heading}</h1>

          {/*
            The phone's orientation mark. A single resolved rule, echoing the
            resolved vector in Approach, so mobile carries the same idea at a
            cost the fold can afford. Decorative.
          */}
          <span className="auth-card-rule" aria-hidden="true" />

          {subheading ? (
            <p className="auth-card-sub">{subheading}</p>
          ) : null}
        </header>

        {children}

        {footer ? <div className="auth-links">{footer}</div> : null}
      </section>

      {/*
        The supporting panel. `aria-hidden` is deliberate: everything in it is
        decorative or already stated by the form column, and it is invisible on
        a phone anyway. Hiding it keeps a screen reader from reading a product
        blurb before reaching the sign-in form.
      */}
      <section className="auth-brand" aria-hidden="true">
        <Approach />

        <div className="auth-brand__body">
          {eyebrow ? <p className="auth-eyebrow">{eyebrow}</p> : null}

          {title ? <p className="auth-brand-title">{title}</p> : null}

          {intro ? <p className="auth-brand-intro">{intro}</p> : null}

          {aside}
        </div>
      </section>
    </div>
  );
}

/**
 * A link in the footer row.
 *
 * Exists so the four pages cannot each invent their own link styling, and so
 * the 44px target floor is applied in one place rather than four.
 */
export function AuthLink({ to, children }) {
  return (
    <Link className="auth-link" to={to}>
      {children}
    </Link>
  );
}

export default AuthShell;
