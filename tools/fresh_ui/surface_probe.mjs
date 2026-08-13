/**
 * Ask the LIVE scene what a surface actually is, instead of guessing from a
 * screenshot.
 *
 * WHY THIS EXISTS
 * ---------------
 * The foreground carriageway read as flat grey paint, and the three plausible
 * explanations -- texture never attached, wrong UV scale, fog washing it out --
 * are indistinguishable by eye. This raycasts into the frame and reports, per
 * hit: the material name, whether the CC0 maps are bound, the image size, the
 * mesh's real UV span (which is the world tile, since the export cube-projects
 * at metre scale), plus the scene's fog and tone mapping.
 *
 * It answered the question in one run: the maps WERE bound at the correct
 * 2 m tile, and the surface was being sampled at a few degrees off grazing
 * with anisotropy 4 -- so hundreds of texels averaged into one. Nothing about
 * that is visible in a screenshot.
 *
 * The Login must be running. Read-only; it never touches the page state.
 *
 *     node tools/fresh_ui/surface_probe.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(path.join(root, "frontend/package.json"))("@playwright/test");
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
await p.waitForFunction(() => document.querySelector("canvas")?.__perf, null, { timeout: 30000 });
await p.waitForTimeout(3000);
const out = await p.evaluate(() => {
  const { THREE, scene, renderer, rig } = document.querySelector("canvas").__perf;
  const camera = rig.cam;
  const rc = new THREE.Raycaster();
  const rows = [];
  // sample points across the lower third of the frame in NDC
  for (const [nx, ny] of [[-0.6,-0.75],[0,-0.75],[0.5,-0.6],[0,-0.5],[0.6,-0.9]]) {
    rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = rc.intersectObjects(scene.children, true).filter(h => h.object.isMesh)[0];
    if (!hit) { rows.push({ nx, ny, hit: "none" }); continue; }
    const m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
    const g = hit.object.geometry;
    const uv = g.attributes.uv;
    let uMin=1e9,uMax=-1e9,vMin=1e9,vMax=-1e9;
    if (uv) for (let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);
      if(u<uMin)uMin=u; if(u>uMax)uMax=u; if(v<vMin)vMin=v; if(v>vMax)vMax=v;}
    rows.push({
      nx, ny, dist: +hit.distance.toFixed(1),
      obj: hit.object.name || "(unnamed)",
      parent: hit.object.parent?.name || "",
      mat: m.name,
      map: m.map ? `${m.map.image?.width}x${m.map.image?.height}` : "NONE",
      rough: m.roughnessMap ? "y" : "n",
      norm: m.normalMap ? "y" : "n",
      color: `#${m.color.getHexString()}`,
      uv: uv ? `${uMin.toFixed(1)}..${uMax.toFixed(1)} / ${vMin.toFixed(1)}..${vMax.toFixed(1)}` : "NO UV",
    });
  }
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const fog = scene.fog ? {
    type: scene.fog.isFogExp2 ? "exp2" : "linear",
    color: "#" + scene.fog.color.getHexString(),
    density: scene.fog.density, near: scene.fog.near, far: scene.fog.far,
  } : null;
  // Actual rendered pixel at the same NDC points
  const c = renderer.domElement;
  const g2 = document.createElement("canvas");
  g2.width = c.width; g2.height = c.height;
  g2.getContext("2d").drawImage(c, 0, 0);
  const ctx = g2.getContext("2d");
  const px = [[-0.6,-0.75],[0,-0.75],[0.5,-0.6],[0.6,-0.9]].map(([nx,ny]) => {
    const x = Math.round((nx + 1) / 2 * c.width);
    const y = Math.round((1 - ny) / 2 * c.height);
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { nx, ny, rgb: [d[0], d[1], d[2]] };
  });
  const env = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
                envIntensity: scene.environmentIntensity, bg: scene.background?.isColor ? "#"+scene.background.getHexString() : String(scene.background?.type || scene.background) };
  return { rows, aniso, fog, px, env };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
