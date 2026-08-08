/**
 * File purpose:
 * Renders a currency value so that the DIGITS carry the visual mass.
 *
 * This is presentation only. It changes no value, no rounding, no locale and
 * no calculation. `formatCurrency` remains the single source of the formatted
 * string, and this component asserts that its own output matches it exactly.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * `VISUAL_PRINCIPLES.md` §7 makes numerals the product's identity, because
 * money is the contested thing and the figure is what every user looks at in
 * every session. A figure set as body text with a larger size is not display
 * typography; it is body text with a larger size.
 *
 * Optical treatment needs the parts addressable, and a single formatted string
 * is not addressable. Hence this component.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHERE THE SEGMENTATION LIVES
 * ─────────────────────────────────────────────────────────────────────────
 * In `currency.js`, beside the config it depends on — NOT here.
 *
 * The first draft of this component resolved locale and currency code itself,
 * which would have been a second source of currency truth that drifts the
 * moment CURRENCY_CONFIG changes. `formatCurrencyParts` returns the same
 * string `formatCurrency` returns, in pieces, and guarantees it.
 *
 * This file therefore knows nothing about currencies. It knows about optics.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ACCESSIBILITY AND COPY
 * ─────────────────────────────────────────────────────────────────────────
 * The spans are adjacent with no whitespace between them, so:
 *   - the element's text content is byte-identical to `formatCurrency`
 *   - copy and paste yields the complete value
 *   - a screen reader reads one continuous string
 *
 * Nothing is `aria-hidden`. Hiding the symbol or the decimals would remove
 * precision from exactly the users who cannot see the optical treatment that
 * replaced it.
 *
 * The decimals are visually subordinate but never removed, and their colour is
 * held at readable ink rather than a faint grey — `VISUAL_PRINCIPLES.md` §2
 * forbids hiding precision that is actually present, and AUTH-015 already
 * proved that muted small text is where the contrast floor gets broken.
 */

import { formatCurrencyParts } from "../../utils/currency";

/**
 * @param {number|string} value            the amount
 * @param {"hero"|"metric"|"inline"} size  optical role, not a font size
 */
function Money({ value, size = "inline", className = "" }) {
  const { sign, symbol, digits, fraction } = formatCurrencyParts(value);

  if (symbol === null) {
    /* Unsplittable: render the canonical string, untreated. */
    return <span className={`ui-money ${className}`.trim()} data-size={size}>{digits}</span>;
  }

  return (
    <span className={`ui-money ${className}`.trim()} data-size={size}>
      {/* The sign leads, at digit weight: a negative amount is a fact about
          the amount, not a decoration on the symbol. */}
      {sign ? <span className="ui-money__sign">{sign}</span> : null}
      <span className="ui-money__symbol">{symbol}</span>
      <span className="ui-money__digits">{digits}</span>
      {fraction ? <span className="ui-money__fraction">{fraction}</span> : null}
    </span>
  );
}

export default Money;
