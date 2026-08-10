/**
 * File purpose:
 * The finance instrument's data → geometry pipeline. Pure functions only.
 *
 * Used by:
 * - components/finance/FinanceInstrument.jsx (rendering and motion)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SEPARATE, PURE MODULE
 * ─────────────────────────────────────────────────────────────────────────
 * Business calculations and animation code must not intermingle. Everything
 * here is a function of its arguments: no React, no DOM, no timers, no CSS, no
 * `Date.now()` reached for implicitly. That is what makes the pipeline
 * testable in isolation, and it is what keeps a motion bug from ever being
 * able to change a figure.
 *
 *   RAW PAYMENT ROWS → BUCKETS → OBSERVATIONS → DOMAIN → SCALES → GEOMETRY
 *                                                          └→ MORPH SCAFFOLD
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DATA SEMANTICS ARE INHERITED, NOT REINTERPRETED
 * ─────────────────────────────────────────────────────────────────────────
 * Verified against the existing Dashboard derivation and the backend writer
 * before a line of this was written, because a chart that quietly reclassifies
 * money is worse than no chart:
 *
 * - The date is `payment_date`, falling back to `created_at`. A row with
 *   neither is DROPPED, exactly as today.
 * - The bucket key is a STRING SLICE of the ISO date — never `new Date()`.
 *   Parsing would re-interpret a stored calendar date in the viewer's
 *   timezone and could move a payment across a day or month boundary. The
 *   existing chart slices; so does this.
 * - Direction is `payment_type`, an exact `"Income"` / `"Expense"` match,
 *   tested independently. The backend writes it as a strict binary derived
 *   from `payment_direction`, so there is no third category, and no refund or
 *   reversal type to handle.
 * - Net is `income - expense`, derived. It is never stored, never a series,
 *   and never something this file invents a number for.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THREE TIMEFRAMES, THREE HONEST SHAPES
 * ─────────────────────────────────────────────────────────────────────────
 * Today, This month and All time do not differ in scale. They differ in
 * GRANULARITY, so they differ in observation count, x-domain and y-domain at
 * once — which is the whole reason the morph needed proving in
 * `tools/chart/morph_model.py` before this existed.
 *
 *   today   one calendar day        →  0 or 1 observation
 *   month   days, 1st to today      →  a daily sequence including zero days
 *   all     months that have rows   →  a monthly sequence
 *
 * A day inside the month window with no payments is a real zero and is kept:
 * omitting it would compress the calendar and make a quiet fortnight look
 * like a busy one. Months with no payments are NOT synthesised, because that
 * is the behaviour the monthly chart already has and changing it would change
 * what the page has always said.
 *
 * Keys are granularity-prefixed, so a daily bucket can never be mistaken for a
 * monthly one during a morph. That is the mechanism behind the model's finding
 * that cross-granularity transitions have no shared observations at all.
 */

/** Bucket granularity per timeframe. The prefix is what keeps keys disjoint. */
const GRAIN = {
  today: { prefix: "d", cut: 10 },
  month: { prefix: "d", cut: 10 },
  all: { prefix: "m", cut: 7 },
};

/** Nodes in the tween scaffold. Enough to carry a month's shape; small enough
 * that a `d` string stays short. Matches the Python model. */
export const TWEEN_NODES = 64;

/** `payment_date`, else `created_at`, else the row is dropped. Inherited. */
function stampOf(payment) {
  const raw = payment.payment_date || payment.created_at;
  return typeof raw === "string" ? raw : raw ? String(raw) : "";
}

/** `YYYY-MM-DD` for a Date, assembled from local parts rather than through
 * `toISOString`, which would convert to UTC and can report yesterday. */
export function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Raw rows → real observations for one timeframe.
 *
 * `today` is the caller's idea of the current day, passed in rather than read,
 * so this stays pure and so a test can pin a date.
 */
export function observe(payments = [], timeframe = "all", today = isoDay(new Date())) {
  const grain = GRAIN[timeframe] || GRAIN.all;
  const monthPrefix = today.slice(0, 7);

  const totals = new Map();

  const add = (bucket, payment) => {
    let row = totals.get(bucket);
    if (!row) {
      row = { bucket, income: 0, expense: 0 };
      totals.set(bucket, row);
    }
    /* Two independent equality tests, exactly as the existing chart does.
     * A row that is somehow neither contributes to neither total. */
    if (payment.payment_type === "Income") row.income += Number(payment.amount || 0);
    if (payment.payment_type === "Expense") row.expense += Number(payment.amount || 0);
  };

  for (const payment of payments) {
    const stamp = stampOf(payment);
    if (!stamp) continue;

    const bucket = stamp.slice(0, grain.cut);
    if (bucket.length < grain.cut) continue;

    if (timeframe === "today" && bucket !== today) continue;
    if (timeframe === "month" && stamp.slice(0, 7) !== monthPrefix) continue;

    add(bucket, payment);
  }

  let buckets;
  if (timeframe === "today") {
    buckets = totals.has(today) ? [today] : [];
  } else if (timeframe === "month") {
    /* Every day from the 1st to today, so a quiet stretch reads as quiet.
     * Days are enumerated as strings; no Date arithmetic, no timezone. */
    const [y, m] = monthPrefix.split("-").map(Number);
    const last = Number(today.slice(8, 10));
    const days = new Date(y, m, 0).getDate();
    buckets = [];
    for (let d = 1; d <= Math.min(last, days); d += 1) {
      buckets.push(`${monthPrefix}-${String(d).padStart(2, "0")}`);
    }
    if (!totals.size) buckets = [];
  } else {
    buckets = [...totals.keys()].sort();
  }

  return buckets.map((bucket, i) => {
    const row = totals.get(bucket) || { income: 0, expense: 0 };
    return {
      key: `${grain.prefix}:${bucket}`,
      bucket,
      i,
      income: row.income,
      expense: row.expense,
      /* Derived, here, once. Nothing downstream recomputes it. */
      net: row.income - row.expense,
    };
  });
}

/**
 * y-domain, always including zero.
 *
 * A money chart that omits zero exaggerates every movement it draws, so the
 * baseline is the datum and the domain grows from it. Padded at the top only;
 * a padded baseline would put the zero line somewhere that is not zero.
 */
export function domainOf(observations) {
  if (!observations.length) return { lo: 0, hi: 1, empty: true };

  let hi = 0;
  for (const o of observations) hi = Math.max(hi, o.income, o.expense);

  if (hi <= 0) return { lo: 0, hi: 1, empty: false, flat: true };
  return { lo: 0, hi: hi * 1.08, empty: false, flat: false };
}

/** Componentwise domain interpolation. Axes move independently of the series;
 * a domain that snapped mid-tween would draw every intermediate frame against
 * a scale its geometry does not belong to. */
export function lerpDomain(a, b, t) {
  return { lo: a.lo + (b.lo - a.lo) * t, hi: a.hi + (b.hi - a.hi) * t, empty: false };
}

/**
 * Ticks on a 1/2/5 decade.
 *
 * A moving axis must land on numbers a reader would have chosen. The interval
 * is snapped before the labels are produced, so a tween never displays
 * something like 0.02 as though it were a considered value — the degenerate
 * case the morph model flagged.
 */
export function ticksOf({ lo, hi, empty }, count = 4) {
  if (empty || !(hi > lo)) return [];

  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).reduce((best, s) =>
    Math.abs(s - raw) < Math.abs(best - raw) ? s : best
  );

  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Number(v.toFixed(6)));
  }
  return out;
}

/** Value → y. One scale, one axis; there is never a second. */
export function scaleY({ lo, hi }, box) {
  const span = hi - lo || 1;
  return (v) => box.y + box.h - ((v - lo) / span) * box.h;
}

/** Index → x. A single observation sits at the LEFT datum rather than the
 * centre, because it is a measurement taken at a moment, not the midpoint of
 * a range that does not exist. */
export function scaleX(count, box) {
  if (count <= 1) return () => box.x;
  return (i) => box.x + (i / (count - 1)) * box.w;
}

/** A polyline through real observations. No smoothing: an interpolated curve
 * between two measurements asserts values that were never measured. */
export function pathOf(observations, field, x, y) {
  if (!observations.length) return "";
  return observations
    .map((o, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(o[field]).toFixed(2)}`)
    .join(" ");
}

/**
 * Resample onto TWEEN_NODES in NORMALISED x — the morph scaffold.
 *
 * Ported from the proven model. Normalised rather than absolute because the
 * two states have different calendars; a tween in absolute time would have to
 * invent a shared one. A tween in shape says "this picture became that
 * picture", which is what actually happened.
 *
 * SCAFFOLD NODES ARE NOT OBSERVATIONS. They are never labelled, never
 * inspected, never announced. The morph may invent geometry; it may never
 * invent a measurement.
 */
export function scaffold(observations, field, n = TWEEN_NODES) {
  /* Empty is the zero DATUM, not an absence of geometry — so a populated
   * state grows out of the baseline and collapses back onto it. Returning an
   * empty array here is what failed the model's first assertion. */
  if (!observations.length) return new Array(n).fill(0);
  if (observations.length === 1) return new Array(n).fill(observations[0][field]);

  const last = observations.length - 1;
  const out = new Array(n);

  for (let k = 0; k < n; k += 1) {
    const t = k / (n - 1);
    const pos = t * last;
    const j = Math.min(last - 1, Math.floor(pos));
    const f = pos - j;
    const a = observations[j][field];
    const b = observations[j + 1][field];
    out[k] = a + (b - a) * f;
  }
  return out;
}

/** Scaffold values → a `d` string under one scale. Both endpoints of a tween
 * produce the same node count, so the strings interpolate componentwise. */
export function scaffoldPath(values, box, y) {
  const n = values.length;
  if (!n) return "";
  return values
    .map((v, k) => {
      const px = box.x + (n === 1 ? 0 : (k / (n - 1)) * box.w);
      return `${k ? "L" : "M"}${px.toFixed(2)} ${y(v).toFixed(2)}`;
    })
    .join(" ");
}

/**
 * Which observations survive a timeframe change.
 *
 * Keys are granularity-prefixed, so this returns nothing shared across
 * granularities — correctly. A daily bucket and a monthly bucket are not the
 * same measurement, and pretending they are would make a travelling point a
 * false claim. Within a granularity, everything that persists travels.
 */
export function correspond(from, to) {
  const a = new Set(from.map((o) => o.key));
  const b = new Set(to.map((o) => o.key));
  return {
    stayed: to.filter((o) => a.has(o.key)).map((o) => o.key),
    entered: to.filter((o) => !a.has(o.key)).map((o) => o.key),
    exited: from.filter((o) => !b.has(o.key)).map((o) => o.key),
  };
}

/** Nearest REAL observation to a pointer position. Inspection never lands on
 * scaffolding, at any point in a transition. */
export function nearest(observations, px, box) {
  if (!observations.length) return null;
  if (observations.length === 1) return observations[0];

  const t = Math.max(0, Math.min(1, (px - box.x) / (box.w || 1)));
  return observations[Math.round(t * (observations.length - 1))];
}
