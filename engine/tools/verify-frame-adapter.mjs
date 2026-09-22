// VERIFY FRAME ADAPTER. Hyperframes is not installed here, so its own engine cannot be run. What
// CAN be proved is the half of the contract this repo owns: the page-side FrameAdapter that the
// engine would drive. This holds it to Hyperframes' published requirements, using playwright as a
// stand-in driver:
//
//   a finite, non-negative frame count
//   forward, backward and RANDOM seeks
//   the same state whenever the same frame is asked for again
//   and, the part that actually matters, seeked pixels identical to the plain player's
//
// If the engine is ever installed, this stays useful: it isolates a page-side fault from an
// engine-side one, which is the difference between an hour and a day.
//
//   node tools/verify-frame-adapter.mjs [film]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPage } from "./build-page.mjs";
import { FRAME_ADAPTER, ENGINE, INSTALL, probe } from "./adapters/hyperframes.mjs";
import { detect } from "./detect.mjs";

const film = process.argv[2] ?? "mechanicalLepidoptera";
const dir = resolve(".tmp/hyperframes", film); mkdirSync(dir, { recursive: true });
const out = join(dir, `${film}.html`);
const built = await buildPage({ entry: `src/hosts/page-${film}.ts`, out, title: film });
writeFileSync(out, readFileSync(out, "utf8").replace("</body>", `<script>${FRAME_ADAPTER(film)}</script></body>`));

const env = detect();
const browser = await env.pw.lib.chromium.launch({ executablePath: env.browser.executablePath });
const page = await (await browser.newContext({ viewport: { width: 640, height: 640 } })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto(pathToFileURL(out).href + "?adapter=hyperframes");
await page.evaluate(() => window.__hfAdapter.init());

let fails = 0;
const say = (ok, label, detail = "") => { if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   " + detail : ""}`); };

const shape = await page.evaluate(() => ({ id: window.__hfAdapter.id, types: ["init","getDurationFrames","seekFrame","destroy"].map(k => typeof window.__hfAdapter[k]), hf: [typeof window.__hf.duration, typeof window.__hf.seek] }));
say(shape.id === film, "the adapter carries the film's id", shape.id);
say(shape.types.every(t => t === "function"), "init, getDurationFrames, seekFrame, destroy are all functions", shape.types.join(", "));
say(shape.hf.every(t => t === "function"), "window.__hf exposes duration and seek too", shape.hf.join(", "));

const dur = await page.evaluate(() => window.__hfAdapter.getDurationFrames());
say(Number.isFinite(dur) && dur > 0 && Number.isInteger(dur), "getDurationFrames() is finite and non-negative", String(dur));
say(dur === built.meta.durationFrames, "it agrees with the film", `${dur} vs ${built.meta.durationFrames}`);

const seek = async (n) => page.evaluate((f) => { window.__hfAdapter.seekFrame(f); return window.FILM.hash(); }, n);
const order = [0, 900, 45, 1409, 300, 1409, 45, 0, 900, 300];   // forward, backward and random, with repeats
const seen = new Map(), mismatch = [];
for (const n of order) { const h = await seek(n); if (seen.has(n) && seen.get(n) !== h) mismatch.push(n); seen.set(n, h); }
say(mismatch.length === 0, "the same frame gives the same state however it is reached", mismatch.length ? `drifted at ${mismatch.join(", ")}` : `${order.length} seeks, ${seen.size} distinct frames, forward + backward + random`);
say(new Set(seen.values()).size === seen.size, "different frames are genuinely different pixels", `${new Set(seen.values()).size}/${seen.size} distinct hashes`);
say(errs.length === 0, "no page error while seeking", errs.slice(0, 2).join("; ") || "none");

// The real proof: a seek-driven hash must equal what the plain player draws cold for that frame.
const fresh = await (await browser.newContext({ viewport: { width: 640, height: 640 } })).newPage();
await fresh.goto(pathToFileURL(out).href + "?adapter=check");
await fresh.evaluate(async () => { await window.FILM.ready; window.FILM.mount(1); });
const bad = [];
for (const [n, h] of seen) { const c = await fresh.evaluate((f) => { window.FILM.seek(f); return window.FILM.hash(); }, n); if (c !== h) bad.push(n); }
say(bad.length === 0, "seeked frames match the same frames drawn by the plain player", bad.length ? `differ at ${bad.join(", ")}` : `${seen.size} frames`);

await browser.close();
console.log(`\nPAGE-SIDE FRAME ADAPTER: ${fails ? `FAIL (${fails})` : "PASS"}   engine itself: ${probe().ok ? "installed" : `NOT RUN (${ENGINE} absent, ${INSTALL})`}`);
process.exit(fails ? 1 : 0);
