// REPLAY GATE. "A frame is a fact given its input log." This proves it for an emitted interactive page.
//
//   node tools/replay.mjs <page.html> [--out report.json] [--seconds 1]
//
//   1 LIVE      A real person, scripted: Playwright drives the page in REAL time with a mouse (sweeps,
//               hover on every bound target, rapid in/out reversals, press and click), the keyboard
//               (Tab through the targets, typing into fields), the wheel (down to the bottom and
//               back), a viewport resize WHILE hovering (new DPR scale, re-bake, new rectangles), and
//               the page's own setState calls. The live page hashes every 3rd frame it draws.
//   2 TOUCH     The same on a touch device: taps and a swipe, no hover.
//   3 REPLAY    A FRESH page gets only the recorded log. It redraws every sampled tick in REVERSE
//               order, then forward, then COLD (a brand-new env: every sprite re-baked on demand), and
//               each must hash exactly as the live page drew it.
//   4 PLAIN     An empty log draws the untouched piece: stateAt(t, []) equals restState(t) (built
//               without the reducer), the live log's tick-0 configuration changes nothing, and the
//               loop closes (tick t and t + loop are the same frame).
//   5 REDUCED   prefers-reduced-motion: the idle piece is still (no motion at all), and a scripted
//               session still renders.
//   6 BUDGET    frame time at DPR 2 on this machine, p50/p95/max, measured two ways: with the raster
//               forced (software canvas, honest upper bound) and on the default canvas (JS + command
//               recording only). Plus bake time, sprite memory and the bundle size, raw and gzip.
//
// Hashing needs one renderer for the whole comparison: every hashed page is opened with
// window.__ANI_RASTER__ = "cpu" (see hosts/interactive.ts). The budget pass measures both.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { detect } from "./detect.mjs";

const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = ["out", "seconds"].includes(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`replay: ${m}`); process.exit(1); };
const file = resolve(pos[0] ?? die("usage: node tools/replay.mjs <page.html> [--out report.json]"));
const url = pathToFileURL(file).href;
const d = detect(); if (!d.pw.ok || !d.browser.ok) die(`needs playwright and chromium: ${d.report.playwright}; ${d.report.browser}`);
const browser = await d.pw.lib.chromium.launch({ executablePath: d.browser.executablePath, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });

let fails = 0, checks = 0; const report = { page: file, checks: [] };
const say = (ok, label, detail = "") => { checks++; if (!ok) fails++; report.checks.push({ ok, label, detail }); console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   " + detail : ""}`); };
const head = (n, t) => console.log(`\n${n}. ${t}\n${"-".repeat(64)}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const open = async (ctxOpts, init = {}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, ...ctxOpts });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript((o) => { if (o.cpu) window.__ANI_RASTER__ = "cpu"; if (o.sample) window.__ANI_SAMPLE__ = o.sample; if (o.sync) window.__ANI_SYNC__ = true; if (o.manual) { window.__vt = 0; window.__ANI_CLOCK__ = () => window.__vt; } }, init);
  await page.goto(url);
  const readyMs = await page.evaluate(async () => { while (!window.__anidoodle?.length) await new Promise((r) => setTimeout(r, 10)); await window.__anidoodle[0].ready; return performance.now(); }); /* ms since navigation start: what a visitor waits */
  return { context, page, errors, readyMs };
};
const targetsOf = (page) => page.$$eval("[data-anidoodle]", (els) => els.map((e) => ({ name: e.getAttribute("data-anidoodle"), tag: e.tagName.toLowerCase(), type: e.getAttribute("type") ?? "" })));

// ---------------------------------------------------------------- the scripted person
const mouseSession = async (page) => {
  const center = async (sel) => { const h = await page.$(sel); if (!h) return null; await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox(); return b && { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
  for (let i = 0; i <= 24; i++) { await page.mouse.move(40 + i * 50, 60 + ((i * 97) % 600)); await wait(16); }                 // a sweep
  const ts = await targetsOf(page);
  for (const t of ts) {
    const sel = `[data-anidoodle="${t.name}"]`, c = await center(sel); if (!c) continue;
    await page.mouse.move(c.x, c.y, { steps: 6 }); await wait(260);                                                                // hover, settle
    for (let k = 0; k < 5; k++) { await page.mouse.move(c.b.x - 30, c.y); await wait(18); await page.mouse.move(c.x, c.y); await wait(18); } // rapid reversals
    if (t.tag === "input" || t.tag === "textarea") { await page.mouse.click(c.x, c.y); await page.keyboard.type(t.type === "email" ? "ada@" : "hello", { delay: 45 }); await wait(150); }
    else if (t.type !== "submit") { await page.mouse.down(); await wait(90); await page.mouse.up(); await wait(350); }
  }
  // a press dragged off its target is a cancel, not a click
  const first = ts.find((t) => t.tag !== "input" && t.type !== "submit"); if (first) { const c = await center(`[data-anidoodle="${first.name}"]`); if (c) { await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 400, c.y + 200, { steps: 4 }); await page.mouse.up(); await wait(200); } }
  // the keyboard
  await page.mouse.move(5, 5); await page.evaluate(() => document.activeElement?.blur?.());
  for (let k = 0; k < 5; k++) { await page.keyboard.press("Tab"); await wait(220); }
  await page.keyboard.press("Enter"); await wait(300);
  await page.evaluate(() => window.__anidoodle[0].play()); /* Tab can land on the piece's own pause button, and Enter then (rightly) pauses it */
  // resize WHILE hovering: new scale, a re-bake, new rectangles
  if (first) { const c = await center(`[data-anidoodle="${first.name}"]`); if (c) await page.mouse.move(c.x, c.y); }
  await page.setViewportSize({ width: 720, height: 760 }); await wait(900); /* narrow enough that every demo layout reflows and the canvas changes size */
  if (first) { const c = await center(`[data-anidoodle="${first.name}"]`); if (c) await page.mouse.move(c.x, c.y, { steps: 3 }); } await wait(300);
  await page.setViewportSize({ width: 1280, height: 800 }); await wait(900);
  // the wheel, all the way down and back
  for (let k = 0; k < 16; k++) { await page.mouse.wheel(0, 260); await wait(45); } await wait(250);
  for (let k = 0; k < 16; k++) { await page.mouse.wheel(0, -260); await wait(45); } await wait(250);
  // UI states the page might set
  for (const s of ["busy", "success", "error", "idle"]) { await page.evaluate((st) => window.__anidoodle[0].setState(st), s); await wait(260); }
  await page.mouse.move(640, 400, { steps: 8 }); await wait(400);
};
const touchSession = async (page) => {
  const ts = await targetsOf(page);
  for (const t of ts.slice(0, 4)) { const h = await page.$(`[data-anidoodle="${t.name}"]`); if (!h) continue; await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox(); if (!b) continue; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await wait(420); }
  const cv = await page.$("ani-doodle canvas, canvas"); if (cv) { await cv.scrollIntoViewIfNeeded(); const b = await cv.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height * 0.6); await wait(500); }
  await page.evaluate(async () => { for (let k = 0; k < 10; k++) { scrollBy(0, 200); await new Promise((r) => setTimeout(r, 40)); } for (let k = 0; k < 10; k++) { scrollBy(0, -200); await new Promise((r) => setTimeout(r, 40)); } }); await wait(400);
};
const record = async (ctxOpts, session, label) => {
  const s = await open(ctxOpts, { cpu: true, sample: 3 });
  await session(s.page);
  const r = await s.page.evaluate(() => { const c = window.__anidoodle[0]; c.pause(); return { log: c.log(), samples: c.samples(), stats: c.stats() }; });
  await s.context.close();
  const kinds = [...new Set(r.log.map((e) => e.type))].sort(), scales = [...new Set(r.samples.map((x) => x.scale))];
  console.log(`  ${label}: ${r.log.length} events (${kinds.join(", ")}), ${r.samples.length} frames hashed live at scale ${scales.join(" + ")}, last tick ${r.log.at(-1)?.tick}`);
  say(s.errors.length === 0, `${label}: the page ran clean`, s.errors.slice(0, 2).join("; "));
  return { ...r, kinds, scales };
};

// ---------------------------------------------------------------- 1 + 2: live
head(1, "LIVE  a scripted person, in real time, on a DPR 2 laptop viewport");
const live = await record({}, mouseSession, "mouse+keyboard");
{ const bound = live.log.some((e) => e.type === "rect"), need = bound ? ["enter", "exit", "down", "up", "cancel", "focus", "move", "rect", "view", "state"] : ["move", "view", "state", "scroll"];
  say(need.every((k) => live.kinds.includes(k)), bound ? "the log saw hover, press, click, cancel, keyboard focus, geometry, scale and state" : "no bound targets on this page: the log saw pointer, scale, state and scroll", live.kinds.join(" ")); }
{ const views = [...new Set(live.log.filter((e) => e.type === "view").map((e) => e.value))];
  say(views.length > 1, "the viewport resize changed the device scale mid-session, and the piece re-baked and swapped", `view scales ${views.join(" -> ")}; frames hashed live at ${live.scales.join(" + ")}`); }
say(live.samples.length >= 150, "the live session drew enough frames to mean something", `${live.samples.length} hashed (every 3rd drawn), last tick ${live.log.at(-1)?.tick}`);
head(2, "TOUCH  taps and a swipe on a touch screen");
const touch = await record({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, touchSession, "touch");
say(touch.log.some((e) => e.type === "move" && e.value === "touch") && touch.kinds.includes("leave"), "touch is logged as touch, and a lifted finger leaves no hover behind", touch.kinds.join(" "));

// ---------------------------------------------------------------- 3: replay
head(3, "REPLAY  a fresh page, the log alone: reversed, forward, and cold");
const replay = async (rec, ctxOpts, label) => {
  const s = await open(ctxOpts, { cpu: true, manual: true });
  const out = await s.page.evaluate(({ log, samples }) => {
    const c = window.__anidoodle[0]; c.pause();
    const draw = (x, cold) => { c.render(x.tick, log, x.scale, cold); return c.hash(); };
    const rev = [...samples].reverse().map((x) => draw(x, false)), fwd = samples.map((x) => draw(x, false));
    const coldIdx = samples.map((_, i) => i).filter((i) => i % Math.max(1, Math.floor(samples.length / 12)) === 0), cold = coldIdx.map((i) => draw(samples[i], true));
    return { rev: rev.reverse(), fwd, cold, coldIdx };
  }, rec);
  await s.context.close();
  const n = rec.samples.length, bad = (arr, idx) => arr.map((h, i) => (h === rec.samples[idx ? idx[i] : i].hash ? null : rec.samples[idx ? idx[i] : i].tick)).filter((x) => x !== null);
  const distinct = new Set(rec.samples.map((x) => x.hash)).size;
  say(distinct > n / 4, `${label}: the sampled frames are genuinely different frames`, `${distinct} distinct of ${n}`);
  const r = bad(out.rev), f = bad(out.fwd), c = bad(out.cold, out.coldIdx);
  say(r.length === 0, `${label}: ${n} live frames, replayed in REVERSE, hash identical`, r.length ? `differ at ticks ${r.slice(0, 8).join(", ")}` : "");
  say(f.length === 0, `${label}: and forward`, f.length ? `differ at ticks ${f.slice(0, 8).join(", ")}` : "");
  say(c.length === 0, `${label}: and ${out.cold.length} of them COLD (fresh env, every sprite re-baked)`, c.length ? `differ at ticks ${c.slice(0, 8).join(", ")}` : "");
};
await replay(live, {}, "mouse+keyboard");
await replay(touch, { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, "touch");

// ---------------------------------------------------------------- 4: plain loop
head(4, "PLAIN  no input is the plain loop");
{
  const s = await open({}, { cpu: true, manual: true });
  const r = await s.page.evaluate((cfg) => {
    const c = window.__anidoodle[0]; c.pause(); const L = c.piece.meta.loop, ticks = [0, 1, 7, 59, 131, 240, L - 1].filter((t) => t < L), out = [];
    for (const t of ticks) { c.render(t, []); const a = c.hash(); c.renderRest(t); const b = c.hash(); c.render(t, cfg); const g = c.hash(); c.render(t + L, []); const e = c.hash(); out.push({ t, a, b, g, e }); }
    return { L, out, distinct: new Set(out.map((o) => o.a)).size };
  }, live.log.filter((e) => e.tick === 0 && ["motion", "view", "rect", "scroll"].includes(e.type) && !(e.type === "scroll" && e.value !== 0)));
  await s.context.close();
  say(r.out.every((o) => o.a === o.b), "stateAt(t, []) draws exactly restState(t), built without the reducer", `${r.out.length} ticks`);
  say(r.out.every((o) => o.a === o.g), "the live page's tick-0 configuration (rects, scale, motion) changes nothing untouched");
  say(r.out.every((o) => o.a === o.e), `the loop closes: tick t and t + ${r.L} are the same frame`);
  say(r.distinct > 1, "and the untouched piece moves (no dead air)", `${r.distinct} distinct frames of ${r.out.length}`);
}

// ---------------------------------------------------------------- 5: reduced motion
head(5, "REDUCED  prefers-reduced-motion");
{
  const s = await open({ reducedMotion: "reduce" }, { cpu: true, sample: 2 });
  await s.page.mouse.move(100, 100, { steps: 4 }); await wait(120);
  const r = await s.page.evaluate(() => { const c = window.__anidoodle[0]; const log = c.log(); c.pause(); const hs = [0, 30, 97, 233].map((t) => { c.render(t, log.filter((e) => e.tick === 0)); return c.hash(); }); return { motion: log.find((e) => e.type === "motion")?.value, hs }; });
  const t0 = Date.now(); await mouseSession(s.page).catch((e) => s.errors.push(String(e))); const secs = (Date.now() - t0) / 1000;
  await s.context.close();
  say(r.motion === "reduce", "the preference reached the log", `motion = ${r.motion}`);
  say(new Set(r.hs).size === 1, "untouched, the piece is still: four ticks, one frame", r.hs.join(" "));
  say(s.errors.length === 0, "a full scripted session renders with reduced motion", `${secs.toFixed(1)} s, ${s.errors.slice(0, 2).join("; ") || "no error"}`);
}

// ---------------------------------------------------------------- 6: budget
head(6, "BUDGET  DPR 2, this machine, headless Chromium");
{
  const html = readFileSync(file, "utf8"), m = html.match(/<script type="module">([\s\S]*?)<\/script>/), js = m ? m[1] : "";
  const kb = (n) => (n / 1024).toFixed(1) + " KB";
  const perf = async (init, label) => {
    const s = await open({}, init); await mouseSession(s.page);
    const st = await s.page.evaluate(() => window.__anidoodle[0].stats()); await s.context.close();
    console.log(`  ${label.padEnd(44)} p50 ${String(st.p50).padStart(5)} ms   p95 ${String(st.p95).padStart(5)} ms   max ${String(st.max).padStart(6)} ms   (${st.frames} frames)`);
    return { ...st, readyMs: Math.round(s.readyMs) };
  };
  const forced = await perf({ cpu: true, sync: true }, "raster forced (software canvas), per frame");
  const gpu = await perf({}, "default canvas, JS + command recording");
  report.budget = { forced, gpu, moduleBytes: Buffer.byteLength(js), moduleGzip: gzipSync(js).length, pageBytes: Buffer.byteLength(html), pageGzip: gzipSync(html).length };
  console.log(`  startup: ready in ${forced.readyMs} ms (bake ${forced.bakeMs} ms, ${forced.sprites} sprites, ${forced.spriteMB} MB of sprites at scale ${forced.scale})`);
  console.log(`  bundle:  module ${kb(report.budget.moduleBytes)} (${kb(report.budget.moduleGzip)} gzip), whole page ${kb(report.budget.pageBytes)} (${kb(report.budget.pageGzip)} gzip)`);
  say(forced.p95 <= 6, "p95 frame time at DPR 2 is at or under 6 ms with the raster forced", `${forced.p95} ms`);
}

await browser.close();
report.pass = fails === 0; report.summary = `${checks - fails}/${checks}`;
if (opt.out) writeFileSync(resolve(opt.out), JSON.stringify(report, null, 1));
console.log(`\n${"=".repeat(64)}\nREPLAY: ${fails ? `FAIL   ${fails} of ${checks} checks failed` : `PASS   ${checks}/${checks} checks`}   ${file}`);
process.exit(fails ? 1 : 0);
