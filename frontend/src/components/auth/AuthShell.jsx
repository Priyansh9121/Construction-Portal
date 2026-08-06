/**
 * File purpose:
 * The frame every unauthenticated screen sits in — Login, Register, Forgot
 * Password and Reset Password.
 *
 * Why it exists:
 * All four pages carried the same `.login-shell` → `.login-brand` +
 * `.login-box` markup, each with its own copy of the eyebrow, the heading
 * and the supporting paragraph. Four copies of one layout is four places to
 * fix a spacing bug and four chances for them to drift apart. This is the
 * clearest case of proven repetition in the codebase: two consumers is the
 * bar, and this had four.
 *
 * Props:
 * - eyebrow   small uppercase line above the brand heading
 * - title     the brand-panel heading (desktop only)
 * - intro     one supporting sentence under it
 * - aside     optional extra brand-panel content (Login lists the roles)
 * - heading   the form card's own heading — this is the page's <h1>
 * - subheading  one line under the form heading
 * - children  the form
 * - footer    the links row beneath the form
 *
 * Layout:
 * Mobile-first single column. The brand panel is hidden below 900px — on a
 * phone the form is the only thing that matters, and a decorative panel
 * eating the top third of the screen just pushes it under the fold. Above
 * 900px it returns as the left half of a two-panel layout.
 *
 * Heading order:
 * The form card's heading is the page's `<h1>`; the brand panel's title is an
 * `<h2>` that follows it in the accessibility tree despite appearing first
 * visually. That keeps one h1 per page and makes it the thing the user came
 * to do ("Sign In"), not the product's own name. axe checks heading order,
 * so this is asserted rather than assumed.
 *
 * Important notes:
 * - Presentational only. It owns no form state, performs no submission and
 *   makes no API call; each page keeps its own logic exactly as it was.
 */

import { Link } from "react-router-dom";

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
        The supporting panel. `aria-hidden` is deliberate: everything in it
        is decorative or duplicated by the form card, and it is invisible on
        a phone anyway. Hiding it keeps a screen reader from reading the
        product blurb before reaching the sign-in form.
      */}
      <section className="auth-brand" aria-hidden="true">
        <span className="auth-brand-mark" />

        {eyebrow ? <p className="auth-eyebrow">{eyebrow}</p> : null}

        {title ? <p className="auth-brand-title">{title}</p> : null}

        {intro ? <p className="auth-brand-intro">{intro}</p> : null}

        {aside}
      </section>

      <section className="auth-card">
        <header className="auth-card-head">
          {/* Visible on mobile only, where the brand panel is hidden. */}
          <span className="auth-card-brand">
            <span className="auth-brand-mark" aria-hidden="true" />
            Construction Portal
          </span>

          <h1>{heading}</h1>

          {subheading ? (
            <p className="auth-card-sub">{subheading}</p>
          ) : null}
        </header>

        {children}

        {footer ? <div className="auth-links">{footer}</div> : null}
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
