/**
 * Rain, as instanced points.
 *
 * ONE draw call, no geometry per drop, and no CPU work per frame beyond a
 * single uniform and a position. Every drop's fall is computed in the vertex
 * shader from its own seed, so the CPU never touches the buffer after build.
 *
 * WHY THE COLUMN FOLLOWS THE CAMERA. Rain only has to exist where it can be
 * seen, so this is a box of drops centred on the viewer rather than a
 * world-sized volume. Moving it is one vector assignment; filling the world
 * would be thousands of drops rendered for nobody.
 *
 * WHY THE WETNESS MATTERS MORE. A wet street reflecting a street lamp reads as
 * rain far harder than the drops do — the drops are the smallest part of the
 * effect and are deliberately kept subtle. See the wetness handling in
 * authWorld's applyEnvironment.
 *
 * NEVER GATES ANYTHING. Built only when there is rain to draw, disposed when
 * there is not, and its absence is a dry world rather than a broken one.
 */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uFall;        // metres per second
  uniform vec2  uWind;        // metres per second, world XZ
  uniform vec3  uExtent;      // half-size of the column
  uniform float uSize;

  attribute float aSeed;

  varying float vFade;

  void main() {
    vec3 p = position;

    /*
     * Each drop falls on its own clock and wraps within the column. mod()
     * rather than a threshold, so no drop ever pops: it leaves the bottom and
     * re-enters the top in the same instant, at the same x and z.
     */
    float speed = uFall * (0.82 + aSeed * 0.36);
    p.y = mod(p.y - uTime * speed, uExtent.y * 2.0) - uExtent.y;
    p.xz += uWind * uTime * (0.6 + aSeed * 0.5);
    p.xz = mod(p.xz + uExtent.xz, uExtent.xz * 2.0) - uExtent.xz;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    /* Fade at the edges of the column so drops do not wink out on a hard
     * boundary, and fade the far ones so the column has no visible wall. */
    float d = length(mv.xyz);
    vFade = smoothstep(uExtent.x * 1.15, uExtent.x * 0.35, d);

    gl_Position = projectionMatrix * mv;
    /* Perspective-correct size, with a floor so distant rain does not vanish
     * into sub-pixel noise that aliases as it moves. */
    gl_PointSize = max(1.0, uSize * (26.0 / max(1.0, -mv.z)));
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;

  void main() {
    /*
     * A vertical streak, not a dot. gl_PointCoord is the square the point is
     * drawn into; narrowing x and softening y turns it into a falling line at
     * no cost, which is what rain looks like at any shutter speed.
     */
    vec2 q = gl_PointCoord - 0.5;
    float streak = smoothstep(0.5, 0.0, abs(q.x) * 3.4)
                 * smoothstep(0.5, 0.1, abs(q.y));
    float a = streak * vFade * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

/**
 * Build a rain column.
 *
 * @param {number} count how many drops
 * @returns {{points, advance, setIntensity, dispose}}
 */
export function createRain(THREE, count = 2600, extent = [46, 30, 46]) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() * 2 - 1) * extent[0];
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * extent[1];
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * extent[2];
    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  /* The column moves with the camera, so a bounding sphere computed once from
   * local positions would cull it the moment the camera left the origin. */
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(), Math.hypot(extent[0], extent[1], extent[2]),
  );

  const uniforms = {
    uTime: { value: 0 },
    uFall: { value: 9.5 },
    uWind: { value: new THREE.Vector2(1.4, 0.5) },
    uExtent: { value: new THREE.Vector3(...extent) },
    uSize: { value: 1.7 },
    uColor: { value: new THREE.Color(0.72, 0.78, 0.86) },
    uOpacity: { value: 0.0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    /* Normal blending, not additive: additive rain over a dark city glows like
     * embers. Rain scatters light, it does not emit it. */
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.visible = false;

  return {
    points,
    /** Follow the camera and advance the clock. One vector, one float. */
    advance(seconds, camera, wind) {
      uniforms.uTime.value = seconds;
      if (camera) points.position.copy(camera.position);
      if (wind) uniforms.uWind.value.set(wind.x, wind.z);
    },
    /** 0..1. At zero the column is hidden rather than drawn transparent. */
    setIntensity(rain, tint) {
      const v = Math.max(0, Math.min(1, rain));
      points.visible = v > 0.01;
      uniforms.uOpacity.value = 0.16 + v * 0.34;
      uniforms.uSize.value = 1.35 + v * 0.9;
      uniforms.uFall.value = 8.0 + v * 5.0;
      if (tint) uniforms.uColor.value.copy(tint);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
