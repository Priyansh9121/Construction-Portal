/**
 * Real weather over Ahmedabad, from Open-Meteo.
 *
 * NEVER AWAITED BY ANYTHING THAT MATTERS.
 *
 * The auth form does not wait on the world, and the world does not wait on the
 * weather. This is the same posture as `loadAssets`: it is called without being
 * awaited, it never rejects, and a failure returns the default rather than
 * propagating. A slow or blocked forecast produces a clear day and a login
 * screen that behaves identically.
 *
 * WHY OPEN-METEO. Keyless, CORS-open, no account, no attribution requirement
 * on the response, and it answers the only three questions this world asks:
 * how much cloud, is it raining, and how hard.
 *
 * THE CACHE IS THE FALLBACK. The last good answer is kept in localStorage and
 * used when the network fails, so a returning user who is offline still gets
 * the weather they last had rather than a default that contradicts the window
 * they are sitting next to. It is deliberately allowed to be stale: an hours-old
 * cloud cover is a better guess than no guess.
 */

const ENDPOINT =
  "https://api.open-meteo.com/v1/forecast"
  + "?latitude=23.0225&longitude=72.5714"
  + "&current=cloud_cover,precipitation,weather_code,wind_speed_10m"
  + "&timezone=Asia%2FKolkata";

const CACHE_KEY = "world.weather.v1";
const CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000;   // three hours
const TIMEOUT_MS = 4000;

/**
 * A clear, still day. The value every failure path returns.
 *
 * Not zero cloud: a completely cloudless sky is rarer than the default should
 * be, and the sky shader's cloud layer is part of what stops it reading as a
 * gradient.
 */
export const DEFAULT_WEATHER = {
  cloud: 0.28,        // 0..1 sky covered
  rain: 0,            // 0..1 intensity
  wet: 0,             // 0..1 how wet the ground is
  wind: 3.2,          // m/s
  source: "default",
};

function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

/**
 * Open-Meteo's WMO code, reduced to the two things this world renders.
 *
 * Only the bands that change the picture are distinguished. Drizzle and rain
 * differ in intensity, not in kind, and nothing here can draw hail.
 */
function fromCode(code, precipMm) {
  const rainByCode =
    code >= 95 ? 1.0                       // thunderstorm
      : code >= 80 ? 0.8                   // showers
        : code >= 61 ? 0.6                 // rain
          : code >= 51 ? 0.3               // drizzle
            : 0;
  /* Precipitation in mm/h is the better signal when it is present; the code is
   * the fallback for "it is raining but the gauge says 0.0". */
  const byMm = clamp01(precipMm / 4);
  return Math.max(rainByCode, byMm);
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, value } = JSON.parse(raw);
    if (!at || !value) return null;
    return { ...value, source: "cache", ageMs: Date.now() - at };
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* Private browsing, quota, disabled storage. None of it matters. */
  }
}

/**
 * Fetch the current weather. Resolves to a weather object, ALWAYS.
 *
 * Resolves rather than rejects on every failure, so a caller cannot make the
 * mistake of awaiting it in a path that must not fail. The worst case is
 * `DEFAULT_WEATHER`.
 */
export async function fetchWeather({ signal } = {}) {
  const cached = readCache();
  try {
    /* Its own timeout. A request that never settles would otherwise leave the
     * world on the default forever with no way to know why. */
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    if (signal) signal.addEventListener("abort", () => ctrl.abort(), { once: true });

    const res = await fetch(ENDPOINT, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));

    const body = await res.json();
    const cur = body?.current || {};
    const value = {
      cloud: clamp01((cur.cloud_cover ?? 30) / 100),
      rain: fromCode(cur.weather_code ?? 0, cur.precipitation ?? 0),
      wind: Number.isFinite(cur.wind_speed_10m) ? cur.wind_speed_10m / 3.6 : 3.2,
      source: "live",
    };
    /* Ground stays wet after the rain stops, which is most of why a wet street
     * reads as weather rather than as an effect. */
    value.wet = clamp01(Math.max(value.rain, value.rain > 0 ? 0.7 : 0));
    writeCache(value);
    return value;
  } catch {
    if (cached && cached.ageMs < CACHE_MAX_AGE_MS) return cached;
    if (cached) return { ...cached, source: "cache-stale" };
    return DEFAULT_WEATHER;
  }
}
