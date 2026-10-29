#!/usr/bin/env node
// END-TO-END TESTS for the motion lane's tools on real rendered films (the unit tests in
// test/motionscan.test.ts and test/motionKit.test.ts feed the detectors synthetic data; this runs the
// whole path: page, render, decode). Two fixture films (src/canvas-core/fixtureMotion.ts):
//   fixtureDeck   RED: must fail motionscan (slide cuts, carousel, fade-in) and layerscan (lingering
//                 exits, fast text, a frieze over a face, translucent brand yellow)
//   fixtureWorld  GREEN: the same material as one world under one camera: must pass both
// plus the render blur mask (type stays sharp under --blur, blurs under --blur-all) and lock.mjs (a live
// sha passes, a wrong one fails, --unlock lets it through), and worldfilm.mjs (a scaffolded one-world film
// passes both scans; its two files are removed afterwards). Renders only under .tmp/motion-e2e/.
//   node tools/motion-e2e.mjs
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { buildPage } from "./build-page.mjs";
import { detect } from "./detect.mjs";
import * as playwright from "./adapters/playwright.mjs";
import { motionScan } from "./motionscan.mjs";
import { layerScan } from "./layerscan.mjs";
import { checkLocks, shotShas } from "./lock.mjs";

const dir = resolve(".tmp/motion-e2e"); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
let pass = 0; const ok = (label) => console.log(`PASS ${++pass} ${label}`);
const render = (film, ...extra) => { const out = `${dir}/${film}.mp4`; execFileSync(process.execPath, ["tools/render.mjs", film, "--out", out, ...extra], { stdio: "pipe" }); return out; };

const deck = await motionScan(render("fixtureDeck"), { temperament: "lively" }), world = await motionScan(render("fixtureWorld"), { temperament: "lively" });
assert.equal(deck.checks.slidecut.status, "FAIL"); assert.equal(deck.checks.repeat.status, "FAIL"); assert.equal(deck.checks.dissolve.status, "FAIL");
ok(`motionscan RED fixtureDeck: ${deck.checks.slidecut.events.length} slide cuts, ${deck.checks.repeat.runs[0].length} beats in one layout, a fade-in`);
assert.equal(world.fail, false, JSON.stringify(Object.fromEntries(Object.entries(world.checks).map(([k, v]) => [k, v.status]))));
ok("motionscan GREEN fixtureWorld: no slide cut, no carousel, no dissolve, inside the lively temperament");

const ld = await layerScan("fixtureDeck"), lw = await layerScan("fixtureWorld");
for (const c of ["exits", "fasttext", "faces", "translucent"]) assert.equal(ld.checks[c].status, "FAIL", c);
ok(`layerscan RED fixtureDeck: ${ld.checks.exits.findings.length} lingering exits, ${ld.checks.fasttext.findings.length} fast lines, a face covered, translucent brand yellow`);
for (const c of ["exits", "fasttext", "faces", "translucent"]) assert.equal(lw.checks[c].status, "PASS", c);
ok("layerscan GREEN fixtureWorld: setType exits clear, type moves slowly, the frieze is behind the speaker, yellow is opaque");

// the blur mask, on the frame where slide 2 whips its title off
{
  const page = await buildPage({ entry: "src/hosts/page-fixtureDeck.ts", out: resolve("dist/fixtureDeck.html"), title: "fixtureDeck" });
  const s = await playwright.open(detect(), page.out, { workers: 1, bakeCache: false }), n = 116;
  const [layer] = await s.layers([n], []), t = layer.recs.find((r) => r.kind === "text"), sharp = await s.frame(n), masked = await s.blur(n, { samples: 8, shutter: 360, sharp: true }), all = await s.blur(n, { samples: 8, shutter: 360 , sharp: false });
  await s.close();
  const grey = (png) => execFileSync("ffmpeg", ["-v", "error", "-i", "-", "-vf", `crop=${Math.round(t.x1 - t.x0) - 4}:${Math.round(t.y1 - t.y0)}:${Math.round(t.x0) + 2}:${Math.round(t.y0)},format=gray`, "-f", "rawvideo", "-"], { input: png });
  const d = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length, A = grey(sharp.png);
  assert.ok(masked.sharpPx > 0 && d(A, grey(masked.png)) < 0.5 && d(A, grey(all.png)) > 5, `masked ${d(A, grey(masked.png))}, all ${d(A, grey(all.png))}`);
  ok(`render --blur keeps the whipping title sharp (${masked.sharpPx} px kept); --blur-all smears it`);
}

// lock.mjs
{
  const { shas } = await shotShas("fixtureWorld", ["world"]), live = shas.world.sha;
  assert.equal((await checkLocks("fixtureWorld", { approved: [["world", live, "e2e"]] })).fail, false); ok(`lock: the approved shot unchanged passes (${live})`);
  const bad = await checkLocks("fixtureWorld", { approved: [["world", "0000000000000000", "e2e"]] }); assert.equal(bad.fail, true); assert.equal(bad.checked[0].status, "changed"); ok("lock RED: a shot whose frames changed since approval fails");
  assert.equal((await checkLocks("fixtureWorld", { approved: [["world", "0000000000000000", "e2e"]], unlock: ["world"] })).fail, false); ok("lock: --unlock lets a deliberate change through (and says so)");
  assert.equal((await checkLocks("fixtureWorld", { approved: [["gone", "0", "e2e"]] })).checked[0].status, "missing"); ok("lock RED: an approved shot that no longer exists fails");
}
// worldfilm.mjs: a film started as one world passes both scans out of the box
{
  const name = "motionE2eWorld", mod = `src/canvas-core/${name}.ts`, host = `src/hosts/page-${name}.ts`;
  try {
    execFileSync(process.execPath, ["tools/worldfilm.mjs", name, "--beats", "3"], { stdio: "pipe" });
    const r = await motionScan(render(name, "--scale", "0.5")), l = await layerScan(name, { every: 2 });
    assert.equal(r.fail, false, JSON.stringify(Object.fromEntries(Object.entries(r.checks).map(([k, v]) => [k, v.status]))));
    assert.equal(l.fail, false, JSON.stringify(Object.fromEntries(Object.entries(l.checks).map(([k, v]) => [k, v.status]))));
    ok(`worldfilm: a new one-world film passes motionscan (temperament ${r.checks.temperament.status}) and layerscan as scaffolded`);
  } finally { for (const f of [mod, host, `dist/${name}.html`]) rmSync(f, { force: true }); }
}
rmSync(dir, { recursive: true, force: true });
console.log(`\nMOTION E2E: PASS ${pass}`);
