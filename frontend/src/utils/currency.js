/**
 * File purpose:
 * Currency and number formatting for display.
 *
 * Connected to:
 * - Used across the finance components, tables and exports
 * - The currency code comes from the company record loaded by AuthProvider
 *
 * Exports:
 * - formatCurrency — the only public entry point. getCurrencyCode and
 *   getCurrencyConfig are internal helpers it calls; they were exported
 *   with no consumer, as were getCurrencySymbol and
 *   formatCurrencyWithoutDecimals, which had no caller at all and are gone.
 *
 * Important notes:
 * - Formatting only. Never use these for arithmetic — money figures arrive
 *   from node-pg as STRINGS, and the backend recalculates every derived
 *   total anyway.
 */

const CURRENCY_CONFIG = {
    INR: {
      locale: "en-IN",
      currency: "INR",
      symbol: "₹",
    },
    AUD: {
      locale: "en-AU",
      currency: "AUD",
      symbol: "$",
    },
    USD: {
      locale: "en-US",
      currency: "USD",
      symbol: "$",
    },
    GBP: {
      locale: "en-GB",
      currency: "GBP",
      symbol: "£",
    },
    EUR: {
      locale: "en-IE",
      currency: "EUR",
      symbol: "€",
    },
    CAD: {
      locale: "en-CA",
      currency: "CAD",
      symbol: "$",
    },
    NZD: {
      locale: "en-NZ",
      currency: "NZD",
      symbol: "$",
    },
    AED: {
      locale: "en-AE",
      currency: "AED",
      symbol: "د.إ",
    },
    SGD: {
      locale: "en-SG",
      currency: "SGD",
      symbol: "$",
    },
    JPY: {
      locale: "ja-JP",
      currency: "JPY",
      symbol: "¥",
    },
  };
  
  function getCurrencyCode() {
    try {
      const preferences = JSON.parse(
        localStorage.getItem("appPreferences") || "{}"
      );
  
      return preferences.currency || "INR";
    } catch {
      return "INR";
    }
  }
  
  function getCurrencyConfig(
    currencyCode = getCurrencyCode()
  ) {
    return (
      CURRENCY_CONFIG[currencyCode] ||
      CURRENCY_CONFIG.INR
    );
  }
  
  /**
   * The same formatted value as `formatCurrency`, segmented for optical
   * typesetting.
   *
   * Lives here rather than in the component because it depends on
   * CURRENCY_CONFIG, and a second file resolving locale and currency code
   * would be a second source of truth that drifts the moment the config
   * changes. Nothing about the value, rounding or locale differs from
   * `formatCurrency` -- this returns the *same string*, in pieces.
   *
   * Uses `Intl.NumberFormat.formatToParts` so the segmentation is the
   * formatter's own. The Indian 2-2-3 grouping therefore comes from the
   * locale rather than from any string handling here, which is what keeps it
   * correct by construction.
   *
   * `formatted` is always the canonical string. If a runtime cannot segment,
   * or the reassembled pieces do not reproduce it exactly, `symbol` is null
   * and callers must render `formatted` whole rather than something prettier
   * that disagrees with the product's own formatter.
   *
   * A negative value carries its sign SEPARATELY. Bucketing the minus into the
   * digits reassembles as "₹-1,00,000.00" while the formatter produces
   * "-₹1,00,000.00", so the equality guard refuses to split and the figure
   * loses its optical treatment -- precisely when a negative cash position
   * matters most.
   *
   * @returns {{sign: string, symbol: string|null, digits: string, fraction: string, formatted: string}}
   */
  export function formatCurrencyParts(value, options = {}) {
    const {
      currencyCode = getCurrencyCode(),
      minimumFractionDigits = 2,
      maximumFractionDigits = 2,
    } = options;

    const config = getCurrencyConfig(currencyCode);
    const parsed = Number(value || 0);
    const safeNumber = Number.isFinite(parsed) ? parsed : 0;

    const formatted = formatCurrency(safeNumber, {
      currencyCode,
      minimumFractionDigits,
      maximumFractionDigits,
    });

    const formatter = new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.currency,
      minimumFractionDigits,
      maximumFractionDigits,
    });

    if (typeof formatter.formatToParts !== "function") {
      return { sign: "", symbol: null, digits: formatted, fraction: "", formatted };
    }

    let sign = "";
    let symbol = "";
    let digits = "";
    let fraction = "";
    let seenDecimal = false;

    for (const part of formatter.formatToParts(safeNumber)) {
      if (part.type === "minusSign" || part.type === "plusSign") {
        sign += part.value;
      } else if (part.type === "currency") {
        symbol += part.value;
      } else if (part.type === "decimal") {
        seenDecimal = true;
        fraction += part.value;
      } else if (seenDecimal) {
        fraction += part.value;
      } else {
        digits += part.value;
      }
    }

    /*
     * The guarantee. Locales that trail the currency mark, or order the sign
     * differently, will not reassemble in this order -- and rather than guess,
     * the treatment is abandoned and the canonical string is rendered whole.
     */
    if (`${sign}${symbol}${digits}${fraction}` !== formatted) {
      return { sign: "", symbol: null, digits: formatted, fraction: "", formatted };
    }

    return { sign, symbol, digits, fraction, formatted };
  }

  export function formatCurrency(
    value,
    options = {}
  ) {
    const {
      currencyCode = getCurrencyCode(),
      minimumFractionDigits = 2,
      maximumFractionDigits = 2,
    } = options;
  
    const config = getCurrencyConfig(currencyCode);
    const parsed = Number(value || 0);
    const safeNumber = Number.isFinite(parsed) ? parsed : 0;
  
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(safeNumber);
  }
