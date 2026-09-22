// STILL. One frame of one film, at full resolution, to a path a human can open.
//   node tools/still.mjs <film> [--shot <id>] [--frame N] [--out out/x.png] [--scale 1]
// The look still is rendered many times before a single frame of motion is, so
// this does exactly that and nothing else: build the page, draw the frame, write the PNG, print
// the draw cost and the frame's hash so a re-render can be proved identical.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildPage } from "./build-page.mjs";
import { detect } from "./detect.mjs";
import * as playwright from "./adapters/playwright.mjs";

const VAL = new Set(["shot", "out", "scale", "frame"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`still: ${m}`); process.exit(1); };
const film = pos[0] ?? die("usage: node tools/still.mjs <film> [--shot <id>] [--frame N] [--out out/x.png] [--scale 1]");
const scale = Number(opt.scale ?? 1);

const env = detect();
// A still needs a browser and nothing else: ffmpeg only matters once there is motion to encode.
if (!env.pw.ok || !env.browser.ok) die(`no browser to draw in.\n  playwright: ${env.report.playwright}\n  browser:    ${env.report.browser}\n  fix: npm install, then npx playwright-core install chromium`);
const page = await buildPage({ entry: `src/hosts/page-${film}.ts`, out: resolve(`dist/${film}.html`), title: film });
const session = await playwright.open(env, page.out, { scale, workers: 1 });
const meta = await session.info();
const probe = (await import("data:text/javascript;base64," + Buffer.from((await (await import("esbuild")).build({ stdin: { contents: `export { ${film} as film } from "./src/canvas-core/${film}";`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, platform: "neutral" })).outputFiles[0].text).toString("base64"))).film;
const shots = opt.shot ? [probe.shots.find((s) => s.id === opt.shot) ?? die(`no shot '${opt.shot}' (has: ${probe.shots.map((s) => s.id).join(", ")})`)] : probe.shots;

console.log(`film: "${meta.title}" ${meta.W}x${meta.H}, scale ${scale}`);
for (const s of shots) {
  const n = opt.frame !== undefined ? Number(opt.frame) : s.start;
  const out = resolve(shots.length === 1 && opt.out ? opt.out : `out/still-${film}-${s.id}.png`);
  const a = await session.frame(n, 0);
  const b = await session.frame(n, 0); // drawn twice: a still that is not reproducible is not a gate
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, a.png);
  const h = (p) => createHash("md5").update(p).digest("hex");
  console.log(`  ${s.id.padEnd(12)} frame ${String(n).padEnd(5)} draw ${a.drawMs.toFixed(0)} ms  md5 ${h(a.png)}  ${h(a.png) === h(b.png) ? "reproducible" : "NOT REPRODUCIBLE"}  -> ${out} (${(a.png.length / 1024).toFixed(0)} KB)`);
}
await session.close();
