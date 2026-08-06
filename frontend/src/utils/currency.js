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
