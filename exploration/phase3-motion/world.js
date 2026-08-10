/*
 * Renders a generated world (tools/scene/generate_world.py) into five layered
 * SVG groups, one per depth plane.
 *
 * Every plane is a sibling <g> rather than a nested transform, so a plane can
 * be translated by the parallax controller without the browser re-resolving
 * the whole tree, and so a plane can be dropped entirely (reduced motion,
 * narrow viewport) without disturbing the others.
 */

export function renderWorld(w, opts = {}) {
  const [, , VW, VH] = w.viewBox;
  const G = w.ground;
  const near = w.near;
  const f = w.frame;

  const line = (x0, y0, x1, y1, c = "") =>
    `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"${c ? ` class="${c}"` : ""}/>`;
  const rect = (x, y, wd, h, c = "") =>
    `<rect x="${x}" y="${y}" width="${wd}" height="${h}"${c ? ` class="${c}"` : ""}/>`;

  /* ---- 0 haze ---------------------------------------------------------- */
  const haze = w.haze
    .map((b) => `<rect x="0" y="${b.y}" width="${VW}" height="${b.h}" fill="currentColor" opacity="${b.o}"/>`)
    .join("");

  /* ---- 1 distant ------------------------------------------------------- */
  const distant =
    w.distant.map((b) => rect(b.x, b.y, b.w, b.h)).join("") +
    /* Building lights: a handful of lit floors on the distant massing. They
     * fade up on a long stagger. They represent NOTHING -- they are weather,
     * not data -- which is why they are placed by geometry and not by any
     * value the product holds. */
    (opts.lights
      ? w.distant
          .filter((_, i) => i % 3 === 1)
          .map((b, i) => {
            const lx = b.x + b.w * 0.35;
            const ly = b.y + b.h * 0.28;
            return `<rect class="w-lit" style="--i:${i}" x="${lx}" y="${ly}" width="${Math.min(14, b.w * 0.2)}" height="7"/>`;
          })
          .join("")
      : "");

  /* ---- 2 frame --------------------------------------------------------- */
  const frame =
    f.cols.map((c) => line(c.x, c.y0, c.x, c.y1)).join("") +
    f.beams.map((b, i) => `<line class="w-beam" style="--i:${i}" x1="${b.x0}" y1="${b.y}" x2="${b.x1}" y2="${b.y}"/>`).join("") +
    f.braces.map((b) => line(b.x0, b.y0, b.x1, b.y1, "w-brace")).join("") +
    line(f.partial.x0, f.partial.y, f.partial.x1, f.partial.y, "w-partial");

  /* ---- 3 rigs ---------------------------------------------------------- */
  const rig = (g, idx) => {
    const a = g.apex;
    const jy = g.jib.y;
    return (
      `<g class="w-crane" style="--jib:${g.jib.x1 - g.jib.x0}px;--from:${g.travel.from};--to:${g.travel.to};--i:${idx}">` +
      line(a.x, a.y, g.base.x, g.base.y) +
      g.ties.map((y) => line(a.x - 9, y, a.x + 9, y)).join("") +
      line(g.tower_top.x0, a.y, g.tower_top.x1, a.y) +
      line(g.jib.x0, jy, g.jib.x1, jy) +
      line(g.back.x0, jy, g.back.x1, jy) +
      /* Pennant stays: the diagonals from the mast head out to the jib and
       * counter-jib. Without them a crane reads as a plus sign. */
      line(a.x, a.y - 26, g.jib.x0 + (g.jib.x1 - g.jib.x0) * 0.62, jy) +
      line(a.x, a.y - 26, g.back.x0, jy) +
      line(a.x, a.y, a.x, a.y - 26) +
      rect(g.cwt.x, g.cwt.y, g.cwt.w, g.cwt.h) +
      rect(g.cab.x, g.cab.y, g.cab.w, g.cab.h) +
      /* The trolley carries its own cable and load, so the whole assembly
       * travels as one transform and the hook can sway inside it. */
      `<g class="w-trolley" style="--x0:${g.jib.x0}px;--y:${jy}px">` +
      rect(-7, -5, 14, 10) +
      `<g class="w-hook">` +
      line(0, 0, 0, g.hook_drop) +
      rect(-11, g.hook_drop, 22, 9) +
      `</g></g></g>`
    );
  };
  const rigs = w.rigs.map(rig).join("");

  /* ---- 4 near ---------------------------------------------------------- */
  const nearG =
    near.standards.map((s) => line(s.x, s.y0, s.x, s.y1)).join("") +
    near.ledgers.map((l) => line(l.x0, l.y, l.x1, l.y)).join("") +
    near.marks
      .map(
        (m) =>
          line(m.x, G - 16, m.x, G + 16, "w-mark") +
          `<text class="w-mark-t" x="${m.x + 6}" y="${G + 26}">${m.label}</text>`
      )
      .join("");

  const dust = opts.dust
    ? `<g class="w-dust">${Array.from({ length: 22 }, (_, i) => {
        const x = ((i * 137) % 100) / 100;
        const y = ((i * 71) % 100) / 100;
        return `<circle class="w-mote" style="--i:${i};--d:${(i % 7) * 1.7}s" cx="${(x * VW).toFixed(0)}" cy="${(G - 40 - y * 300).toFixed(0)}" r="${(1 + (i % 3) * 0.6).toFixed(1)}"/>`;
      }).join("")}</g>`
    : "";

  /*
   * A band is not a room. Slicing a 2400x900 world into a 150px strip shows
   * the bottom 86 units above the ground line -- column bases and nothing
   * else, which is precisely the "faint lines in the header" failure. A band
   * therefore gets its own CROP of the world: the vertical range that
   * actually contains the structure, at an aspect the band can hold.
   */
  const vb = opts.crop ? opts.crop.join(" ") : `0 0 ${VW} ${VH}`;

  return `<svg class="w-svg" viewBox="${vb}" preserveAspectRatio="${opts.par || "xMidYMax slice"}" aria-hidden="true" focusable="false">
  <g class="w-plane w-haze"  style="--depth:0.04">${haze}</g>
  <g class="w-plane w-distant" style="--depth:0.10">${distant}</g>
  <g class="w-plane w-frame" style="--depth:0.24">${frame}</g>
  <g class="w-plane w-rigs"  style="--depth:0.38">${rigs}</g>
  <g class="w-plane w-near"  style="--depth:0.62">${nearG}${dust}</g>
</svg>`;
}
