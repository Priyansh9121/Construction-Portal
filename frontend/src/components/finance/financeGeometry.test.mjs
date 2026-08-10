/*
 * Tests for the pure finance geometry pipeline.
 *
 * These exist to protect two things that a rendering test cannot see: that the
 * inherited payment semantics are reproduced EXACTLY, and that no transition
 * can ever produce a frame drawn off its own axis.
 *
 * Run: node --test src/components/finance/financeGeometry.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  observe, domainOf, lerpDomain, ticksOf, scaleY, scaleX, pathOf,
  scaffold, correspond, nearest, TWEEN_NODES, isoDay,
} from "./financeGeometry.js";

const TODAY = "2026-08-10";
const BOX = { x: 0, y: 0, w: 600, h: 200 };

const P = (date, type, amount) => ({ payment_date: date, payment_type: type, amount });

const ROWS = [
  P("2026-08-10", "Income", 182400),
  P("2026-08-10", "Expense", 40000),
  P("2026-08-03", "Income", 10000),
  P("2026-07-19", "Expense", 55000),
  P("2026-06-01", "Income", 120000),
];

test("inherited semantics: classification is two independent exact matches", () => {
  const rows = [P(TODAY, "Income", 100), P(TODAY, "Expense", 40), P(TODAY, "Transfer", 999)];
  const [o] = observe(rows, "today", TODAY);
  assert.equal(o.income, 100);
  assert.equal(o.expense, 40);
  // A row that is neither contributes to neither -- exactly as the page does.
  assert.equal(o.net, 60);
});

test("inherited semantics: created_at is the fallback, undated rows are dropped", () => {
  const rows = [
    { created_at: TODAY, payment_type: "Income", amount: 500 },
    { payment_type: "Income", amount: 9999 },
  ];
  const [o] = observe(rows, "today", TODAY);
  assert.equal(o.income, 500);
});

test("inherited semantics: the bucket is a string slice, never a parsed Date", () => {
  // A stamp with a time component that would shift a day under UTC parsing.
  const rows = [P("2026-08-10T23:30:00+05:30", "Income", 700)];
  const [o] = observe(rows, "today", TODAY);
  assert.equal(o.bucket, "2026-08-10");
});

test("today yields at most one observation, and none when the day is quiet", () => {
  assert.equal(observe(ROWS, "today", TODAY).length, 1);
  assert.equal(observe(ROWS, "today", "2026-08-09").length, 0);
});

test("month keeps quiet days as real zeros, 1st to today", () => {
  const m = observe(ROWS, "month", TODAY);
  assert.equal(m.length, 10);
  assert.equal(m[0].bucket, "2026-08-01");
  assert.equal(m.at(-1).bucket, "2026-08-10");
  assert.equal(m[1].income, 0, "a day with no payments is a real zero");
  assert.equal(m[2].income, 10000);
});

test("all time keeps only months that exist -- gaps are not synthesised", () => {
  const a = observe(ROWS, "all", TODAY);
  assert.deepEqual(a.map((o) => o.bucket), ["2026-06", "2026-07", "2026-08"]);
});

test("keys are granularity-prefixed, so no false correspondence is possible", () => {
  const month = observe(ROWS, "month", TODAY);
  const all = observe(ROWS, "all", TODAY);
  const { stayed } = correspond(month, all);
  assert.equal(stayed.length, 0, "a daily bucket is not a monthly bucket");
});

test("within a granularity every persisting observation travels", () => {
  const before = observe(ROWS, "all", TODAY);
  const after = observe([...ROWS, P("2026-09-02", "Income", 1)], "all", "2026-09-30");
  const { stayed, entered, exited } = correspond(before, after);
  assert.equal(stayed.length, 3);
  assert.equal(entered.length, 1);
  assert.equal(exited.length, 0, "adding a month must move nothing else");
});

test("the domain always contains zero", () => {
  const d = domainOf(observe(ROWS, "all", TODAY));
  assert.equal(d.lo, 0);
  assert.ok(d.hi > 0);
});

test("ticks land on 1/2/5 values and never on degenerate interpolation", () => {
  const t = ticksOf({ lo: 0, hi: 182400 * 1.08 });
  assert.ok(t.length >= 3);

  /* The 1/2/5 rule governs the STEP, not each value. A 50,000 step yields
   * 0 / 50,000 / 100,000 / 150,000, and 150,000 is a perfectly considered
   * number whose mantissa is 1.5 -- an earlier version of this assertion
   * tested the values and failed a correct implementation. */
  const step = t[1] - t[0];
  const mant = step / 10 ** Math.floor(Math.log10(step));
  assert.ok([1, 2, 5, 10].some((k) => Math.abs(mant - k) < 1e-9), `step ${step} is not 1/2/5`);
  for (let i = 1; i < t.length; i += 1) {
    assert.ok(Math.abs(t[i] - t[i - 1] - step) < 1e-6, "ticks are not evenly spaced");
  }
  assert.deepEqual(ticksOf({ lo: 0, hi: 1, empty: true }), [], "empty draws no axis");
});

test("scaffolds always match in length, so paths interpolate componentwise", () => {
  const states = [[], observe(ROWS, "today", TODAY), observe(ROWS, "month", TODAY), observe(ROWS, "all", TODAY)];
  for (const a of states) {
    for (const b of states) {
      const sa = scaffold(a, "income");
      const sb = scaffold(b, "income");
      assert.equal(sa.length, TWEEN_NODES);
      assert.equal(sb.length, TWEEN_NODES);
    }
  }
});

test("empty is the zero datum, so geometry grows out of the baseline", () => {
  assert.deepEqual(scaffold([], "income"), new Array(TWEEN_NODES).fill(0));
});

test("no intermediate frame is ever drawn outside its own interpolated domain", () => {
  const states = [[], observe(ROWS, "today", TODAY), observe(ROWS, "month", TODAY), observe(ROWS, "all", TODAY)];
  for (const a of states) {
    for (const b of states) {
      const da = domainOf(a), db = domainOf(b);
      const sa = scaffold(a, "income"), sb = scaffold(b, "income");
      for (const t of [0, 0.17, 0.5, 0.83, 1]) {
        const dom = lerpDomain(da, db, t);
        for (let i = 0; i < TWEEN_NODES; i += 1) {
          const v = sa[i] + (sb[i] - sa[i]) * t;
          assert.ok(Number.isFinite(v), "non-finite tween value");
          assert.ok(v >= dom.lo - 1e-6 && v <= dom.hi + 1e-6,
            `value ${v} outside domain [${dom.lo}, ${dom.hi}] at t=${t}`);
        }
      }
    }
  }
});

test("a single observation sits on the left datum, not floating mid-plot", () => {
  const x = scaleX(1, BOX);
  assert.equal(x(0), BOX.x);
});

test("inspection snaps to a real observation at every position", () => {
  const m = observe(ROWS, "month", TODAY);
  for (let px = -50; px <= 650; px += 25) {
    const hit = nearest(m, px, BOX);
    assert.ok(m.includes(hit), "inspection landed on something that is not an observation");
  }
  assert.equal(nearest([], 10, BOX), null);
});

test("the path passes through measured values only -- no smoothing", () => {
  const o = observe(ROWS, "all", TODAY);
  const d = pathOf(o, "income", scaleX(o.length, BOX), scaleY(domainOf(o), BOX));
  assert.equal((d.match(/[ML]/g) || []).length, o.length);
  assert.ok(!/[CQS]/.test(d), "a curve command asserts values that were never measured");
});

test("isoDay uses local parts, so it cannot report yesterday", () => {
  assert.equal(isoDay(new Date(2026, 7, 10, 23, 45)), "2026-08-10");
});
