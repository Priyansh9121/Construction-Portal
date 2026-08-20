/**
 * ONE WORLD ENVIRONMENT STATE.
 *
 * Every system that has an opinion about light, colour or weather reads this
 * and nothing else. Before it existed, the world's time of day was one of
 * three hand-painted presets picked at build time — which is why the site was
 * permanently at dusk no matter when anyone opened it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TIME IS REAL, AND IT IS INDIAN
 * ─────────────────────────────────────────────────────────────────────────
 * `Asia/Kolkata` is not a decoration chosen for this file: it is the
 * project's own `DEFAULT_TIMEZONE`, the value `backend/config/constants.js`
 * uses to decide what "today" means for every daily-update window and audit
 * record in the product. The world now runs on the same clock the business
 * logic does.
 *
 * The offset is never computed by adding 5.5 hours. `Date` is an absolute
 * instant; the zone only matters for DISPLAY, and `Intl.DateTimeFormat` with
 * a named zone is the only correct way to do that. Hand-rolled offsets are
 * how software breaks on the day a rule changes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COORDINATES ARE NOT CONFIGURED, AND THIS FILE SAYS SO
 * ─────────────────────────────────────────────────────────────────────────
 * A timezone is not a location. Sun altitude depends on LATITUDE, and IST
 * spans a country roughly 2,000 km wide.
 *
 * The schema already anticipates this: `sites` carries `latitude` and
 * `longitude` columns. Every row in them is NULL. The addresses that do exist
 * are local test fixtures ("Probe Site", "1 Road"), and inferring a real city
 * from a fixture would be inventing data.
 *
 * So the values below are an explicit, labelled PLACEHOLDER — the IST standard
 * meridian at a mid-country latitude — and `coordinatesConfigured` is false.
 * Sunrise and sunset are therefore correct to roughly half an hour for India
 * as a whole and are NOT correct for any particular site. Nothing in this file
 * may describe itself as astronomically sited until a real `sites` row
 * supplies coordinates.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SUNCALC 2.x RETURNS DEGREES, NORTH-BASED
 * ─────────────────────────────────────────────────────────────────────────
 * This is a breaking change from 1.x, which returned RADIANS measured from
 * SOUTH. Treating 2.x output as radians produces a sun altitude of 4,276
 * degrees, which is what the first run of this integration reported. The
 * conversion below is written against the 2.x contract, verified from the
 * package's own type definitions.
 */

/* Named imports: suncalc 2.x is an ES module with no default export. */
import {
  getPosition, getMoonPosition, getMoonIllumination, getTimes,
} from "suncalc";

/**
 * The world's site.
 *
 * `coordinatesConfigured: false` is load-bearing. Anything that reports on
 * this world must read it and describe the celestial state as approximate.
 */
export const WORLD_SITE = {
  /* Real project configuration: backend DEFAULT_TIMEZONE / COMPANY_TIMEZONE. */
  timezone: "Asia/Kolkata",

  /*
   * PLACEHOLDER. The IST standard meridian (82.5 E) at a mid-country
   * latitude. Not a site, not a city, and deliberately not any of the cities
   * that appear in local test fixtures.
   */
  latitude: 23.0,
  longitude: 82.5,
  coordinatesConfigured: false,
};

/* ------------------------------------------------------------------------ *
 * Colour helpers
 * ------------------------------------------------------------------------ */

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(mix(ar, br, t)) << 16)
       | (Math.round(mix(ag, bg, t)) << 8)
       | Math.round(mix(ab, bb, t));
}

/* ------------------------------------------------------------------------ *
 * The grade, as a function of solar altitude
 * ------------------------------------------------------------------------ *
 *
 * Keyed on the sun's real altitude rather than on clock time, because that is
 * what actually decides how a sky looks: -6 degrees is civil twilight in
 * Chennai in December and in Leh in June, and it looks the same in both.
 *
 * The boundaries are the standard ones:
 *
 * DAYLIGHT IS SUN-DOMINANT, as of 2026-08-20.
 *
 * The two daylight stops used to run fillI ABOVE keyI — 3.8 against 3.4 at
 * alt 65, 3.4 against 3.0 at alt 25. A hemisphere fills every crevice equally,
 * so that was a scene lit mostly by something with no direction, which is what
 * flattened the facades and washed out the baked AO.
 *
 * Measured over the LIT GEOMETRY only. A whole-frame histogram is useless
 * here: with every light switched off the frame's mean was still 65, because
 * most of it is sky and the login card.
 *
 *     3.4 key / 3.8 fill / 1.0 env    p05 17.7  mean 70.6  p75/p25 2.03
 *     9.0 key / 0.0 fill / 1.2 env    p05 17.7  mean 70.9  p75/p25 2.28
 *
 * Same brightness and the SAME SHADOW FLOOR, which is the number that had to
 * hold: the strong fill was put here deliberately to stop north-facing
 * concrete going dead, and that risk is real. It simply was not the hemisphere
 * that had to carry it — scene.environment is a PMREM of this same sky, so the
 * bounce now comes from the sky the viewer can see, horizon warmth included,
 * instead of from a flat two-colour lamp.
 *
 * Exposure is deliberately NOT touched. It is already lowest at noon, which is
 * the fingerprint of someone having tried to fix this from the wrong end.
 *
 *   -18   astronomical twilight ends: true night
 *    -6   civil twilight: the blue hour, lights on, work continues
 *  -0.83  geometric sunrise/sunset including refraction
 *    +6   the end of golden hour
 *   +25   ordinary daylight
 *   +65   high sun
 */
const STOPS = [
  { alt: -18, grade: {
    zenith: [0.012, 0.018, 0.045], horizon: [0.04, 0.05, 0.09],
    ground: [0.012, 0.014, 0.02], tint: [0.55, 0.62, 0.85], haze: 0.85,
    key: 0x2c3c66, keyI: 0.06, fill: 0x243a5e, fillI: 0.16, envI: 1.0, bounce: 0x0a0b0e,
    fog: 0x05070c, fogD: 0.0090, work: 1.0, exposure: 1.22 } },
  { alt: -6, grade: {
    zenith: [0.03, 0.05, 0.12], horizon: [0.16, 0.15, 0.24],
    ground: [0.03, 0.032, 0.042], tint: [0.85, 0.6, 0.55], haze: 1.35,
    key: 0x6a6ea0, keyI: 0.18, fill: 0x44598c, fillI: 0.85, envI: 1.0, bounce: 0x14120f,
    fog: 0x0b0f18, fogD: 0.0078, work: 1.0, exposure: 1.12 } },
  { alt: -0.83, grade: {
    zenith: [0.05, 0.09, 0.2], horizon: [0.52, 0.3, 0.3],
    ground: [0.05, 0.055, 0.07], tint: [1.0, 0.5, 0.28], haze: 1.5,
    key: 0xffc79a, keyI: 1.35, fill: 0x5b82c4, fillI: 1.9, envI: 1.0, bounce: 0x1a1712,
    fog: 0x141821, fogD: 0.0068, work: 0.9, exposure: 1.05 } },
  { alt: 6, grade: {
    zenith: [0.13, 0.24, 0.46], horizon: [0.78, 0.6, 0.46],
    ground: [0.14, 0.14, 0.16], tint: [1.0, 0.78, 0.5], haze: 1.15,
    key: 0xffd9ac, keyI: 3.6, fill: 0x8fb0dd, fillI: 1.5, envI: 1.05, bounce: 0x4a3d2c,
    fog: 0x3a3a42, fogD: 0.0050, work: 0.35, exposure: 1.0 } },
  { alt: 25, grade: {
    zenith: [0.22, 0.4, 0.7], horizon: [0.64, 0.72, 0.83],
    ground: [0.28, 0.28, 0.3], tint: [1.0, 0.93, 0.8], haze: 0.85,
    key: 0xfff0d8, keyI: 8.0, fill: 0xa6c4e8, fillI: 0.2, envI: 1.15, bounce: 0x8a7355,
    fog: 0x8090a4, fogD: 0.0030, work: 0.0, exposure: 0.95 } },
  { alt: 65, grade: {
    zenith: [0.18, 0.36, 0.74], horizon: [0.7, 0.79, 0.88],
    ground: [0.33, 0.33, 0.34], tint: [1.0, 0.98, 0.93], haze: 0.62,
    key: 0xfffaf0, keyI: 9.0, fill: 0xb2cdec, fillI: 0.0, envI: 1.2, bounce: 0x9c8462,
    fog: 0x9aa8bc, fogD: 0.0022, work: 0.0, exposure: 0.9 } },
];

function gradeFor(altitudeDeg) {
  if (altitudeDeg <= STOPS[0].alt) return { ...STOPS[0].grade };
  const last = STOPS[STOPS.length - 1];
  if (altitudeDeg >= last.alt) return { ...last.grade };

  let i = 0;
  while (i < STOPS.length - 2 && altitudeDeg > STOPS[i + 1].alt) i += 1;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const t = (altitudeDeg - a.alt) / (b.alt - a.alt);

  return {
    zenith: mix3(a.grade.zenith, b.grade.zenith, t),
    horizon: mix3(a.grade.horizon, b.grade.horizon, t),
    ground: mix3(a.grade.ground, b.grade.ground, t),
    tint: mix3(a.grade.tint, b.grade.tint, t),
    haze: mix(a.grade.haze, b.grade.haze, t),
    bounce: mixHex(a.grade.bounce, b.grade.bounce, t),
    key: mixHex(a.grade.key, b.grade.key, t),
    keyI: mix(a.grade.keyI, b.grade.keyI, t),
    fill: mixHex(a.grade.fill, b.grade.fill, t),
    fillI: mix(a.grade.fillI, b.grade.fillI, t),
    envI: mix(a.grade.envI ?? 1, b.grade.envI ?? 1, t),
    fog: mixHex(a.grade.fog, b.grade.fog, t),
    fogD: mix(a.grade.fogD, b.grade.fogD, t),
    work: mix(a.grade.work, b.grade.work, t),
    exposure: mix(a.grade.exposure, b.grade.exposure, t),
  };
}

/* ------------------------------------------------------------------------ *
 * Celestial geometry
 * ------------------------------------------------------------------------ */

const DEG = Math.PI / 180;

/**
 * Horizon coordinates to a world direction vector.
 *
 * World convention: +X is EAST, -Z is NORTH. SunCalc 2.x gives azimuth in
 * degrees CLOCKWISE FROM NORTH, so north(0) is -Z, east(90) is +X,
 * south(180) is +Z and west(270) is -X.
 *
 * The result points FROM the site TOWARD the body, which is where a
 * directional light must be placed.
 */
function toDirection(altitudeDeg, azimuthDeg) {
  const alt = altitudeDeg * DEG;
  const az = azimuthDeg * DEG;
  const c = Math.cos(alt);
  return [Math.sin(az) * c, Math.sin(alt), -Math.cos(az) * c];
}

/** The name of the moon's phase, from SunCalc's 0..1 phase value. */
function moonPhaseName(phase) {
  const names = [
    "new", "waxing crescent", "first quarter", "waxing gibbous",
    "full", "waning gibbous", "last quarter", "waning crescent",
  ];
  /* Each named phase occupies an eighth of the cycle, centred on its value. */
  return names[Math.round(phase * 8) % 8];
}

function phaseName(sunAlt) {
  if (sunAlt >= 6) return "day";
  if (sunAlt >= -0.83) return "golden";
  if (sunAlt >= -6) return "civil twilight";
  if (sunAlt >= -18) return "astronomical twilight";
  return "night";
}

/**
 * The whole environment, for an instant.
 *
 * `date` defaults to now. It is injectable so the world can be driven to a
 * chosen time for verification — a night scene must be testable without
 * waiting until night.
 */
export function worldEnvironment(date = new Date(), site = WORLD_SITE) {
  const { latitude: lat, longitude: lon } = site;

  const sunPos = getPosition(date, lat, lon);
  const moonPos = getMoonPosition(date, lat, lon);
  const moonIll = getMoonIllumination(date);

  const sunAlt = sunPos.altitude;          // degrees, 2.x contract
  const sunAz = sunPos.azimuth;
  const moonAlt = moonPos.altitude;
  const moonAz = moonPos.azimuth;

  const grade = gradeFor(sunAlt);

  /*
   * THE MOON IS NOT A SECOND SUN.
   *
   * Full moonlight is roughly 400,000 times weaker than sunlight. It is
   * modelled here as a faint, cool key that exists only when the sun is well
   * down and the moon is actually above the horizon, scaled by the
   * ILLUMINATED FRACTION — a new moon contributes nothing, which is correct
   * and is also why the sky can be genuinely dark on some nights and not on
   * others.
   */
  const moonUp = moonAlt > 0;
  const nightness = Math.min(1, Math.max(0, (-sunAlt - 4) / 8));
  const moonI = moonUp ? nightness * moonIll.fraction * 0.42 : 0;

  let localTime;
  try {
    localTime = new Intl.DateTimeFormat("en-IN", {
      timeZone: site.timezone, dateStyle: "medium", timeStyle: "short",
    }).format(date);
  } catch {
    /* An engine without full ICU still gets a world; it just gets a less
     * pretty label. The celestial maths does not depend on this. */
    localTime = date.toISOString();
  }

  return {
    at: date,
    localTime,
    timezone: site.timezone,
    coordinatesConfigured: site.coordinatesConfigured,
    latitude: lat,
    longitude: lon,

    sun: {
      altitude: sunAlt,
      azimuth: sunAz,
      dir: toDirection(sunAlt, sunAz),
      up: sunAlt > -0.83,
    },
    moon: {
      altitude: moonAlt,
      azimuth: moonAz,
      dir: toDirection(moonAlt, moonAz),
      up: moonUp,
      fraction: moonIll.fraction,
      phase: moonIll.phase,
      phaseName: moonPhaseName(moonIll.phase),
      intensity: moonI,
    },

    phase: phaseName(sunAlt),
    nightness,
    grade,
  };
}

/**
 * Sunrise, sunset and the twilight boundaries for the day `date` falls in.
 * Reported rather than used for lighting — the lighting reads altitude, which
 * is continuous and cannot disagree with itself.
 */
export function dayTimes(date = new Date(), site = WORLD_SITE) {
  const t = getTimes(date, site.latitude, site.longitude);
  const fmt = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    try {
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: site.timezone, timeStyle: "short",
      }).format(d);
    } catch {
      return d.toISOString();
    }
  };
  return {
    dawn: fmt(t.dawn), sunrise: fmt(t.sunrise), solarNoon: fmt(t.solarNoon),
    sunset: fmt(t.sunset), dusk: fmt(t.dusk), night: fmt(t.night),
  };
}
