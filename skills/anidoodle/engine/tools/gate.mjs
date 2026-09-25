// THE QUALITY GATE. One gate, any adapter. It holds whatever backend it is handed to the same
// three bars and prints a verdict you can act on.
//
//   node tools/gate.mjs <film> [--adapter html-player] [--mp4 out/x.mp4] [--samples 12] [--scale 1]
//
//   1 DETERMINISM  the same sampled frames drawn twice, at two different worker counts, in two
//                  different orders. Byte-identical, or PSNR above 45 dB.
//   2 CONTRACT     a static scan of every module the film draws through.
//   3 DEAD AIR     no identical consecutive frames, no 15-frame window under 0.5 % changed.
//
// The gate NEVER writes to out/. It renders into .tmp/gate/ and it only ever READS the MP4 it is
// pointed at, so running it can never damage a finished film.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";
import { defaultOutput } from "./names.mjs";
import { changedArea } from "./motion.mjs";

const VAL = new Set(["adapter", "mp4", "samples", "scale", "workers"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const film = pos[0] ?? "mechanicalLepidoptera";
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
const motionViolations = (changed, meta) => {
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
  const windows = []; for (let f = 1; f + windowSize <= changed.length; f++) { let m = 0; for (let k = f; k < f + windowSize; k++) m = Math.max(m, changed[k]); if (m < floor && !Array.from({ length: windowSize }, (_, k) => f + k).every((i) => declared(meta.holds, i))) windows.push(f); }
  return { still, windows, windowSize };
};
const walk = (dir, out = []) => { for (const e of execFileSync("find", [dir, "-name", "*.ts", "-type", "f"]).toString().trim().split("\n").filter(Boolean)) out.push(e); return out; };

const contractScan = () => {
  head(2, "CONTRACT  the art core cannot reach a clock, the network or a file");
  const files = [...walk("src/canvas-core"), `src/hosts/page-${film}.ts`].filter((f) => existsSync(f));
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
  const { still, windows: win, windowSize } = motionViolations(changed, meta);
  const merged = []; win.forEach((f) => { const l = merged[merged.length - 1]; if (l && f <= l[1]) l[1] = f + windowSize; else merged.push([f, f + windowSize]); });
  for (const [from, to, reason] of meta.locked ?? []) console.log(`        LOCKED ${from}-${to}: ${reason}; violations remain failures`);
  say(still.length === 0, "no unexplained identical consecutive frames", still.length ? still.slice(0, 20).join(", ") : "none");
  say(merged.length === 0, `no ${windowSize}-frame window under ${meta.kind === "drawing" ? "0.02" : "0.5"}% changed`, merged.map(([a, b]) => `${a}-${b}`).join(", ") || "none");
  const mvt = changed.slice(1).sort((a, b) => a - b);
  console.log(`        ${n} frames measured; median ${((mvt[mvt.length >> 1] ?? 0) * 100).toFixed(2)}%  min ${((mvt[0] ?? 0) * 100).toFixed(2)}%`);
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
  const s1 = await mod.open(film, { scale: SCALE, workers: 1 });
  const meta = await s1.info();
  const N = meta.durationFrames;
  const bounds = [...new Set([0, N - 1, ...(meta.shots ?? []).flatMap((s) => [s.start, s.end - 1])])];
  const extra = Math.max(0, SAMPLES - bounds.length);
  const spread = Array.from({ length: extra }, (_, i) => Math.round(((i + 1) * (N - 1)) / (extra + 1)));
  const frames = [...new Set([...bounds, ...spread])].sort((a, b) => a - b);
  const h1 = []; for (const f of frames) h1.push(await s1.hash(f, 0)); // forward, one page
  const art = s1.artifact?.() ?? null;
  const aud1 = await s1.audio(48000);
  await s1.close();

  const W2 = 3;
  const s2 = await mod.open(film, { scale: SCALE, workers: W2 });
  const h2 = new Array(frames.length);
  for (let i = frames.length - 1; i >= 0; i--) h2[i] = await s2.hash(frames[i], i); // reversed, spread over 3 pages
  const aud2 = await s2.audio(48000);

  const same = frames.filter((_, i) => h1[i] === h2[i]).length;
  if (same === frames.length) say(true, `${frames.length} sampled frames hash-identical across 1 page and ${W2} pages, forward vs reversed`, `${same}/${frames.length}  frames ${frames[0]}..${frames[frames.length - 1]}`);
  if (same !== frames.length) { // only pay for pixels when the hashes disagree
    let worst = Infinity;
    for (let i = 0; i < frames.length; i++) {
      if (h1[i] === h2[i]) continue;
      const a = resolve(TMP, `a${frames[i]}.png`), b = resolve(TMP, `b${frames[i]}.png`);
      const sA = await mod.open(film, { scale: SCALE, workers: 1 });
      writeFileSync(a, (await sA.frame(frames[i], 0)).png); await sA.close();
      writeFileSync(b, (await s2.frame(frames[i], i)).png);
      const v = psnr(a, b); worst = Math.min(worst, v);
      console.log(`        frame ${frames[i]}: PSNR ${v === Infinity ? "inf" : v.toFixed(2)} dB`);
    }
    say(worst > 45, `hash differences within PSNR tolerance (> 45 dB)`, `min PSNR ${worst === Infinity ? "inf" : worst.toFixed(2)} dB`);
    // A failure is only useful if it says WHERE to look. Redraw the first offender cold, then
    // again behind each earlier sample, and name the frame that poisons it: that is the signature
    // of a cache key that does not name everything its pixels depend on.
    const bad = frames.find((_, i) => h1[i] !== h2[i]);
    if (bad !== undefined) {
      const c0 = await mod.open(film, { scale: SCALE, workers: 1 }); const cold = await c0.hash(bad, 0); await c0.close();
      const culprits = [];
      for (const pre of frames.filter((f) => f !== bad)) {
        const c = await mod.open(film, { scale: SCALE, workers: 1 });
        await c.hash(pre, 0); const h = await c.hash(bad, 0); await c.close();
        if (h !== cold) culprits.push(pre);
      }
      console.log(culprits.length
        ? `        DIAGNOSIS: frame ${bad} is ORDER-DEPENDENT. Drawing frame(s) ${culprits.join(", ")} first changes it.\n                   That is a cache key that does not name everything its pixels depend on.`
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

  console.log(`\n${"=".repeat(58)}`);
  console.log(fails ? `GATE: FAIL   ${fails} of ${checks} checks failed` : `GATE: PASS   ${checks}/${checks} checks, ${nFiles} modules scanned`);
  process.exit(fails ? 1 : 0);
};
const selfTest = async () => {
  let wrong = 0;
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
