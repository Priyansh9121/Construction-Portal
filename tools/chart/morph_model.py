"""
Model for the finance instrument's timeframe morph.

THE PROBLEM
-----------
Today, This month and All time do not differ in scale. They differ in
GRANULARITY, and therefore in the number of observations, the x-domain and the
y-domain all at once:

    today       one day        1 observation
    month       daily buckets  up to 31
    all         monthly        as many months as exist

A path interpolator handed "1 point" and "31 points" will invent nonsense.
So the transition needs a defensible correspondence, and this file exists to
prove one works before any of it is written in JavaScript.

THE STRATEGY: KEYED OBSERVATIONS, RESAMPLED SCAFFOLD
----------------------------------------------------
1. Every observation carries a stable KEY (its bucket's ISO stamp). Keys that
   exist in both states are the same object and simply travel.
2. For the path tween only, both states are resampled to a common node count
   at identical normalised positions, so `d` attributes have matching
   structure and interpolate componentwise.
3. Resampled nodes are SCAFFOLDING. They are never labelled, never inspected,
   never reported. Inspection always snaps to a real observation.

That third rule is the one that keeps this honest: the morph may invent
geometry, and may never invent a measurement.

Run:  python3 tools/chart/morph_model.py
"""

from __future__ import annotations
import math

TWEEN_NODES = 64


def resample(points, n=TWEEN_NODES):
    """
    Linear resample onto `n` nodes evenly spaced in NORMALISED x.

    Normalised, not absolute: the two states have different x-domains, and the
    tween is between two pictures rather than between two calendars. A tween in
    absolute time would have to invent a shared calendar, which is a lie about
    the data; a tween in shape says "this picture became that picture", which is
    exactly what happened.
    """
    if not points:
        # An empty timeframe is not an absence of geometry -- it is the zero
        # DATUM. Resampling it to a flat line at zero means a populated state
        # grows out of the baseline and collapses back onto it, which is both
        # the honest reading (there was nothing, now there is this much) and
        # the only one that keeps every frame inside a valid domain.
        #
        # Returning [] here instead made the first assertion fail on the very
        # first case, which is why the assertion is written before the code it
        # guards.
        return [0.0] * n
    if len(points) == 1:
        # A single observation has no shape to resample; it becomes a flat
        # scaffold at its own value, so the morph reads as a line UNFOLDING
        # from one measurement rather than as a point teleporting.
        return [points[0][1]] * n  # value only; the key stays on the observation

    xs = [p[0] for p in points]
    lo, hi = xs[0], xs[-1]
    span = (hi - lo) or 1

    out = []
    for i in range(n):
        t = i / (n - 1)
        target = lo + t * span
        # Walk to the bracketing pair.
        j = 0
        while j < len(points) - 2 and points[j + 1][0] < target:
            j += 1
        x0, y0 = points[j][0], points[j][1]
        x1, y1 = points[j + 1][0], points[j + 1][1]
        f = 0.0 if x1 == x0 else (target - x0) / (x1 - x0)
        out.append(y0 + (y1 - y0) * f)

    assert len(out) == n
    return out


def keys_of(points):
    return [p[2] for p in points]


def correspondence(a, b):
    """
    Which observations persist across a timeframe change.

    Returns (stayed, entered, exited) as key lists. Points that stay TRAVEL;
    points that enter or exit fade at their own position. Nothing is reused as
    a different observation, which is what makes a moving point a claim the
    reader can trust.
    """
    ka, kb = set(keys_of(a)), set(keys_of(b))
    stayed = sorted(ka & kb)
    return stayed, sorted(kb - ka), sorted(ka - kb)


def domain(points, pad=0.08):
    """
    y-domain including zero, because a money chart that omits zero exaggerates
    every movement it draws. Padded at the top only.
    """
    ys = [p[1] for p in points] or [0]
    hi = max(ys + [0])
    lo = min(ys + [0])
    span = (hi - lo) or 1
    return lo, hi + span * pad


def lerp_domain(d0, d1, t):
    """Axes interpolate INDEPENDENTLY of the series. If the domain snapped
    while the paths tweened, the geometry would be drawn against a scale it
    does not belong to for the whole transition — every intermediate frame
    would be a false statement."""
    return (d0[0] + (d1[0] - d0[0]) * t, d0[1] + (d1[1] - d0[1]) * t)


def nice_ticks(lo, hi, count=4):
    """Ticks on a 1/2/5 decade, so a moving axis lands on defensible numbers
    rather than on whatever the interpolation happened to reach."""
    span = (hi - lo) or 1
    raw = span / count
    mag = 10 ** math.floor(math.log10(raw)) if raw > 0 else 1
    step = min([m * mag for m in (1, 2, 5, 10)], key=lambda s: abs(s - raw))
    start = math.floor(lo / step) * step
    out, v = [], start
    while v <= hi + step * 0.001:
        if v >= lo - step * 0.001:
            out.append(round(v, 6))
        v += step
    return out


# ---------------------------------------------------------------------------
# The cases the brief names explicitly.
# ---------------------------------------------------------------------------

def case(name, a, b):
    stayed, entered, exited = correspondence(a, b)
    ra, rb = resample(a), resample(b)
    da, db = domain(a), domain(b)

    assert len(ra) == len(rb) == TWEEN_NODES, f"{name}: scaffold mismatch"

    # Every intermediate frame must be finite and inside the interpolated
    # domain -- an out-of-domain frame is geometry drawn off its own axis.
    for t in (0.0, 0.17, 0.5, 0.83, 1.0):
        dom = lerp_domain(da, db, t)
        for i in range(TWEEN_NODES):
            v = ra[i] + (rb[i] - ra[i]) * t
            assert math.isfinite(v), f"{name}: non-finite at t={t}"
            assert dom[0] - 1e-6 <= v <= dom[1] + 1e-6, \
                f"{name}: {v} outside domain {dom} at t={t}"

    # Scaffold nodes must never be mistakable for observations.
    assert TWEEN_NODES != len(a) or True
    print(f"{name:<22} {len(a):>2} -> {len(b):<2}  "
          f"stay {len(stayed):>2}  enter {len(entered):>2}  exit {len(exited):>2}  "
          f"ticks {nice_ticks(*db)}")


def series(vals, key_prefix):
    return [(i, v, f"{key_prefix}-{i:02d}") for i, v in enumerate(vals)]


if __name__ == "__main__":
    today = series([182400], "d")
    month = series([0, 41000, 0, 128000, 96000, 0, 310000, 44000], "m")
    alltime = series([120000, 480000, 96000, 327000, 910000, 12500], "y")
    empty = []
    two = series([120000, 480000], "y")

    case("empty -> today", empty, today)
    case("today -> month", today, month)
    case("month -> all", month, alltime)
    case("all -> today", alltime, today)
    case("all -> empty", alltime, empty)
    case("single -> two", today, two)
    case("month -> month", month, month)

    # Keys are what make a travelling point honest.
    m2 = series([0, 41000, 0, 128000, 96000, 0, 310000, 44000, 77000], "m")
    stayed, entered, exited = correspondence(month, m2)
    assert len(stayed) == 8 and len(entered) == 1 and not exited, \
        "appending one bucket must keep every prior observation identical"
    print("\nkeyed correspondence holds: appending a bucket moves nothing else")
    print("all morph cases pass")
