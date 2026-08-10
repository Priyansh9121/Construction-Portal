/*
 * Three levels of experiential ambition, applied to the CURRENT Dashboard.
 *
 * Each pass is {css, mount(root, world)} and is injected into the live route,
 * so all three carry the real markup, the real data and the real type -- and
 * a comparison between them is a comparison of the environment alone.
 *
 * Shared vocabulary across all three:
 *   --w-ink       the single ink the world is drawn in
 *   .w-plane      a depth plane; translated by parallax, never by layout
 *   .w-svg        one SVG per environment; no filters on any plane
 */

const INK = `
  .w-svg { position:absolute; inset:0; width:100%; height:100%; display:block;
           color: var(--ui-ink, #14161a); pointer-events:none; }
  .w-plane { fill:none; stroke: var(--w-ink, #9aa1a8); stroke-width:1.15;
             vector-effect: non-scaling-stroke; }
  .w-haze { stroke:none; }
  .w-distant { stroke: var(--w-far, #cfd4d9); }
  .w-frame   { stroke: var(--w-mid, #b6bcc3); }
  .w-rigs    { stroke: var(--w-ink, #8f969d); stroke-width:1.35; }
  .w-near    { stroke: var(--w-near, #7d858d); stroke-width:1.5; }
  .w-brace   { stroke-dasharray: 5 4; opacity:.75; }
  .w-partial { stroke-width:2.4; }
  .w-lit     { fill: var(--w-lit, #f0c98a); stroke:none; }
  .w-mark-t  { font: 500 13px/1 ui-monospace, monospace; fill: var(--w-near, #7d858d);
               stroke:none; letter-spacing:.08em; }
  .w-mark    { stroke-width:2; }
`;

/* Trolley travel + hook damping. Shared because the mechanism is the same in
 * every pass; only the duration and amplitude change.
 *
 * The trolley runs jib-out and jib-in on an ease-in-out, which is how a real
 * trolley moves -- it accelerates off the stop and settles onto it. The hook
 * lags the trolley: its sway keyframes are the SAME duration but offset by a
 * negative delay, so the load is always a beat behind the machine that is
 * dragging it. That lag is the entire difference between "a rectangle
 * translating" and "a mass being carried". */
const RIG = (travel, sway) => `
  .w-trolley { transform: translate(calc(var(--x0) + var(--jib) * var(--from)), var(--y));
               animation: w-travel ${travel}s cubic-bezier(.45,.05,.55,.95) infinite alternate;
               will-change: transform; }
  @keyframes w-travel {
    from { transform: translate(calc(var(--x0) + var(--jib) * var(--from)), var(--y)); }
    to   { transform: translate(calc(var(--x0) + var(--jib) * var(--to)),   var(--y)); }
  }
  .w-hook { transform-origin: 0 0;
            animation: w-sway ${sway}s cubic-bezier(.37,0,.63,1) calc(-1 * ${sway}s * .27) infinite alternate;
            will-change: transform; }
  @keyframes w-sway { from { transform: rotate(-2.6deg); } to { transform: rotate(2.6deg); } }
`;

/* One light, crossing the world. `soft-light` brightens the paper instead of
 * greying it, and one wide band composites more cheaply than a gradient stack
 * or any filter. */
const LIGHT = (dur, width, alpha) => `
  .w-light { position:absolute; inset-block:0; inset-inline-start:-${width}%;
             inline-size:${width}%; pointer-events:none; z-index:1;
             background: linear-gradient(100deg, transparent, rgb(255 252 244 / ${alpha}) 46%, rgb(255 250 238 / ${alpha * 0.6}) 60%, transparent);
             mix-blend-mode: soft-light;
             animation: w-light ${dur}s linear infinite; will-change: transform; }
  @keyframes w-light { from { transform: translate3d(0,0,0); }
                       to   { transform: translate3d(${Math.round(100 / (width / 100) + 120)}%,0,0); } }
`;

/* ========================================================================
 * PASS 1 -- RESTRAINED LIVING ENVIRONMENT
 * ========================================================================
 * The committed composition, with the band given a real world instead of one
 * elevation, and motion raised to the threshold of perception. Nothing below
 * the instrument changes except that the chapter breaks become setting-out
 * lines -- so the page still reads as a sheet, and the world is still
 * confined to the one zone where atmosphere was already permitted.
 */
export const pass1 = {
  name: "restrained",
  css: `${INK}
  ${RIG(26, 7.5)}
  ${LIGHT(34, 46, 0.5)}
  .ui-horizon { --band: 250px; padding-block-start: calc(var(--band) + 20px) !important; }
  .ui-horizon__scene { display:none !important; }
  .w-band { position:absolute; inset-block-start:0; inset-inline:0; block-size:var(--band);
            overflow:hidden; z-index:0; pointer-events:none;
            -webkit-mask-image: linear-gradient(90deg, transparent, #000 26%, #000 100%);
            mask-image: linear-gradient(90deg, transparent, #000 26%, #000 100%); }
  .w-band .w-svg { inset-block-start:auto; inset-block-end:0; block-size:100%; }
  .ui-horizon__content { position:relative; z-index:2; }

  /* Chapter breaks become setting-out lines: a rule with a tick at each end,
   * the drawing convention for "this distance is measured". */
  .ui-chart, .ui-dl, .ui-pipe { position:relative; }
  .ui-chart::before, .ui-dl::before, .ui-pipe::before {
    content:""; position:absolute; inset-inline:0; inset-block-start:calc(-1 * var(--ui-space-6));
    block-size:0; border-block-start:1px solid var(--ui-line, #e4e6e9);
    mask-image: linear-gradient(90deg, #000 0 12px, transparent 12px calc(100% - 12px), #000 calc(100% - 12px));
    -webkit-mask-image: linear-gradient(90deg, #000 0 12px, transparent 12px calc(100% - 12px), #000 calc(100% - 12px));
  }
  @media (prefers-reduced-motion: reduce) {
    .w-trolley, .w-hook, .w-light { animation: none !important; }
    .w-light { transform: translate3d(140%,0,0); }
  }`,
  mount(root, render, worlds) {
    const band = document.createElement("div");
    band.className = "w-band";
    /* Cropped to the structure: from above the tallest crane apex down to
     * just below the ground line. 2400 x 560 is 4.3:1, which a 250px band
     * holds at 1440 with the whole world visible rather than sliced. */
    band.innerHTML = render(worlds.operations, { par: "xMidYMax meet", crop: [0, 150, 2400, 560] }) +
      `<div class="w-light"></div>`;
    const horizon = root.querySelector(".ui-horizon");
    horizon.insertBefore(band, horizon.firstChild);
  },
};

/* ========================================================================
 * PASS 2 -- DEEP SPATIAL OPERATING ENVIRONMENT
 * ========================================================================
 * The world leaves the band and becomes the room the page is in: one fixed
 * environment behind the entire route, five planes parallaxing at different
 * rates against scroll.
 *
 * The data never sits on top of geometry. The chapters are opaque sheets that
 * OCCLUDE the world; the environment is visible in the gutters, in the band,
 * and between chapters. That is the difference between spatial depth and a
 * watermark: you see the world THROUGH the composition, not behind the text.
 */
export const pass2 = {
  name: "spatial",
  css: `${INK}
  .w-room { --w-far:#c3c9d0; --w-mid:#a7aeb6; --w-ink:#848c94; --w-near:#6d757e; }
  ${RIG(24, 7)}
  ${LIGHT(42, 52, 0.55)}
  .w-room { position:fixed; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
  .w-room .w-svg { block-size:118%; inset-block-end:-9%; }
  .w-plane { transform: translate3d(0, calc(var(--scroll,0px) * var(--depth) * -1), 0);
             will-change: transform; }
  .page-content { position:relative; z-index:2; }

  /* Sheets. Opaque, so no figure is ever read against a line. */
  .ui-horizon, .ui-health, .ui-chart, .ui-dl, .ui-pipe, .ui-activity {
    position:relative; background: var(--ui-surface, #fff);
    box-shadow: 0 0 0 var(--ui-space-4) var(--ui-surface, #fff);
    border-radius: 2px;
  }
  /* The horizon is an OPAQUE sheet with a window cut in its top. Making it
   * transparent put structural geometry behind the attention rows -- the one
   * thing the environmental rule forbids. The room is seen AROUND the
   * composition: in the gutters, above the first sheet, between chapters. */
  .ui-horizon { padding-block-start: 250px !important; }
  .ui-horizon__scene { display:none !important; }

  /* The band is the window: the only place the room is seen at full strength. */
  .w-band { position:absolute; inset-block-start:0; inset-inline:0; block-size:230px;
            overflow:hidden; z-index:0; pointer-events:none;
            -webkit-mask-image: linear-gradient(90deg, transparent, #000 22%);
            mask-image: linear-gradient(90deg, transparent, #000 22%); }
  .w-band .w-svg { inset-block-end:0; inset-block-start:auto; block-size:100%; }
  .ui-horizon__content { position:relative; z-index:2; }

  /* Datum rules that belong to the room, not to the section. */
  .ui-chart::before, .ui-dl::before, .ui-pipe::before, .ui-activity::before {
    content:""; position:absolute; inset-inline:-24px; inset-block-start:-26px;
    block-size:0; border-block-start:1px solid var(--ui-line, #e4e6e9); }
  @media (prefers-reduced-motion: reduce) {
    .w-trolley, .w-hook, .w-light { animation:none !important; }
    .w-light { transform: translate3d(150%,0,0); }
    .w-plane { transform:none !important; }
  }`,
  mount(root, render, worlds) {
    const room = document.createElement("div");
    room.className = "w-room";
    room.innerHTML = render(worlds.operations, { par: "xMidYMax slice", lights: true }) +
      `<div class="w-light"></div>`;
    document.body.insertBefore(room, document.body.firstChild);

    const band = document.createElement("div");
    band.className = "w-band";
    band.innerHTML = render(worlds.register, { par: "xMaxYMax meet", crop: [700, 150, 1700, 560] });
    const horizon = root.querySelector(".ui-horizon");
    horizon.insertBefore(band, horizon.firstChild);

    /* One passive listener, one rAF, one custom property. The planes are
     * translated by the compositor; nothing here reads layout. */
    let y = 0, queued = false;
    const write = () => { queued = false; room.style.setProperty("--scroll", y * 0.35 + "px"); };
    addEventListener("scroll", () => {
      y = scrollY;
      if (!queued) { queued = true; requestAnimationFrame(write); }
    }, { passive: true });
  },
};

/* ========================================================================
 * PASS 3 -- FLAGSHIP CINEMATIC OPERATING CENTRE
 * ========================================================================
 * Pass 2's room, plus the things that make it feel authored rather than
 * generated: the structure assembles itself once on arrival, the light casts
 * a direction, the near plane answers the pointer, particulate drifts in the
 * work light, and the chapters' setting-out lines draw as they are reached.
 *
 * Everything added here is transform/opacity on a plane that carries no text.
 */
export const pass3 = {
  name: "cinematic",
  css: `${INK}
  .w-room { --w-far:#bcc3cb; --w-mid:#9fa7b0; --w-ink:#7b848d; --w-near:#636c76; }
  ${RIG(21, 6.4)}
  ${LIGHT(38, 58, 0.62)}
  .w-room { position:fixed; inset:0; z-index:0; overflow:hidden; pointer-events:none;
            perspective: 1400px; }
  .w-room .w-svg { block-size:124%; inset-block-end:-12%; }
  .w-plane { transform:
      translate3d(calc(var(--px,0) * var(--depth) * -26px),
                  calc(var(--scroll,0px) * var(--depth) * -1), 0);
      will-change: transform; }
  .page-content { position:relative; z-index:2; }

  .ui-horizon, .ui-health, .ui-chart, .ui-dl, .ui-pipe, .ui-activity {
    position:relative; background: var(--ui-surface,#fff);
    box-shadow: 0 0 0 var(--ui-space-4) var(--ui-surface,#fff),
                0 18px 40px -32px rgb(24 26 30 / .34);
    border-radius: 2px; }
  /* Opaque, as in pass 2, and for the same reason. */
  .ui-horizon { padding-block-start: 270px !important; }
  .ui-horizon__scene { display:none !important; }

  .w-band { position:absolute; inset-block-start:0; inset-inline:0; block-size:250px;
            overflow:hidden; z-index:0; pointer-events:none;
            -webkit-mask-image: linear-gradient(90deg, transparent, #000 20%);
            mask-image: linear-gradient(90deg, transparent, #000 20%); }
  .w-band .w-svg { inset-block-end:0; inset-block-start:auto; block-size:100%; }
  .ui-horizon__content { position:relative; z-index:2; }

  /* ---- Arrival: the structure is SET OUT, once ------------------------ */
  .w-beam { stroke-dasharray: 1200; stroke-dashoffset: 1200;
            animation: w-draw 900ms cubic-bezier(.16,1,.3,1) calc(var(--i) * 90ms + 160ms) both; }
  @keyframes w-draw { to { stroke-dashoffset: 0; } }
  .w-crane { transform-box: fill-box; transform-origin: 50% 100%;
             animation: w-raise 1100ms cubic-bezier(.16,1,.3,1) calc(var(--i) * 180ms) both; }
  @keyframes w-raise { from { transform: scaleY(.82); opacity:0; } to { transform:none; opacity:1; } }
  .w-lit { opacity:0; animation: w-lamp 2.4s ease-out calc(var(--i) * 700ms + 1200ms) both; }
  @keyframes w-lamp { from { opacity:0; } to { opacity:.85; } }

  /* ---- Particulate in the work light ---------------------------------- */
  .w-mote { fill: var(--w-near,#7d858d); stroke:none; opacity:.16;
            animation: w-drift calc(26s + var(--i) * 1.4s) linear var(--d) infinite; }
  @keyframes w-drift {
    from { transform: translate3d(0,0,0); opacity:0; }
    12%  { opacity:.20; }
    88%  { opacity:.14; }
    to   { transform: translate3d(120px,-190px,0); opacity:0; }
  }

  /* ---- Setting-out lines draw as chapters are reached ------------------ */
  .w-rule { position:absolute; inset-inline:-24px; inset-block-start:-26px; block-size:0;
            border-block-start:1px solid var(--ui-line,#e4e6e9);
            transform: scaleX(0); transform-origin: 0 50%;
            transition: transform 900ms cubic-bezier(.16,1,.3,1); }
  .w-rule[data-in="1"] { transform: scaleX(1); }

  /* ---- Material response ---------------------------------------------- */
  .ui-attention__row, .ui-pipe__row, .ui-activity__row, [class*="__row"] {
    transition: transform 220ms cubic-bezier(.2,.7,.3,1), box-shadow 220ms ease; }
  .ui-attention__row:hover, [class*="__row"]:hover {
    transform: translateX(2px);
    box-shadow: inset 2px 0 0 var(--ui-ink,#14161a); }
  .ui-attention__row:active, [class*="__row"]:active { transform: translateX(1px) translateY(.5px); }

  @media (prefers-reduced-motion: reduce) {
    .w-trolley,.w-hook,.w-light,.w-mote,.w-beam,.w-crane,.w-lit { animation:none !important; }
    .w-beam { stroke-dashoffset:0; }
    .w-crane { transform:none; opacity:1; }
    .w-lit { opacity:.85; }
    .w-light { transform: translate3d(150%,0,0); }
    .w-plane { transform: translate3d(0,0,0) !important; }
    .w-rule { transform: scaleX(1); transition:none; }
  }`,
  mount(root, render, worlds) {
    const room = document.createElement("div");
    room.className = "w-room";
    room.innerHTML = render(worlds.field, { par: "xMidYMax slice", lights: true, dust: true }) +
      `<div class="w-light"></div>`;
    document.body.insertBefore(room, document.body.firstChild);

    const band = document.createElement("div");
    band.className = "w-band";
    band.innerHTML = render(worlds.operations, { par: "xMaxYMax meet", crop: [600, 130, 1800, 580], lights: true });
    const horizon = root.querySelector(".ui-horizon");
    horizon.insertBefore(band, horizon.firstChild);

    let y = 0, px = 0, queued = false;
    const write = () => {
      queued = false;
      room.style.setProperty("--scroll", y * 0.4 + "px");
      room.style.setProperty("--px", px.toFixed(3));
    };
    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(write); } };
    addEventListener("scroll", () => { y = scrollY; schedule(); }, { passive: true });
    addEventListener("pointermove", (e) => {
      px = (e.clientX / innerWidth - 0.5) * 2;
      schedule();
    }, { passive: true });

    /* Setting-out lines, drawn on arrival into view. IntersectionObserver so
     * nothing is measured on scroll. */
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) e.target.dataset.in = "1"; }),
      { rootMargin: "-12% 0px -12% 0px" }
    );
    root.querySelectorAll(".ui-chart, .ui-dl, .ui-pipe, .ui-activity").forEach((s) => {
      const r = document.createElement("span");
      r.className = "w-rule";
      s.insertBefore(r, s.firstChild);
      io.observe(r);
    });
  },
};

/* Pass 3 with the particulate removed and the band sized for the viewport --
 * the variant used to isolate what the 55fps at rest was actually paying for. */
export const pass3lean = {
  name: "cinematic-lean",
  css: pass3.css + `
  @media (max-width: 48rem) {
    .ui-horizon { padding-block-start: 132px !important; }
    .w-band { block-size: 120px; }
    .w-room .w-svg { block-size: 100%; }
  }`,
  mount(root, render, worlds) {
    const orig = renderNoDust(render);
    pass3.mount.call(pass3, root, orig, worlds);
  },
};
function renderNoDust(render) {
  return (w, opts) => render(w, { ...opts, dust: false });
}

export const PASSES = { pass1, pass2, pass3, pass3lean };
