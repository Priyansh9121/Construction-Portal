import { test } from "@playwright/test";
test.use({ headless: false, channel: "chrome", launchOptions: { args: ["--use-angle=metal"] } });

test.setTimeout(90000);
test("scale probe", async ({ page }) => {
  await page.goto("/login");
  await page.waitForFunction(() => document.querySelector("canvas")?.__perf, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const { scene, THREE } = c.__perf || {};
    if (!scene) return { err: "no scene" };
    const named = [];
    scene.traverse((o) => { if (o.isMesh && o.name === "login-site-architecture") named.push(o); });
    const one = new THREE.Box3().setFromObject(named[0]);
    const s1 = one.getSize(new THREE.Vector3());
    const all = new THREE.Box3();
    named.forEach((m) => all.expandByObject(m));
    const sa = all.getSize(new THREE.Vector3());
    const first = scene.getObjectByName("login-site-architecture");
    return {
      meshesNamedArchitecture: named.length,
      firstIsSameAsNamed0: first === named[0],
      singleMeshBox: [ +s1.x.toFixed(2), +s1.y.toFixed(2), +s1.z.toFixed(2) ],
      wholeLayerBox: [ +sa.x.toFixed(2), +sa.y.toFixed(2), +sa.z.toFixed(2) ],
      perMeshWidths: named.map((m) => {
        const b = new THREE.Box3().setFromObject(m);
        return +b.getSize(new THREE.Vector3()).x.toFixed(2);
      }),
      siteScale: c.__siteScale,
    };
  });
  console.log("PROBE " + JSON.stringify(r, null, 1));
});
