// THE QUALITY GATE. One gate, any adapter. It holds whatever backend it is handed to the same
// three bars and prints a verdict you can act on.
//
//   node tools/gate.mjs <film> [--adapter html-player] [--mp4 out/x.mp4] [--samples 12] [--scale 1]
//
//   1 DETERMINISM  the same sampled frames drawn twice, at two different worker counts, in two
//                  different orders. Byte-identical, or PSNR above 45 dB.
//   2 CONTRACT     a static scan of every module the film draws through.
//   3 DEAD AIR     no identical consecutive frames, no half-second window under 0.5 % changed per 1/30 s.
//   5 3D CHECKS    3D films only: three-core/checks3d.ts on sampled frames plus every frame of a
//                  grip's contact window. Any finding (a prop through a hand, rigs clipping) fails, and
//                  so does a 3D film that registers nothing to check (unless meta.checks.none["3d"] says why).
//   A film made before a check existed (a frozen source of a published film) may declare a dead-air row,
//   meta.checks.none["gate:identical"] or ["gate:still"], with its reason: listed with the reason, never counted.
//
// The gate NEVER writes to out/. It renders into .tmp/gate/ and it only ever READS the MP4 it is
// pointed at, so running it can never damage a finished film.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOTS } from "./overlay.mjs";
import { trackProvenance } from "./sidecar.mjs";
import { readdirSync } from "node:fs";
import { defaultOutput, requireFilm } from "./names.mjs";
import { changedArea } from "./motion.mjs";
import { pathToFileURL } from "node:url";
import { glArgs } from "./adapters/playwright.mjs";
import { detect } from "./detect.mjs";
import { deadAirVerdict, threeDVerdict } from "./gaterules.mjs";

const VAL = new Set(["adapter", "mp4", "samples", "scale", "workers"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const film = opt["self-test"] ? null : requireFilm(pos[0], "gate", "node tools/gate.mjs <film> [--mp4 out/<film>.mp4] [--adapter html-player] [--samples 12] [--scale 1]\n       node tools/gate.mjs --self-test");
const adapterName = opt.adapter ?? "html-player";
const SAMPLES = Math.max(4, +(opt.samples ?? 12)), SCALE = +(opt.scale ?? 1);
const TMP = resolve(".tmp/gate"); mkdirSync(TMP, { recursive: true });

let fails = 0, checks = 0;
const say = (ok, label, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   " + detail : ""}`); };
const note = (label, detail = "") => console.log(`  ----  ${label}${detail ? "   " + detail : ""}`); // not applicable: printed, never counted
const head = (n, t) => console.log(`\n${n}. ${t}\n${"-".repeat(58)}`);

// ---------------------------------------------------------------- 2. the contract, statically
// Deliberately first in the file and cheap: if the source can reach a clock or the network, no
// amount of agreeing renders proves anything, because the next machine may not agree.
const FORBIDDEN = [
  [/Math\.random/, "Math.random"], [/\bnew Date\b/, "new Date"], [/\bDate\.now\b/, "Date.now"],
  [/performance\.now/, "performance.now"], [/\bctx\.filter\b/, "ctx.filter"], [/\.filter\s*=[^=]/, "assignment to .filter"],
  [/\bnew Image\b/, "new Image"], [/\bnew OffscreenCanvas\b/, "new OffscreenCanvas"],
  [/\bfetch\s*\(/, "fetch()"], [/XMLHttpRequest/, "XMLHttpRequest"], [/\bimportScripts\b/, "importScripts"],
  [/\blocalStorage\b/, "localStorage"], [/\bcrypto\./, "crypto.*"],
  [/from\s+["']react["']/, "react import"], [/from\s+["']remotion["']/, "remotion import"], [/pencil\.tsx/, "pencil.tsx import"],
];
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
// windowChanged: the change per 1/30 s (for a 60 fps film, each frame against the one two back). The
// 0.5 % floor is a 30 fps measure: at 60 fps the same motion changes half the area per frame.
const motionViolations = (changed, meta, windowChanged = changed) => {
  const declared = (ranges, f) => ranges?.some(([from, to]) => f >= from && f < to) ?? false;
  const step = meta.step ?? (meta.onTwos ? 2 : 1);
  const explained = (f) => {
    const shotStart = meta.shots?.find((s) => f >= s.start && f < s.end)?.start ?? 0;
    return declared(meta.holds, f) || (step > 1 && (f - shotStart) % step !== 0);
  };
  const drawing = meta.kind === "drawing", floor = drawing ? 0.0002 : 0.005, pause = drawing ? Math.round(meta.fps / 2) : 0; // a hand may rest half a second between passes
  let run = 0; const still = [];
  for (let f = 1; f < changed.length; f++) { run = changed[f] === 0 ? run + 1 : 0; if (changed[f] === 0 && !explained(f) && run > pause) still.push(f); }
  const windowSize = drawing ? Math.max(2, Math.round(meta.fps)) : Math.max(2, Math.round(meta.fps / 2));
  const windows = []; for (let f = 1; f + windowSize <= changed.length; f++) { let m = 0; for (let k = f; k < f + windowSize; k++) m = Math.max(m, windowChanged[k]); if (m < floor && !Array.from({ length: windowSize }, (_, k) => f + k).every((i) => declared(meta.holds, i))) windows.push(f); }
  return { still, windows, windowSize };
};
const walk = (dir, out = []) => { for (const e of execFileSync("find", [dir, "-name", "*.ts", "-type", "f"]).toString().trim().split("\n").filter(Boolean)) out.push(e); return out; };

const contractScan = () => {
  head(2, "CONTRACT  the art core cannot reach a clock, the network or a file");
  // the worked example is part of the same tree at build time (tools/overlay.mjs): scan it too
  // a linked project (scaffold --linked) draws through the engine's modules too: scan the whole tree the build sees
  const files = [...new Set(ROOTS.flatMap((r) => ["canvas-core", "three-core"].map((d) => join(r, d))).filter((d) => existsSync(d)).flatMap((d) => walk(d)))].concat(existsSync(`src/hosts/page-${film}.ts`) ? [`src/hosts/page-${film}.ts`] : []);
  const hits = [];
  for (const f of files) { const src = stripComments(readFileSync(f, "utf8")); FORBIDDEN.forEach(([re, label]) => { const m = src.match(new RegExp(re.source, "g")); if (m) hits.push(`${f}: ${label} x${m.length}`); }); }
  say(hits.length === 0, `no forbidden call in ${files.length} art-core modules`, hits.length ? hits.slice(0, 6).join(" | ") : "Math.random, Date, performance.now, ctx.filter, network, image/font loads: none");
  const rngSites = files.reduce((a, f) => a + (stripComments(readFileSync(f, "utf8")).match(/\brng\s*\(/g) ?? []).length, 0);
  const badSeed = files.flatMap((f) => (stripComments(readFileSync(f, "utf8")).match(/rng\s*\(\s*(Date|Math|performance)/g) ?? []));
  say(badSeed.length === 0, `all randomness is rng(seed): ${rngSites} seeded call sites`, badSeed.length ? `UNSEEDED: ${badSeed.join(", ")}` : "no seed derived from a clock or Math.random");
  return files.length;
};

// ---------------------------------------------------------------- 3. dead air, on a real file
const deadAir = async (mp4, meta) => {
  head(3, "DEAD AIR  something visibly moves in every second");
  if (!existsSync(mp4)) { say(false, "an MP4 to measure", `${mp4} not found`); return; }
  const W = 270, H = Math.max(2, Math.round(W * meta.H / meta.W));
  let changed; try { changed = await changedArea(mp4, W, H); } catch (e) { say(false, "decode MP4", e.message); return; }
  const n = changed.length;
  say(n === meta.durationFrames, "MP4 frame count matches film", `${n}/${meta.durationFrames}`);
  const stride = Math.max(1, Math.round(meta.fps / 30));
  let perThirtieth = changed; if (stride > 1) try { perThirtieth = await changedArea(mp4, W, H, 4, stride); } catch (e) { say(false, "decode MP4", e.message); return; }
  const { still, windows: win, windowSize } = motionViolations(changed, meta, perThirtieth);
  const merged = []; win.forEach((f) => { const l = merged[merged.length - 1]; if (l && f <= l[1]) l[1] = f + windowSize; else merged.push([f, f + windowSize]); });
  for (const [from, to, reason] of meta.locked ?? []) console.log(`        LOCKED ${from}-${to}: ${reason}; violations remain failures`);
  for (const [from, to, reason] of meta.holds ?? []) if (reason) console.log(`        HOLD ${from}-${to}: ${reason}`);
  // (a frozen film made before these checks may declare a row in meta.checks.none: listed with its reason, never counted as a pass)
  const row = (key, ok, label, detail) => { const v = deadAirVerdict(key, ok, detail, meta); if (v.counted) say(v.ok, label, v.detail); else note(`${label} (not judged)`, v.detail); };
  row("gate:identical", still.length === 0, "no unexplained identical consecutive frames", still.length ? still.slice(0, 20).join(", ") : "none");
  row("gate:still", merged.length === 0, `no ${windowSize}-frame window under ${meta.kind === "drawing" ? "0.02" : "0.5"}% changed`, merged.map(([a, b]) => `${a}-${b}`).join(", ") || "none");
  const mvt = changed.slice(1).sort((a, b) => a - b);
  console.log(`        ${n} frames measured; median ${((mvt[mvt.length >> 1] ?? 0) * 100).toFixed(2)}%  min ${((mvt[0] ?? 0) * 100).toFixed(2)}%`);
};

// ---------------------------------------------------------------- 5. 3D checks, inside the page
// The film's own draws run three-core/checks3d.ts (runChecks) when a collector listens; the page
// returns every finding (hosts/page.ts FILM.checks3d). The pass mounts at a quarter scale: the checks
// read geometry and the camera, never pixels, so the frame size changes nothing they see and the
// WebGL draw costs a sixteenth. Lessons 37 and 48: a green gate with a prop through a hand is a failed gate.
const CHECK_SCALE = 0.25, CHECK_SAMPLES = 48;
const checks3d = async (pagePath, meta) => {
  head(5, "3D CHECKS  grips held, nothing through anything (three-core/checks3d)");
  if (!readFileSync(pagePath, "utf8").includes("__ANIDOODLE_WEBGL__")) { note("a 2D film", "3D checks not applicable"); return; }
  const env = detect(), N = meta.durationFrames;
  const browser = await env.pw.lib.chromium.launch({ executablePath: env.browser.executablePath, args: ["--disable-background-timer-throttling", ...glArgs(pagePath)] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 640, height: 640 } })).newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(pathToFileURL(pagePath).href + "?adapter=gate-3d");
    await page.evaluate(async (s) => { await window.FILM.ready; window.FILM.mount(s); }, CHECK_SCALE);
    const ask = async (frames) => { const out = []; for (let i = 0; i < frames.length; i += 24) out.push(...(await page.evaluate((fs) => window.FILM.checks3d(fs), frames.slice(i, i + 24)))); return out; };
    // pass 1: every Nth frame. pass 2: every frame between two samples where either one holds a grip
    // (a contact window), because a hand can pass through a handle for three frames between samples
    const step = Math.max(1, Math.ceil(N / CHECK_SAMPLES)), sampled = [...new Set([...Array.from({ length: Math.ceil(N / step) }, (_, i) => i * step), N - 1])];
    const recs = await ask(sampled), byFrame = new Map(recs.map((r) => [r.frame, r]));
    const fill = []; for (let i = 0; i + 1 < sampled.length; i++) { const a = byFrame.get(sampled[i]), b = byFrame.get(sampled[i + 1]); if (a?.grips.length || b?.grips.length) for (let f = sampled[i] + 1; f < sampled[i + 1]; f++) fill.push(f); }
    recs.push(...(await ask(fill)));
    if (errors.length) { say(false, "the 3D check pass drew without errors", errors.slice(0, 3).join("; ")); return; }
    // nothing registered is a check that could not look: FAIL, unless the film declares why (gaterules.mjs)
    const v = threeDVerdict({ recs, sampled: sampled.length, fill: fill.length, meta });
    if (v.counted) say(v.ok, v.label, v.detail); else note(v.label, v.detail);
  } finally { await browser.close(); }
};

// ---------------------------------------------------------------- 1. determinism, two ways round
const psnr = (a, b) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", a, "-i", b, "-lavfi", "psnr=stats_file=-", "-f", "null", "-"], { encoding: "utf8" });
  const m = (r.stdout + r.stderr).match(/psnr_avg:([0-9.]+|inf)/);
  return m ? (m[1] === "inf" ? Infinity : Number(m[1])) : NaN;
};

const run = async () => {
  console.log(`QUALITY GATE   film "${film}"   adapter "${adapterName}"`);
  const mod = await import(`./adapters/${adapterName}.mjs`);
  const p = mod.probe();
  console.log(`${mod.describe()}\n${p.ok ? "ready: " + p.why : "UNAVAILABLE: " + p.why}`);
  if (!p.ok) { console.log("\nGATE: CANNOT RUN"); process.exit(2); }

  head(1, "DETERMINISM  the same frame, drawn two different ways, is the same frame");
  // session 1 is COLD (no warm-up draws) and forward; session 2 is warmed and reversed. A frame that
  // depends on what was drawn before it (leaked context state, a cache key missing a term) differs.
  const s1 = await mod.open(film, { scale: SCALE, workers: 1, warm: false });
  const meta = await s1.info();
  const N = meta.durationFrames;
  const bounds = [...new Set([0, N - 1, ...(meta.shots ?? []).flatMap((s) => [s.start, s.end - 1])])];
  const extra = Math.max(0, SAMPLES - bounds.length);
  const spread = Array.from({ length: extra }, (_, i) => Math.round(((i + 1) * (N - 1)) / (extra + 1)));
  const frames = [...new Set([...bounds, ...spread])].sort((a, b) => a - b);
  // the PNGs themselves are kept: if two hashes disagree, the pixels compared are THOSE pixels, not
  // a fresh redraw that may not reproduce the history that made them differ
  const md5 = (b) => createHash("md5").update(b).digest("hex"), p1 = [], p2 = new Array(frames.length);
  const h1 = []; for (const f of frames) { const png = (await s1.frame(f, 0)).png; p1.push(png); h1.push(md5(png)); } // forward, one cold page
  const art = s1.artifact?.() ?? null;
  const aud1 = await s1.audio(48000);
  await s1.close();

  const W2 = 3;
  const s2 = await mod.open(film, { scale: SCALE, workers: W2 });
  const h2 = new Array(frames.length);
  for (let i = frames.length - 1; i >= 0; i--) { const png = (await s2.frame(frames[i], i)).png; p2[i] = png; h2[i] = md5(png); } // reversed, spread over 3 warmed pages
  const aud2 = await s2.audio(48000);

  const same = frames.filter((_, i) => h1[i] === h2[i]).length;
  if (same === frames.length) say(true, `${frames.length} sampled frames hash-identical across 1 page and ${W2} pages, forward vs reversed`, `${same}/${frames.length}  frames ${frames[0]}..${frames[frames.length - 1]}`);
  if (same !== frames.length) { // only pay for pixels when the hashes disagree
    let worst = Infinity;
    for (let i = 0; i < frames.length; i++) {
      if (h1[i] === h2[i]) continue;
      const a = resolve(TMP, `a${frames[i]}.png`), b = resolve(TMP, `b${frames[i]}.png`);
      writeFileSync(a, p1[i]); writeFileSync(b, p2[i]);
      const v = psnr(a, b); worst = Math.min(worst, v);
      console.log(`        frame ${frames[i]}: PSNR ${v === Infinity ? "inf" : v.toFixed(2)} dB`);
    }
    say(worst > 45, `hash differences within PSNR tolerance (> 45 dB)`, `min PSNR ${worst === Infinity ? "inf" : worst.toFixed(2)} dB`);
    // A failure is only useful if it says WHERE to look. Redraw the first offender cold, then
    // again behind each earlier sample, and name the frame that poisons it: that is the signature
    // of a cache key that does not name everything its pixels depend on.
    const bad = frames.find((_, i) => h1[i] !== h2[i]);
    if (bad !== undefined) {
      const c0 = await mod.open(film, { scale: SCALE, workers: 1, warm: false }); const cold = await c0.hash(bad, 0); await c0.close();
      const culprits = [];
      for (const pre of frames.filter((f) => f !== bad)) {
        const c = await mod.open(film, { scale: SCALE, workers: 1, warm: false });
        await c.hash(pre, 0); const h = await c.hash(bad, 0); await c.close();
        if (h !== cold) culprits.push(pre);
      }
      console.log(culprits.length
        ? `        DIAGNOSIS: frame ${bad} is ORDER-DEPENDENT. Drawing frame(s) ${culprits.join(", ")} first changes it.\n                   That is a cache key that does not name everything its pixels depend on,\n                   or state one frame leaves behind for the next.`
        : `        DIAGNOSIS: frame ${bad} is stable within a session; the difference is between sessions.`);
    }
  }
  // A silent piece (a still, a loop, a logo) has nothing to compare; a score that appears in one
  // session and not the other is still a failure.
  if (!aud1 && !aud2) note("no score in this piece", "audio check not applicable");
  else say(aud1 && aud2 ? aud1.float32 === aud2.float32 : false, "the synthesized audio is identical across sessions", aud1 ? `${aud1.frames} samples @ ${aud1.sampleRate} Hz` : "no audio");
  await s2.close();

  const nFiles = contractScan();
  if (N === 1) { head(3, "DEAD AIR  something visibly moves in every second"); note("a still, one frame long", "dead air not applicable"); }
  else await deadAir(resolve(opt.mp4 ?? defaultOutput(film)), meta);

  if (art) {
    head(4, `ARTIFACT  what this adapter delivers`);
    console.log(`        ${art.path}  (${(art.bytes / 1024).toFixed(0)} KB, ${art.kind})`);
    art.checks.forEach((c) => say(c.ok, c.label, c.detail));
  }
  // EXTERNAL MUSIC (meta.checks.music.track). "Any score is synthesized in the page" holds for the page; a
  // film whose music is a supplied or generated track is mixed outside it (track.mjs), so the gate holds
  // the delivered file to the take its manifest pins instead of waving it through (X3).
  if (meta.checks?.music?.track) {
    head("4b", "EXTERNAL TRACK  the music in the file is the pinned take");
    const mp4 = resolve(opt.mp4 ?? defaultOutput(film)), pv = trackProvenance(resolve(meta.checks.music.track), mp4);
    say(pv.ok, "the delivered mix comes from the take its manifest pins", pv.detail);
  }
  await checks3d(resolve(`dist/${film}.html`), meta);

  console.log(`\n${"=".repeat(58)}`);
  console.log(fails ? `GATE: FAIL   ${fails} of ${checks} checks failed` : `GATE: PASS   ${checks}/${checks} checks, ${nFiles} modules scanned`);
  process.exit(fails ? 1 : 0);
};
const selfTest = async () => {
  let wrong = 0;
  if (!existsSync("test/fixtures")) { console.error("gate --self-test: the fixtures are not in this install (the directory copy leaves them out). The anidoodle repository has them: see Links in the plugin README."); process.exit(2); }
  for (const file of readdirSync("test/fixtures").filter((f) => f.endsWith(".mjs")).sort()) {
    const fixture = (await import(`../test/fixtures/${file}`)).default;
    const { meta, render, expected } = fixture;
    const forbidden = FORBIDDEN.some(([re]) => re.test(stripComments(render.toString())));
    const cache = new Map(), frames = Array.from({ length: meta.durationFrames }, (_, f) => render(f, cache));
    const changed = frames.map((v, i) => i === 0 ? 0 : v === frames[i - 1] ? 0 : 1);
    const motion = motionViolations(changed, meta);
    const reverseCache = new Map(), reversed = frames.map((_, i) => render(frames.length - i - 1, reverseCache)).reverse();
    const orderDependent = frames.some((v, i) => v !== reversed[i]);
    const actual = forbidden || motion.still.length > 0 || motion.windows.length > 0 || orderDependent ? "FAIL" : "PASS";
    if (actual !== expected) wrong++;
    console.log(`${actual === expected ? "PASS" : "FAIL"}  ${file}: expected ${expected}, actual ${actual}${forbidden ? " forbidden source" : ""}${motion.still.length ? ` still ${motion.still.join(",")}` : ""}${orderDependent ? " order-dependent" : ""}`);
  }
  console.log(`SELF-TEST: ${wrong ? "FAIL" : "PASS"}`);
  process.exit(wrong ? 1 : 0);
};
(opt["self-test"] ? selfTest() : run()).catch((e) => { console.error(`\ngate crashed: ${e.message}`); process.exit(2); });
