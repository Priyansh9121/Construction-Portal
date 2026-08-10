/* Three finance-instrument concepts. Same geometry pipeline, three different
 * ideas of what the drawing IS. Injected into the live Dashboard. */

export const CSS = `
.fx { position:relative; font-variant-numeric: tabular-nums; }
.fx svg { display:block; width:100%; overflow:visible; }
.fx-plot { fill:none; vector-effect:non-scaling-stroke; }
.fx-datum { stroke: var(--ui-ink); stroke-width:1.5; }
.fx-grid  { stroke: var(--ui-line); stroke-width:1; }
.fx-inc   { stroke: var(--ui-finance-income); stroke-width:2; }
.fx-exp   { stroke: var(--ui-finance-expense); stroke-width:2; stroke-dasharray:6 3; }
.fx-mark  { stroke:none; }
.fx-mark-i{ fill: var(--ui-finance-income); }
.fx-mark-e{ fill: var(--ui-finance-expense); }
.fx-t     { font-size:11px; fill: var(--ui-ink-muted); stroke:none;
            font-family: var(--ui-font-mono,ui-monospace,monospace); letter-spacing:.06em; }
.fx-lab   { font-size:12px; font-weight:600; fill: var(--ui-ink-strong); stroke:none; letter-spacing:0; }
.fx-net   { font-size:12px; fill: var(--ui-ink-strong); stroke:none;
            font-family: var(--ui-font-mono,ui-monospace,monospace); }
.fx-brk   { stroke: var(--ui-ink); stroke-width:1; }
.fx-vert  { stroke: var(--ui-line); stroke-width:1; }
.fx-band  { fill: var(--ui-ink); opacity:.055; stroke:none; }
.fx-hatch { stroke: var(--ui-ink); stroke-width:1; opacity:.30; }
`;

const money = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const short = (n) => n >= 1e7 ? (n/1e7).toFixed(1)+"Cr" : n >= 1e5 ? (n/1e5).toFixed(1)+"L" : n >= 1e3 ? Math.round(n/1e3)+"k" : String(Math.round(n));

/* ---------------------------------------------------------------------------
 * A — SETTING OUT.  The drawing is a FIELD OF VERTICAL MEASUREMENTS.
 * Each observation is a setting-out line carrying two measured positions and a
 * dimension between them. Connecting lines are secondary.
 * ------------------------------------------------------------------------ */
export function conceptA(G, obs, box, W, H) {
  const dom = G.domainOf(obs), y = G.scaleY(dom, box), x = G.scaleX(obs.length, box);
  const ticks = G.ticksOf(dom);
  const one = obs.length === 1;
  const step = obs.length > 1 ? box.w / (obs.length - 1) : box.w;
  const dense = step < 26;

  return `<svg viewBox="0 0 ${W} ${H}">
  ${ticks.map(t => `<line class="fx-plot fx-grid" x1="${box.x}" y1="${y(t)}" x2="${box.x+box.w}" y2="${y(t)}"/>
     <text class="fx-t" x="${box.x-8}" y="${y(t)+4}" text-anchor="end">${short(t)}</text>`).join("")}
  <line class="fx-plot fx-datum" x1="${box.x}" y1="${y(0)}" x2="${box.x+box.w}" y2="${y(0)}"/>
  ${obs.map((o,i) => {
    const px = x(i), yi = y(o.income), ye = y(o.expense);
    const hi = Math.min(yi, ye), lo = Math.max(yi, ye);
    return `<line class="fx-plot fx-vert" x1="${px}" y1="${y(0)}" x2="${px}" y2="${hi}"/>
      ${(!dense || i%3===0) ? `<path class="fx-plot fx-brk" d="M${px+7} ${hi} h6 M${px+10} ${hi} V${lo} M${px+7} ${lo} h6"/>` : ""}
      <circle class="fx-mark fx-mark-i" cx="${px}" cy="${yi}" r="${one?5:3.2}"/>
      <rect class="fx-mark fx-mark-e" x="${px-3}" y="${ye-3}" width="6" height="6"/>`;
  }).join("")}
  ${one ? "" : `<path class="fx-plot fx-inc" d="${G.pathOf(obs,"income",x,y)}" opacity=".55"/>
                <path class="fx-plot fx-exp" d="${G.pathOf(obs,"expense",x,y)}" opacity=".55"/>`}
  ${one ? oneUp(obs[0], x(0), y, box) : ""}
  <text class="fx-lab" x="${x(obs.length-1)+8}" y="${y(obs.at(-1).income)+4}">Income</text>
  <text class="fx-lab" x="${x(obs.length-1)+8}" y="${y(obs.at(-1).expense)+4}">Expense</text>
</svg>`;
}

/* The single-instant assembly, shared shape across concepts but composed
 * differently by each. Two measured positions off one datum with the net as a
 * dimensioned separation. */
function oneUp(o, px, y, box) {
  const yi = y(o.income), ye = y(o.expense);
  const hi = Math.min(yi,ye), lo = Math.max(yi,ye);
  const bx = px + 90;
  return `<path class="fx-plot fx-brk" d="M${px} ${hi} H${bx} M${bx} ${hi} V${lo} M${px} ${lo} H${bx}"/>
    <path class="fx-plot fx-brk" d="M${bx-5} ${hi+6} l5 -6 l5 6 M${bx-5} ${lo-6} l5 6 l5 -6"/>
    <text class="fx-net" x="${bx+10}" y="${(hi+lo)/2-2}">NET</text>
    <text class="fx-lab" x="${bx+10}" y="${(hi+lo)/2+14}">${o.net>=0?"+":"−"}${money(Math.abs(o.net))}</text>
    <text class="fx-lab" x="${px+10}" y="${yi-10}">${money(o.income)}</text>
    <text class="fx-t"   x="${px+10}" y="${yi+4}">INCOME</text>
    <text class="fx-lab" x="${px+10}" y="${ye-10}">${money(o.expense)}</text>
    <text class="fx-t"   x="${px+10}" y="${ye+4}">EXPENSE</text>`;
}

/* ---------------------------------------------------------------------------
 * B — FINANCIAL FIELD.  Two paths through one continuous field, with the NET
 * region between them drawn as the dominant derived fact.
 * ------------------------------------------------------------------------ */
export function conceptB(G, obs, box, W, H) {
  const dom = G.domainOf(obs), y = G.scaleY(dom, box), x = G.scaleX(obs.length, box);
  const ticks = G.ticksOf(dom);
  const one = obs.length === 1;
  const band = one ? "" :
    `${G.pathOf(obs,"income",x,y)} L${x(obs.length-1)} ${y(obs.at(-1).expense)} ` +
    obs.slice().reverse().map((o,k)=>`L${x(obs.length-1-k)} ${y(o.expense)}`).join(" ") + " Z";

  return `<svg viewBox="0 0 ${W} ${H}">
  ${ticks.map(t => `<line class="fx-plot fx-grid" x1="${box.x}" y1="${y(t)}" x2="${box.x+box.w}" y2="${y(t)}"/>
     <text class="fx-t" x="${box.x-8}" y="${y(t)+4}" text-anchor="end">${short(t)}</text>`).join("")}
  ${band ? `<path class="fx-band" d="${band}"/>` : ""}
  <line class="fx-plot fx-datum" x1="${box.x}" y1="${y(0)}" x2="${box.x+box.w}" y2="${y(0)}"/>
  ${one ? oneUp(obs[0], x(0), y, box) : `
    <path class="fx-plot fx-inc" d="${G.pathOf(obs,"income",x,y)}"/>
    <path class="fx-plot fx-exp" d="${G.pathOf(obs,"expense",x,y)}"/>
    ${obs.map((o,i)=>`<circle class="fx-mark fx-mark-i" cx="${x(i)}" cy="${y(o.income)}" r="2.6"/>
       <circle class="fx-mark fx-mark-e" cx="${x(i)}" cy="${y(o.expense)}" r="2.6"/>`).join("")}
    <text class="fx-lab" x="${x(obs.length-1)+8}" y="${y(obs.at(-1).income)+4}">Income</text>
    <text class="fx-lab" x="${x(obs.length-1)+8}" y="${y(obs.at(-1).expense)+4}">Expense</text>`}
</svg>`;
}

/* ---------------------------------------------------------------------------
 * C — STRUCTURAL SECTION.  The datum is a beam. Income loads above it,
 * expense below it, so the NET is literally which side dominates and the
 * separation across the beam is the derived fact.
 * ------------------------------------------------------------------------ */
export function conceptC(G, obs, box, W, H) {
  let hi = 0; for (const o of obs) hi = Math.max(hi, o.income, o.expense);
  hi = hi * 1.12 || 1;
  const mid = box.y + box.h / 2;
  const half = box.h / 2;
  const y = (v) => mid - (v / hi) * half;            // signed: + up, - down
  const x = G.scaleX(obs.length, box);
  const one = obs.length === 1;
  const step = obs.length > 1 ? box.w / (obs.length - 1) : box.w;
  const bw = Math.max(2, Math.min(14, step * 0.42));

  return `<svg viewBox="0 0 ${W} ${H}">
  ${[0.5,1].map(f=>`<line class="fx-plot fx-grid" x1="${box.x}" y1="${y(hi*f/1.12)}" x2="${box.x+box.w}" y2="${y(hi*f/1.12)}"/>
    <line class="fx-plot fx-grid" x1="${box.x}" y1="${y(-hi*f/1.12)}" x2="${box.x+box.w}" y2="${y(-hi*f/1.12)}"/>
    <text class="fx-t" x="${box.x-8}" y="${y(hi*f/1.12)+4}" text-anchor="end">${short(hi*f/1.12)}</text>
    <text class="fx-t" x="${box.x-8}" y="${y(-hi*f/1.12)+4}" text-anchor="end">${short(hi*f/1.12)}</text>`).join("")}
  ${obs.map((o,i)=>{
    const px = x(i);
    return `<rect class="fx-mark fx-mark-i" x="${px-bw/2}" y="${y(o.income)}" width="${bw}" height="${mid-y(o.income)}"/>
      <rect class="fx-mark fx-mark-e" x="${px-bw/2}" y="${mid}" width="${bw}" height="${y(-o.expense)-mid}"/>
      ${one?"":`<line class="fx-plot fx-hatch" x1="${px}" y1="${y(o.income)}" x2="${px}" y2="${y(-o.expense)}"/>`}`;
  }).join("")}
  <line class="fx-plot fx-datum" x1="${box.x-10}" y1="${mid}" x2="${box.x+box.w+10}" y2="${mid}" stroke-width="2.5"/>
  ${one ? `<path class="fx-plot fx-brk" d="M${x(0)+40} ${y(obs[0].income)} H${x(0)+96} M${x(0)+96} ${y(obs[0].income)} V${y(-obs[0].expense)} M${x(0)+40} ${y(-obs[0].expense)} H${x(0)+96}"/>
    <text class="fx-net" x="${x(0)+106}" y="${mid-2}">NET</text>
    <text class="fx-lab" x="${x(0)+106}" y="${mid+14}">${obs[0].net>=0?"+":"−"}${money(Math.abs(obs[0].net))}</text>
    <text class="fx-lab" x="${x(0)+10}" y="${y(obs[0].income)-8}">${money(obs[0].income)}</text>
    <text class="fx-t" x="${x(0)+10}" y="${y(obs[0].income)+6}">INCOME</text>
    <text class="fx-lab" x="${x(0)+10}" y="${y(-obs[0].expense)+16}">${money(obs[0].expense)}</text>
    <text class="fx-t" x="${x(0)+10}" y="${y(-obs[0].expense)+30}">EXPENSE</text>` : `
    <text class="fx-t" x="${box.x+box.w+6}" y="${y(hi*0.5)}">IN</text>
    <text class="fx-t" x="${box.x+box.w+6}" y="${y(-hi*0.5)}">OUT</text>`}
</svg>`;
}

export const CONCEPTS = { A: conceptA, B: conceptB, C: conceptC };
