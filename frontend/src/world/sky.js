/**
 * Procedural sky, sun and atmosphere.
 *
 * A flat gradient behind geometry is the single biggest reason a real-time
 * scene reads as a model: objects sit in empty space with nothing to be lit
 * BY. This gives the site a sky it stands under, and derives every other
 * lighting value from the same sun position, so the key light, the ambient
 * fill, the fog and the concrete tint can never disagree about where the sun is.
 *
 * A Rayleigh/Mie approximation rather than a physically-complete model: two
 * scattering terms, a sun disk and a horizon lift. It is a few dozen lines of
 * GLSL on one inverted sphere, costs one draw call, and needs no HDRI, no
 * licence and no network asset.
 */

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    // The sky is infinitely far: strip translation so it never parallaxes,
    // and force w so it always resolves behind everything.
    vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vDir;

  uniform vec3 uSun;          // direction to the sun
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunTint;
  uniform float uHaze;
  uniform float uExposure;
  uniform float uTime;
  uniform vec2 uWind;
  uniform float uCloud;

  uniform vec3 uMoon;         // direction to the moon
  uniform float uMoonFrac;    // illuminated fraction, 0..1
  uniform float uMoonUp;      // 0 or 1
  uniform float uNight;       // 0 by day, 1 at astronomical night

  /*
   * ANGULAR RADII, in tangent units (roughly radians for small angles).
   *
   * The real sun and moon are both about 0.53 degrees across — 0.0046 here.
   * At that size neither is legible as anything but a speck on a login
   * screen, so both are drawn several times over. This is art direction and
   * it is the one number in this file that is deliberately untrue.
   */
  const float SUN_R  = 0.030;
  const float MOON_R = 0.038;

  /*
   * The offset of a view ray from a body's centre, on the tangent plane at
   * that body. Dividing by the dot product projects the ray onto the plane,
   * so the result is a flat 2D offset that a disc test can use directly and
   * that does not distort as the body approaches the zenith.
   */
  vec2 tangentOffset(vec3 d, vec3 body, vec3 axisX, vec3 axisY) {
    vec3 off = d / max(dot(d, body), 1e-4) - body;
    return vec2(dot(off, axisX), dot(off, axisY));
  }

  // ---- Value noise and fBm, for cloud shape -----------------------------
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += vnoise(p) * a;
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float up = d.y;

    // Vertical gradient, biased so the horizon band is tight rather than a
    // lazy half-and-half wash.
    float t = pow(clamp(up * 0.5 + 0.5, 0.0, 1.0), 0.55);
    vec3 sky = mix(uHorizon, uZenith, smoothstep(0.42, 0.98, t));

    // Below the horizon is ground haze, not sky: the site sits in a bowl of
    // its own dust.
    sky = mix(uGround, sky, smoothstep(-0.06, 0.06, up));

    float mu = max(dot(d, normalize(uSun)), 0.0);

    // Mie forward scattering: the bright wash around the sun that makes low
    // light read as low light.
    float mie = pow(mu, 8.0) * 0.55 + pow(mu, 2.0) * 0.14;
    sky += uSunTint * mie * uHaze;

    // Horizon lift: atmosphere is thickest along the ground line.
    sky += uSunTint * pow(1.0 - abs(up), 9.0) * 0.16 * uHaze;

    /*
     * STARS.
     *
     * Night was a flat navy wash, which reads as "the lights are off" rather
     * than as night. A hashed grid gives points at no cost; the cell centre
     * offset stops them landing on a visible lattice, and only a small
     * fraction of cells are allowed to hold a star at all.
     *
     * Faded out by uNight so they never appear in daylight, and by altitude
     * so they do not sit in the horizon haze where real ones are extinct.
     */
    if (uNight > 0.001 && up > 0.02) {
      vec2 sp = vec2(atan(d.z, d.x) * 1.9, asin(clamp(up, -1.0, 1.0)) * 2.6) * 42.0;
      vec2 cell = floor(sp);
      vec2 frac = fract(sp);
      float pick = hash(cell);
      if (pick > 0.86) {
        vec2 centre = vec2(hash(cell + 3.1), hash(cell + 7.7));
        float dd = length(frac - centre);
        float mag = hash(cell + 11.3);
        // Twinkle: slow, per-star phase, and shallow enough not to strobe.
        float tw = 0.72 + 0.28 * sin(uTime * (0.8 + mag) + pick * 40.0);
        float star = (1.0 - smoothstep(0.0, 0.10, dd)) * mag * tw;
        sky += vec3(0.85, 0.9, 1.0) * star * uNight * smoothstep(0.02, 0.3, up);
      }
    }

    /*
     * CLOUD LAYER.
     *
     * A gradient sky is the most synthetic thing in the frame — real sky has
     * structure, and structure is what gives it distance. This is a flat cloud
     * plane sampled by projecting the view ray onto it, so clouds bunch toward
     * the horizon exactly as a real layer does, at no geometric cost.
     *
     * They drift on the WORLD WIND, so the sky obeys the same environment as
     * the crane's load and the dust. Two octave sets at different scales and
     * speeds give the layer internal motion rather than sliding as one sheet.
     */
    float cloudMask = 0.0;
    if (up > 0.005) {
      vec2 proj = d.xz / max(up, 0.02) * 0.35;
      vec2 drift = uWind * uTime * 0.006;

      float base = fbm(proj * 0.55 + drift);
      float detail = fbm(proj * 1.7 - drift * 1.7);
      /* Threshold tuned by render, not by taste: at 0.46-0.86 almost no
       * pixels passed and the layer was invisible. */
      float mask = smoothstep(0.34, 0.74, base * 0.78 + detail * 0.36);

      // Fade out toward the zenith and at the horizon, so the layer reads as
      // having an edge rather than filling the dome.
      mask *= smoothstep(0.0, 0.1, up) * (1.0 - smoothstep(0.62, 1.0, up));
      mask *= uCloud;
      cloudMask = clamp(mask, 0.0, 0.88);

      // Lit from the same sun: the side facing it is bright, the body is not.
      float lit = pow(max(mu, 0.0), 3.0);
      vec3 cloudCol = mix(uHorizon * 0.75, uSunTint * 1.25, lit * 0.8 + 0.12);
      sky = mix(sky, cloudCol, clamp(mask, 0.0, 0.88));
    }

    /*
     * SUN AND MOON, drawn AFTER the cloud layer.
     *
     * Drawn before it, they were painted over: a cloud mask of 0.88 all but
     * deletes a disc, and at golden hour — exactly when the sun matters most —
     * the layer is thickest and the sun vanished entirely.
     *
     * clarity keeps the physics honest without losing the subject: cloud
     * dims a body rather than erasing it, so it can still be seen through
     * thin cover and still disappears behind thick.
     */
    float clarity = 1.0 - cloudMask * 0.72;

    /*
     * THE SUN.
     *
     * A limb-darkened disc plus two glow terms. The inner glow is what makes
     * it read as a light source rather than a decal; the outer is the
     * aureole that sells haze.
     */
    {
      vec3 S = normalize(uSun);
      float facing = step(0.0, dot(d, S));
      vec3 ax = normalize(cross(S, abs(S.y) > 0.95 ? vec3(1, 0, 0) : vec3(0, 1, 0)));
      vec2 o = tangentOffset(d, S, ax, cross(S, ax));
      float r = length(o) / SUN_R;

      float disc = 1.0 - smoothstep(0.86, 1.0, r);
      // Limb darkening: the edge of a real disc is dimmer than its centre.
      float limb = mix(0.72, 1.0, sqrt(max(0.0, 1.0 - min(r, 1.0) * min(r, 1.0))));
      float glow = exp(-r * 0.9) * 0.5 + exp(-r * 0.18) * 0.12 * uHaze;

      sky += uSunTint * facing * (disc * limb * 6.0 + glow) * clarity;
    }

    /*
     * THE MOON, with its phase.
     *
     * The terminator is the projection of a sphere's day/night boundary, so
     * it is an ELLIPSE, not a straight line — a half-moon has a flat edge and
     * every other phase has a curved one. k walks from +1 at new to -1 at
     * full, and the lit side always faces the sun because the tangent basis
     * is built from the sun direction rather than from anything arbitrary.
     */
    if (uMoonUp > 0.5) {
      vec3 M = normalize(uMoon);
      vec3 S = normalize(uSun);
      float facing = step(0.0, dot(d, M));

      // Toward the sun, projected onto the moon's tangent plane. Degenerate
      // when sun and moon are nearly aligned (a new moon), so it falls back
      // to a fixed axis rather than producing NaNs.
      vec3 toSun = S - M * dot(S, M);
      vec3 ax = length(toSun) > 1e-3
        ? normalize(toSun)
        : normalize(cross(M, abs(M.y) > 0.95 ? vec3(1, 0, 0) : vec3(0, 1, 0)));
      vec2 o = tangentOffset(d, M, ax, cross(M, ax));
      float r = length(o) / MOON_R;

      float disc = 1.0 - smoothstep(0.9, 1.0, r);
      vec2 n = o / MOON_R;
      float k = 1.0 - 2.0 * clamp(uMoonFrac, 0.0, 1.0);
      float term = k * sqrt(max(0.0, 1.0 - n.y * n.y));
      float lit = smoothstep(term - 0.06, term + 0.06, n.x);

      // Maria: a little large-scale mottling so the disc is not a plain
      // white circle. Two blobs is enough at this size.
      float mare = 0.86 + 0.14 * vnoise(n * 1.7 + 4.0);

      // Earthshine: the unlit limb is faintly visible, strongest at crescent.
      float earthshine = (1.0 - lit) * 0.055 * (1.0 - uMoonFrac);

      vec3 moonCol = vec3(0.94, 0.95, 0.92);
      sky += moonCol * facing * disc * (lit * mare * 2.4 + earthshine) * clarity;
      // A small halo, so it lifts off the sky rather than being pasted on.
      sky += moonCol * facing * exp(-r * 1.5) * 0.10 * uMoonFrac * uNight * clarity;
    }


    gl_FragColor = vec4(sky * uExposure, 1.0);
  }
`;

/**
 * Authored times of day. Each is a complete lighting state — sun elevation and
 * azimuth, sky colours, and the ground/fog tint that must match them.
 *
 * These are art direction, not telemetry. Nothing here claims to be the real
 * sun over a real site.
 */
export const TIMES = {
  dawn: {
    sun: [0.34, 0.13, -0.93],
    zenith: [0.16, 0.26, 0.46],
    horizon: [0.86, 0.55, 0.36],
    ground: [0.13, 0.13, 0.16],
    tint: [1.0, 0.62, 0.34],
    haze: 1.35,
    key: 0xffb877,
    keyI: 2.6,
    fill: 0x5f7fae,
    fillI: 1.0,
    fog: 0x2a2b34,
    fogD: 0.0058,
    work: 0.55,
    exposure: 1.0,
  },
  dusk: {
    sun: [-0.42, 0.085, 0.9],
    zenith: [0.05, 0.09, 0.2],
    horizon: [0.42, 0.26, 0.3],
    ground: [0.05, 0.055, 0.07],
    tint: [1.0, 0.5, 0.28],
    haze: 1.5,
    /* Less saturated than the sun disk itself. A fully saturated key paints
     * every surface its own colour and destroys material identity; the disk
     * can be orange while the light it throws is only warm. */
    key: 0xffc79a,
    keyI: 1.85,
    /* Strong cool sky bounce. This is what fills the shadow side of concrete
     * and stops the whole scene collapsing into one warm value. */
    fill: 0x5b82c4,
    fillI: 1.9,
    fog: 0x141821,
    fogD: 0.0068,
    work: 1.0,
    exposure: 1.05,
  },
  day: {
    sun: [0.3, 0.68, -0.67],
    zenith: [0.24, 0.42, 0.72],
    horizon: [0.66, 0.74, 0.84],
    ground: [0.3, 0.3, 0.32],
    tint: [1.0, 0.94, 0.82],
    haze: 0.8,
    key: 0xfff2dd,
    keyI: 3.1,
    fill: 0x9ab6d8,
    fillI: 1.5,
    fog: 0x8b98a8,
    fogD: 0.0055,
    work: 0.12,
    exposure: 0.95,
  },
};

/**
 * The sky, driven by a GRADE and a real sun direction.
 *
 * `grade` is the interpolated colour set produced by the world environment
 * from the sun's actual altitude; `sunDir` is where the sun actually is. The
 * old signature took the NAME of one of three hand-painted presets, which is
 * why the world was permanently at dusk regardless of the time of day.
 */
export function createSky(THREE, scene, grade, sunDir, moon) {
  const T = grade || TIMES.dusk;
  const sun = new THREE.Vector3(...(sunDir || T.sun)).normalize();
  const moonVec = new THREE.Vector3(...(moon?.dir || [0, -1, 0]));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSun: { value: sun },
      uZenith: { value: new THREE.Color(...T.zenith) },
      uHorizon: { value: new THREE.Color(...T.horizon) },
      uGround: { value: new THREE.Color(...T.ground) },
      uSunTint: { value: new THREE.Color(...T.tint) },
      uHaze: { value: T.haze },
      uExposure: { value: T.exposure },
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(1, 0.3) },
      uCloud: { value: T.cloud ?? 0.85 },
      uMoon: { value: moonVec },
      uMoonFrac: { value: moon?.fraction ?? 0 },
      uMoonUp: { value: moon?.up ? 1 : 0 },
      uNight: { value: 0 },
    },
  });

  /*
   * A BOX, not a sphere.
   *
   * A 24x16 sphere leaves gaps at the frustum's corners under a wide field of
   * view — a black wedge appeared at the right edge of the frame, visible the
   * moment it was rendered. A cube's six faces cover the frustum exactly at
   * any aspect and any FOV, for twelve triangles.
   */
  const dome = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  scene.add(dome);

  /**
   * Push a whole environment instant at the sky: the colour grade, where the
   * sun is, and where the moon is with how much of it is lit.
   *
   * `env` is optional so the older two-argument call still works; when it is
   * supplied the moon and the night factor come from the same instant as the
   * grade, which is the only way they can be guaranteed to agree.
   */
  /*
   * The sun direction arrives as a PLAIN ARRAY from worldEnvironment — every
   * other consumer spreads it (`set(...env.sun.dir)`), and this one called
   * `.copy()` on it.
   *
   * Vector3.copy reads .x/.y/.z, an array has none, so every component became
   * undefined and then NaN through normalize(). The uniform has been NaN
   * since the sun was first driven from SunCalc, which is why the sun disk
   * this shader has always contained was never once visible, and why the Mie
   * glow around it never appeared either. Nothing threw; the sky just quietly
   * lost its sun.
   */
  const asVec = (v, out) =>
    Array.isArray(v) ? out.fromArray(v) : out.copy(v);

  const applyGrade = (g, dir, env) => {
    if (dir) asVec(dir, material.uniforms.uSun.value).normalize();
    if (env?.moon) {
      asVec(env.moon.dir, material.uniforms.uMoon.value).normalize();
      material.uniforms.uMoonFrac.value = env.moon.fraction;
      material.uniforms.uMoonUp.value = env.moon.up ? 1 : 0;
    }
    if (typeof env?.nightness === "number") {
      material.uniforms.uNight.value = env.nightness;
    }
    material.uniforms.uZenith.value.setRGB(...g.zenith);
    material.uniforms.uHorizon.value.setRGB(...g.horizon);
    material.uniforms.uGround.value.setRGB(...g.ground);
    material.uniforms.uSunTint.value.setRGB(...g.tint);
    material.uniforms.uHaze.value = g.haze;
    material.uniforms.uExposure.value = g.exposure;
  };

  return {
    sun,
    preset: T,
    material,
    applyGrade,
    /* Exposed so the environment bake can render the same dome into a cube
     * without rebuilding the shader. */
    dome,
    /**
     * Clouds drift; the SUN DOES NOT MOVE HERE ANY MORE.
     *
     * This used to rotate an invented sun about Y at "a degree a minute",
     * which was a nice effect and a lie: the light had no relationship to
     * anything. The sun's position now comes from the real clock and real
     * coordinates, and is pushed in through `applyGrade`.
     */
    advance(seconds, wind) {
      material.uniforms.uTime.value = seconds;
      if (wind) material.uniforms.uWind.value.set(wind.x, wind.z);
      return material.uniforms.uSun.value;
    },
    dispose() {
      dome.geometry.dispose();
      material.dispose();
    },
  };
}
