/**
 * The Dashboard's flagship finance visualisation: a structural section.
 *
 * The datum is a beam. Income loads above it, expense below it, so the derived
 * net is WHICH SIDE DOMINATES — legible before a number is read. That is why
 * net is never drawn as a third series: income and expense already define it,
 * and a third path would add a colour identity to a value that has none.
 *
 * Both quantities are positive magnitudes measured off one datum. Expense is
 * drawn downward as direction, not as a negative amount, and the axis is
 * labelled on both sides so it cannot be read as signed money.
 *
 * Geometry comes entirely from ./financeGeometry.js. Nothing here computes a
 * financial value.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  observe,
  domainOf,
  lerpDomain,
  ticksOf,
  correspond,
  isoDay,
} from "./financeGeometry";
import useTween from "./useTween";
import { formatCurrency } from "../../utils/currency";

const FRAMES = [
  { id: "today", label: "Today" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const MORPH_MS = 620;

/** Compact axis labels. Indian magnitudes, because the figures are rupees. */
function shortMoney(n) {
  const v = Math.abs(n);
  if (v >= 1e7) return `${(n / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `${(n / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}

/** `2026-08-10` / `2026-08` → a spoken and printed label. */
function bucketLabel(bucket) {
  const [y, m, d] = bucket.split("-");
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, {
    month: "short",
  });
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`;
}

function FinanceInstrument({ payments = [], onRecordPayment }) {
  const [frame, setFrame] = useState("all");
  const [box, setBox] = useState({ w: 720, h: 300 });
  const [cursor, setCursor] = useState(null);

  /* Observations leaving the instrument stay rendered until their bay has
   * collapsed onto the datum. Without this they would simply stop existing on
   * the frame the timeframe changed, which is the blink this whole component
   * exists to avoid. */
  const [exiting, setExiting] = useState([]);

  const hostRef = useRef(null);
  const svgRef = useRef(null);
  const bayRefs = useRef(new Map());
  const tickRefs = useRef(new Map());
  const tween = useTween();

  const today = useMemo(() => isoDay(new Date()), []);
  const states = useMemo(
    () => ({
      today: observe(payments, "today", today),
      month: observe(payments, "month", today),
      all: observe(payments, "all", today),
    }),
    [payments, today]
  );

  const obs = states[frame];
  const domain = useMemo(() => domainOf(obs), [obs]);
  /* Zero is drawn as the beam, so it is never also a tick: the label collided
   * with the datum line and restated what the heaviest line already says. */
  const ticks = useMemo(() => ticksOf(domain, 2).filter((t) => t !== 0), [domain]);

  /* The instrument measures itself. Its composition is a function of how wide
   * it actually is, and a breakpoint would only approximate that. */
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setBox({ w, h: w < 520 ? 250 : 300 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = box.w < 520;
  const solo = states[frame].length === 1;

  /* A single measurement is still set out from the LEFT datum -- that decision
   * belongs to the geometry pipeline and is not overridden here. What changes
   * is the MARGIN it is drawn in: one 22px load stretched across a 1089px
   * plot left the composition hanging off the left edge against the axis
   * labels, which a screenshot showed immediately. Indenting the plot moves
   * the margin, not the datum. */
  const pad = {
    l: (narrow ? 40 : 52) + (solo ? (narrow ? 22 : 56) : 0),
    r: narrow ? 44 : 96,
    t: 22,
    b: 26,
  };
  const plot = {
    x: pad.l,
    y: pad.t,
    w: Math.max(40, box.w - pad.l - pad.r),
    h: Math.max(80, box.h - pad.t - pad.b),
  };
  const mid = plot.y + plot.h / 2;
  const half = plot.h / 2;

  const scaleOf = useCallback(
    (dom) => {
      const hi = dom.hi || 1;
      return (v) => mid - (v / hi) * half;
    },
    [mid, half]
  );

  const xOf = useCallback(
    (i, count) => (count <= 1 ? plot.x : plot.x + (i / (count - 1)) * plot.w),
    [plot.x, plot.w]
  );

  const single = obs.length === 1;
  const bayWidth = single
    ? 22
    : Math.max(2.5, Math.min(16, (plot.w / Math.max(1, obs.length - 1)) * 0.42));

  /* ---------------------------------------------------------------------
   * The morph.
   *
   * Bays are keyed. A key present in both states TRAVELS; a key present in
   * only one grows from, or collapses onto, the datum — which is the exact
   * truth, because a bay absent from a timeframe has no value there. Nothing
   * is reused as a different observation, so a moving bar is always the same
   * measurement. Across granularities `correspond` reports nothing shared,
   * correctly, and every bay enters or exits.
   *
   * The domain interpolates with the bays. A snapping scale would draw every
   * intermediate frame against a domain its geometry does not belong to.
   * ------------------------------------------------------------------- */
  const prev = useRef({ frame: "all", obs: [], domain: { lo: 0, hi: 1 } });

  useEffect(() => {
    const from = prev.current;
    prev.current = { frame, obs, domain };

    if (from.frame === frame) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const { stayed } = correspond(from.obs, obs);
    const stayedSet = new Set(stayed);
    const fromIndex = new Map(from.obs.map((o, i) => [o.key, i]));
    const fromByKey = new Map(from.obs.map((o) => [o.key, o]));

    const plan = obs.map((o, i) => {
      const shared = stayedSet.has(o.key);
      const src = shared ? fromByKey.get(o.key) : null;
      return {
        key: o.key,
        x0: shared ? xOf(fromIndex.get(o.key), from.obs.length) : xOf(i, obs.length),
        x1: xOf(i, obs.length),
        in0: src ? src.income : 0,
        in1: o.income,
        ex0: src ? src.expense : 0,
        ex1: o.expense,
      };
    });

    const leaving = from.obs.filter((o) => !obs.some((n) => n.key === o.key));
    setExiting(leaving);

    const gone = leaving.map((o) => {
      const at = xOf(fromIndex.get(o.key), from.obs.length);
      return {
        key: `gone:${o.key}`,
        /* An exiting bay collapses where it stood. Sliding it somewhere else
         * on the way out would assert a correspondence that does not exist. */
        x0: at,
        x1: at,
        in0: o.income,
        in1: 0,
        ex0: o.expense,
        ex1: 0,
      };
    });

    const all = [...plan, ...gone];

    tween.run(
      reduced ? 0 : MORPH_MS,
      (t) => {
        const dom = lerpDomain(from.domain, domain, t);
        const y = scaleOf(dom);

        for (const b of all) {
          const node = bayRefs.current.get(b.key);
          if (!node) continue;
          const x = b.x0 + (b.x1 - b.x0) * t;
          const income = b.in0 + (b.in1 - b.in0) * t;
          const expense = b.ex0 + (b.ex1 - b.ex0) * t;
          node.up?.setAttribute("x", x - bayWidth / 2);
          node.up?.setAttribute("y", y(income));
          node.up?.setAttribute("height", Math.max(0, mid - y(income)));
          node.down?.setAttribute("x", x - bayWidth / 2);
          node.down?.setAttribute("height", Math.max(0, y(-expense) - mid));
          node.span?.setAttribute("x1", x);
          node.span?.setAttribute("x2", x);
          node.span?.setAttribute("y1", y(income));
          node.span?.setAttribute("y2", y(-expense));
        }

        /* The axis participates, and its LABELS never show an interpolated
         * number. Each tick is rendered at its final, defensible 1/2/5 value
         * and displaced to where the interpolated domain would put it, so the
         * scale travels while every visible figure stays one a reader would
         * have chosen. */
        const settled = scaleOf(domain);
        for (const [value, node] of tickRefs.current) {
          if (!node) continue;
          node.style.transform = `translateY(${y(value) - settled(value)}px)`;
        }
      },
      () => {
        setExiting([]);
        tickRefs.current.forEach((n) => n && (n.style.transform = ""));
      }
    );
  }, [frame, obs, domain, bayWidth, mid, scaleOf, xOf, tween]);

  /* ---------------------------------------------------------------------
   * Inspection. Pointer, touch and keyboard all resolve to ONE index into the
   * real observations — scaffolding and interpolated geometry are never
   * reachable. The readout is derived from the observation, never from pixels.
   * ------------------------------------------------------------------- */
  const pick = useCallback(
    (clientX) => {
      const el = svgRef.current;
      if (!el || !obs.length) return;
      const rect = el.getBoundingClientRect();
      const t = (clientX - rect.left - plot.x) / (plot.w || 1);
      const i = Math.round(Math.max(0, Math.min(1, t)) * (obs.length - 1));
      setCursor(i);
    },
    [obs.length, plot.x, plot.w]
  );

  const onKeyDown = (e) => {
    if (!obs.length) return;
    const at = cursor ?? 0;
    let next = null;
    if (e.key === "ArrowRight") next = Math.min(obs.length - 1, at + 1);
    if (e.key === "ArrowLeft") next = Math.max(0, at - 1);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = obs.length - 1;
    if (next === null) return;
    e.preventDefault();
    setCursor(next);
  };

  const active = cursor !== null && obs[cursor] ? obs[cursor] : null;
  const y = scaleOf(domain);

  const empty = obs.length === 0;

  const registerBay = (key) => (el) => {
    if (!el) {
      bayRefs.current.delete(key);
      return;
    }
    bayRefs.current.set(key, {
      up: el.querySelector("[data-up]"),
      down: el.querySelector("[data-down]"),
      span: el.querySelector("[data-span]"),
    });
  };

  return (
    <section className="ui-fin" aria-labelledby="fin-heading" ref={hostRef}>
      <div className="ui-fin__head">
        <h2 id="fin-heading" className="ui-fin__title">
          Money movement
        </h2>

        {/*
          The timeframe control is part of the instrument. The selected rail
          travels rather than the highlight blinking between buttons, so the
          selection and the geometry change read as one causal event.
        */}
        <div
          className="ui-fin__frames"
          role="tablist"
          aria-label="Timeframe"
          style={{ "--at": FRAMES.findIndex((f) => f.id === frame) }}
        >
          <span className="ui-fin__rail" aria-hidden="true" />
          {FRAMES.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={frame === f.id}
              className="ui-fin__frame"
              onClick={() => {
                setCursor(null);
                setFrame(f.id);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="ui-fin__empty">
          <p className="ui-fin__empty-title">
            {frame === "today"
              ? "Nothing recorded today."
              : "No payments recorded yet."}
          </p>
          <p className="ui-fin__empty-body">
            {frame === "today"
              ? "The instrument reads from the day's payments. It fills in as they are recorded."
              : "Income and expense appear here against a common datum once the first payment is logged."}
          </p>
          {onRecordPayment ? (
            <button type="button" className="ui-fin__empty-action" onClick={onRecordPayment}>
              Record a payment
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <svg
            ref={svgRef}
            className="ui-fin__svg"
            viewBox={`0 0 ${box.w} ${box.h}`}
            width={box.w}
            height={box.h}
            role="img"
            tabIndex={0}
            aria-label={`Money movement, ${
              FRAMES.find((f) => f.id === frame).label
            }. ${obs.length} ${obs.length === 1 ? "observation" : "observations"}. ${
              active
                ? `Selected ${bucketLabel(active.bucket)}: income ${formatCurrency(
                    active.income
                  )}, expense ${formatCurrency(active.expense)}, net ${
                    active.net >= 0 ? "plus" : "minus"
                  } ${formatCurrency(Math.abs(active.net))}.`
                : "Use the arrow keys to inspect each observation."
            }`}
            onKeyDown={onKeyDown}
            onPointerMove={(e) => e.pointerType !== "touch" && pick(e.clientX)}
            onPointerLeave={() => setCursor(null)}
            onBlur={() => setCursor(null)}
          >
            {/* Scale. Two stops per side; more on a section is a ruler. */}
            {ticks.map((t) => (
              <g
                key={t}
                className="ui-fin__tick"
                ref={(el) => {
                  if (el) tickRefs.current.set(t, el);
                  else tickRefs.current.delete(t);
                }}
              >
                <line x1={plot.x} y1={y(t)} x2={plot.x + plot.w} y2={y(t)} />
                <line x1={plot.x} y1={y(-t)} x2={plot.x + plot.w} y2={y(-t)} />
                <text x={plot.x - 8} y={y(t) + 4} textAnchor="end">
                  {shortMoney(t)}
                </text>
                <text x={plot.x - 8} y={y(-t) + 4} textAnchor="end">
                  {shortMoney(t)}
                </text>
              </g>
            ))}

            <g className="ui-fin__bays">
              {exiting.map((o) => (
                <g
                  key={`gone:${o.key}`}
                  ref={registerBay(`gone:${o.key}`)}
                  className="ui-fin__bay ui-fin__bay--leaving"
                  aria-hidden="true"
                >
                  <rect data-up className="ui-fin__in" width={bayWidth} />
                  <rect data-down className="ui-fin__out" y={mid} width={bayWidth} />
                </g>
              ))}

              {obs.map((o, i) => (
                <g
                  key={o.key}
                  ref={registerBay(o.key)}
                  className="ui-fin__bay"
                  data-active={cursor === i ? "1" : undefined}
                  style={{ "--i": i }}
                >
                  {!single ? (
                    <line
                      data-span
                      className="ui-fin__span"
                      x1={xOf(i, obs.length)}
                      y1={y(o.income)}
                      x2={xOf(i, obs.length)}
                      y2={y(-o.expense)}
                    />
                  ) : null}
                  <rect
                    data-up
                    className="ui-fin__in"
                    x={xOf(i, obs.length) - bayWidth / 2}
                    y={y(o.income)}
                    width={bayWidth}
                    height={Math.max(0, mid - y(o.income))}
                  />
                  <rect
                    data-down
                    className="ui-fin__out"
                    x={xOf(i, obs.length) - bayWidth / 2}
                    y={mid}
                    width={bayWidth}
                    height={Math.max(0, y(-o.expense) - mid)}
                  />
                </g>
              ))}
            </g>

            {/* The beam. Heaviest line in the drawing: everything is measured
                from it, and it is what makes the two sides one reading. */}
            <line
              className="ui-fin__datum"
              x1={plot.x - 12}
              y1={mid}
              x2={plot.x + plot.w + 12}
              y2={mid}
            />

            {single ? (
              <SingleInstant
                o={obs[0]}
                x={xOf(0, 1)}
                y={y}
                mid={mid}
                narrow={narrow}
                width={box.w}
                top={plot.y}
                bottom={plot.y + plot.h}
              />
            ) : (
              <>
                {/* Clear of the last bay: at +8 these sat on top of it. */}
                <text className="ui-fin__side" x={plot.x + plot.w + 22} y={y(domain.hi * 0.5)}>
                  IN
                </text>
                <text className="ui-fin__side" x={plot.x + plot.w + 22} y={y(-domain.hi * 0.5)}>
                  OUT
                </text>
              </>
            )}

            {active && !single ? (
              <g className="ui-fin__cursor" aria-hidden="true">
                <line
                  x1={xOf(cursor, obs.length)}
                  y1={plot.y}
                  x2={xOf(cursor, obs.length)}
                  y2={plot.y + plot.h}
                />
              </g>
            ) : null}

            {/* One wide inspection surface. Touch never needs to find a bar. */}
            <rect
              className="ui-fin__surface"
              x={0}
              y={0}
              width={box.w}
              height={box.h}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                pick(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons || e.pointerType === "touch") pick(e.clientX);
              }}
              onPointerUp={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
            />
          </svg>

          <div className="ui-fin__readout" aria-live="off">
            {active ? (
              <>
                <span className="ui-fin__when">{bucketLabel(active.bucket)}</span>
                <span className="ui-fin__pair">
                  <i className="ui-fin__swatch ui-fin__swatch--in" aria-hidden="true" />
                  In <b>{formatCurrency(active.income)}</b>
                </span>
                <span className="ui-fin__pair">
                  <i className="ui-fin__swatch ui-fin__swatch--out" aria-hidden="true" />
                  Out <b>{formatCurrency(active.expense)}</b>
                </span>
                <span className="ui-fin__pair ui-fin__pair--net">
                  Net{" "}
                  <b>
                    {active.net >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(active.net))}
                  </b>
                </span>
              </>
            ) : (
              <span className="ui-fin__hint">
                Move across the section, or use the arrow keys, to inspect a
                {frame === "all" ? " month" : " day"}.
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * TODAY. One measurement, composed as a measured assembly rather than as a
 * chart with one point: two loads off the beam and a dimensioned separation
 * carrying the derived net. No trend is implied because there is none.
 */
function SingleInstant({ o, x, y, mid, narrow, width, top, bottom }) {
  const yi = y(o.income);
  const ye = y(-o.expense);

  /* Captions are clamped inside the plot. The income load sits ~4% below the
   * top of the domain, so a caption 26px above it was clipped by the
   * container at 390 -- caught in a screenshot, not by any assertion. */
  const capIn = Math.max(top + 10, yi - 26);
  const capOut = Math.min(bottom - 4, ye + 35);
  const bx = Math.min(x + (narrow ? 74 : 128), width - (narrow ? 96 : 150));

  return (
    <g className="ui-fin__single">
      <path
        className="ui-fin__dim"
        d={`M${x + 16} ${yi} H${bx} M${bx} ${yi} V${ye} M${x + 16} ${ye} H${bx}`}
      />
      <path
        className="ui-fin__dim"
        d={`M${bx - 4} ${yi + 7} l4 -7 l4 7 M${bx - 4} ${ye - 7} l4 7 l4 -7`}
      />
      <text className="ui-fin__dim-t" x={bx + 9} y={mid - 3}>
        NET
      </text>
      <text className="ui-fin__dim-v" x={bx + 9} y={mid + 15}>
        {o.net >= 0 ? "+" : "−"}
        {formatCurrency(Math.abs(o.net))}
      </text>

      {/* Above the load and above the bracket arm. The first version put the
          caption 6px BELOW the figure, which is exactly where the dimension
          line runs. */}
      <text className="ui-fin__load-t" x={x + 18} y={capIn}>
        INCOME
      </text>
      <text className="ui-fin__load" x={x + 18} y={capIn + 17}>
        {formatCurrency(o.income)}
      </text>
      <text className="ui-fin__load" x={x + 18} y={capOut - 15}>
        {formatCurrency(o.expense)}
      </text>
      <text className="ui-fin__load-t" x={x + 18} y={capOut}>
        EXPENSE
      </text>
    </g>
  );
}

export default FinanceInstrument;
