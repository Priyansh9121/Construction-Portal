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

    // The disk itself, soft-edged. A hard circle reads as a sticker.
    float disk = smoothstep(0.9986, 0.99975, mu);
    sky += uSunTint * disk * 3.2;

    // Horizon lift: atmosphere is thickest along the ground line.
    sky += uSunTint * pow(1.0 - abs(up), 9.0) * 0.16 * uHaze;

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

export function createSky(THREE, scene, time) {
  const T = TIMES[time] || TIMES.dusk;
  const sun = new THREE.Vector3(...T.sun).normalize();

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

  return {
    sun,
    preset: T,
    material,
    /**
     * The sun moves, very slowly, and everything derived from it moves too.
     * A degree a minute is below the threshold of noticing frame to frame and
     * unmistakable after thirty seconds — which is the whole point.
     */
    advance(seconds, key) {
      const a = seconds * 0.0016;
      const s = new THREE.Vector3(...T.sun);
      s.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      s.y = Math.max(0.045, T.sun[1] + Math.sin(a * 0.6) * 0.035);
      s.normalize();
      material.uniforms.uSun.value.copy(s);
      if (key) key.position.copy(s).multiplyScalar(140);
      return s;
    },
    dispose() {
      dome.geometry.dispose();
      material.dispose();
    },
  };
}
