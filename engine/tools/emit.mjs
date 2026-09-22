// EMIT. Ship the film as ONE self-contained HTML file, to a path with the film's own name on it,
// and then prove that the file on disk is the film that passed the gate.
//
//   node tools/emit.mjs <film> [--out out/mechanical-lepidoptera.html] [--frames 24]
//
// The gate builds its page into dist/ as a means to an end: it needs something to drive. This is
// the end. The deliverable sits next to the MP4, named the same way, so the two cannot drift apart
// in a folder six months from now.
//
// Verification is deliberately done on the EMITTED file and not on the build that made it:
//   1 STATIC    the adapter's own ship-worthiness checks, imported rather than copied, so the
//               emitted page is held to exactly the bar the gate holds the dist page to.
//   2 OFFLINE   loaded from file://, with every request that is not file: or data: treated as a
//               failure. Reading the source proves it asks for nothing; this proves it takes
//               nothing when it runs.
//   3 SAME FILM the emitted page is asked for N frames spread across the whole film and its own
//               hashes are compared against the dist page the gate measured. Equal hashes mean
//               the thing being shipped is the thing that was approved, not a rebuild of it.
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPage } from "./build-page.mjs";
import { pageChecks, probe } from "./adapters/html-player.mjs";

const VAL = new Set(["out", "frames", "scale"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`emit: ${m}`); process.exit(1); };
const film = pos[0] ?? die("usage: node tools/emit.mjs <film> [--out out/x.html] [--frames 24]");
const kebab = film.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const out = resolve(opt.out ?? `out/${kebab}.html`);
const N = Math.max(4, +(opt.frames ?? 24)), SCALE = +(opt.scale ?? 1);

let fails = 0, checks = 0;
const say = (ok, label, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   " + detail : ""}`); };
const head = (n, t) => console.log(`\n${n}. ${t}\n${"-".repeat(58)}`);

const p = probe();
if (!p.ok) die(p.why);

// ---------------------------------------------------------------- emit
const ship = await buildPage({ entry: `src/hosts/page-${film}.ts`, out, title: film });
const dist = resolve(`dist/${film}.html`);
await buildPage({ entry: `src/hosts/page-${film}.ts`, out: dist, title: film }); /* the gate's page, to compare the shipped one against */
const DUR = ship.meta.durationFrames;
if (!Number.isInteger(DUR) || DUR < 2) die(`the film reports no usable length (durationFrames = ${DUR}): nothing below could be trusted`);
console.log(`EMIT   "${ship.meta.title}"  ${ship.meta.W}x${ship.meta.H}  ${DUR} frames @ ${ship.meta.fps}fps`);
console.log(`       ${out}  (${(ship.bytes / 1024).toFixed(0)} KB, self-contained)`);

// ---------------------------------------------------------------- 1. static
head(1, "SHIP-WORTHY  the file reaches outside itself for nothing");
const html = readFileSync(out, "utf8");
pageChecks(html).forEach((c) => say(c.ok, c.label, c.detail));
say(statSync(out).size === ship.bytes, "the file on disk is the file that was built", `${statSync(out).size} bytes`);

// ---------------------------------------------------------------- 2 & 3. run it
const browser = await p.env.pw.lib.chromium.launch({ executablePath: p.env.browser.executablePath, args: ["--disable-background-timer-throttling"] });
const context = await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
const openPage = async (file) => {
  const page = await context.newPage(), errors = [], reached = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
  page.on("request", (r) => { const u = r.url(); if (!u.startsWith("file:") && !u.startsWith("data:") && !u.startsWith("blob:")) reached.push(u); });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(async (s) => { await window.FILM.ready; window.FILM.mount(s); window.FILM.warm(); }, SCALE);
  return { page, errors, reached };
};

const shipped = await openPage(out);
head(2, "OFFLINE  it does not just ASK for nothing, it TAKES nothing");
say(shipped.errors.length === 0, "the page runs clean, start to warm", shipped.errors.slice(0, 3).join("; ") || "no page error");
say(shipped.reached.length === 0, "nothing outside file: or data: was requested", shipped.reached.slice(0, 3).join("; ") || "0 outside requests");
const meta = await shipped.page.evaluate(() => window.FILM.meta);
say(meta.durationFrames === DUR && meta.fps === ship.meta.fps, "the running page reports the film it was built from", `${meta.durationFrames} frames @ ${meta.fps}fps`);

head(3, "SAME FILM  the shipped page draws what the gate measured");
const golden = await openPage(dist);
if (golden.errors.length) die(`the dist page the gate measured will not run: ${golden.errors.join("; ")}`);
const frames = Array.from({ length: N }, (_, i) => Math.round((i / (N - 1)) * (DUR - 1)));
if (frames.some((f) => !Number.isInteger(f))) die(`refusing to compare frames ${frames.join(", ")}: a frame list that is not whole numbers passes by accident, it does not pass`);
const hashOf = async (h, f) => h.page.evaluate((n) => { window.FILM.seek(n); return window.FILM.hash(); }, f);
const bad = [], seen = new Set();
for (const f of frames) { const a = await hashOf(shipped, f), b = await hashOf(golden, f); if (typeof a !== "string" || !a) die(`frame ${f} produced no hash`); seen.add(a); if (a !== b) bad.push(f); }
say(seen.size > 1, "the sampled frames are genuinely different frames", `${seen.size} distinct hashes across ${frames.length} samples`); /* equal hashes prove nothing if every sample drew the same frame */
say(bad.length === 0, `${frames.length} frames across the film hash the same as the gate's page`, bad.length ? `differ at ${bad.join(", ")}` : `frames ${frames[0]}..${frames[frames.length - 1]}`);

const sr = 48000;
const [aShip, aGold] = [await shipped.page.evaluate((s) => window.FILM.audio(s), sr), await golden.page.evaluate((s) => window.FILM.audio(s), sr)];
const sameAudio = aShip && aGold && aShip.frames === aGold.frames && aShip.sampleRate === aGold.sampleRate;
say(!!sameAudio, "the page synthesizes the same score, in the page", sameAudio ? `${aShip.frames} samples @ ${aShip.sampleRate} Hz` : "audio missing or different");

await browser.close();
console.log(`\n${"=".repeat(58)}\nEMIT: ${fails ? `FAIL   ${fails} of ${checks} checks failed` : `PASS   ${checks}/${checks} checks`}   ${out}`);
process.exit(fails ? 1 : 0);
