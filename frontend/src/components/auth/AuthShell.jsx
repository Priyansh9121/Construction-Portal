/**
 * File purpose:
 * The frame every unauthenticated screen sits in — Login, Register, Forgot
 * Password and Reset Password.
 *
 * PUBLIC API IS STABLE, AND THAT IS THE POINT. The frame inside has now been
 * replaced twice; these props have not changed once, and all four routes pass
 * exactly what they always passed:
 *
 * - eyebrow     small line above the supporting text
 * - title       the supporting text's heading (desktop only)
 * - intro       one supporting sentence under it
 * - aside       optional extra supporting content (Login lists the roles)
 * - heading     the form column's own heading — this is the page's <h1>
 * - subheading  one line under the form heading
 * - children    the form
 * - footer      the links row beneath the form
 *
 * A stable contract here is what lets all four routes move onto a new visual
 * world in one atomic pass instead of one route at a time. There is never a
 * state in which one auth route is migrated and its siblings are not.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS SCREEN IS NOW
 * ─────────────────────────────────────────────────────────────────────────
 * `PRODUCT_SOUL.md` is explicit that this product is not about construction —
 * it is about credibility. So authentication is not a gate and not a form on a
 * page. It is the one cinematic surface in the product: a site at dusk with
 * the day's work standing, and one raised plane in front of it holding the
 * only thing the user came to do.
 *
 * Everything after this screen is a light, quiet, operational instrument. The
 * contrast is deliberate and it is the whole reason `auth/transition.css`
 * exists: signing in brings the light up on structure that was already there.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT WAS REMOVED
 * ─────────────────────────────────────────────────────────────────────────
 * `Approach` — an abstract five-route convergence vector, drawn once, standing
 * for "signing in is an act of routing". It was a good drawing of a small
 * idea, and the scene now says something truer about the same moment. Two
 * decorative visuals on one screen is one too many, so it is deleted rather
 * than kept beside the scene.
 *
 * The mobile orientation rule went with it, for the same reason: it existed
 * only because the phone had no supporting visual, and the phone now gets the
 * scene itself.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * READING ORDER
 * ─────────────────────────────────────────────────────────────────────────
 * The form column is FIRST in the DOM. Its heading is the page's single <h1>
 * and names the task ("Sign in"), not the product. The supporting text follows
 * it and is `aria-hidden`, so a screen reader reaches the form immediately and
 * is never read a product blurb on the way in. Every scene layer is
 * `aria-hidden` too — the artwork carries no information.
 *
 * Important notes:
 * - Presentational only. It owns no form state, performs no submission and
 *   makes no API call; each page keeps its own logic exactly as it was.
 */

import { Link } from "react-router-dom";

import AuthScene from "./AuthScene";

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
    <AuthScene>
      <div className="auth-shell">
        {/*
          The form column. Named `.auth-card` for the test contract; it is a
          raised plane, which is the elevation rule applied rather than
          suspended — it is the only thing on this screen that can be acted on.
        */}
        <section className="auth-card">
          <header className="auth-card-head">
            <span className="auth-card-brand">Construction Portal</span>

            <h1>{heading}</h1>

            {subheading ? (
              <p className="auth-card-sub">{subheading}</p>
            ) : null}
          </header>

          {children}

          {footer ? <div className="auth-links">{footer}</div> : null}
        </section>

        {/*
          Supporting text. `aria-hidden` is deliberate: all of it is either
          decorative or already stated by the form column. It sits UNDER the
          plane in the same column rather than opposite it, which keeps the
          open half of the scene open and keeps this text inside the veil's
          dense end where its contrast is a known value.

          Hidden below 900px, where the form is the entire screen.
        */}
        <section className="auth-brand" aria-hidden="true">
          <div className="auth-brand__body">
            {eyebrow ? <p className="auth-eyebrow">{eyebrow}</p> : null}

            {title ? <p className="auth-brand-title">{title}</p> : null}

            {intro ? <p className="auth-brand-intro">{intro}</p> : null}

            {aside}
          </div>
        </section>
      </div>
    </AuthScene>
  );
}

/**
 * A link in the footer row.
 *
 * Exists so the four pages cannot each invent their own link styling, and so
 * the 44px target floor is applied in one place rather than four.
 *
 * `.focusable` is the foundation's opt-in for anything that takes focus but is
 * not a `.ctl`. Without it these two links fell through to the bare
 * `:focus-visible` rule in `core/foundation.css` and drew a #2563eb ring — a
 * legacy blue belonging to no palette on this screen, next to controls ringed
 * in the scene's indigo. A state probe caught it; no screenshot would have,
 * because focus rings only exist while a key is held.
 */
export function AuthLink({ to, children }) {
  return (
    <Link className="auth-link focusable" to={to}>
      {children}
    </Link>
  );
}

export default AuthShell;
