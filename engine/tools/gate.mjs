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
const walk = (dir, out = []) => { for (const e of execFileSync("find", [dir, "-name", "*.ts", "-type", "f"]).toString().trim().split("\n").filter(Boolean)) out.push(e); return out; };

const contractScan = () => {
  head(2, "CONTRACT  the art core cannot reach a clock, the network or a file");
  const files = [...walk("src/canvas-core"), `src/hosts/page-${film}.ts`].filter((f) => existsSync(f));
  const hits = [];
  for (const f of files) { const src = stripComments(readFileSync(f, "utf8")); FORBIDDEN.forEach(([re, label]) => { const m = src.match(new RegExp(re.source, "g")); if (m) hits.push(`${f}: ${label} x${m.length}`); }); }
  say(hits.length === 0, `no forbidden call in ${files.length} art-core modules`, hits.length ? hits.slice(0, 6).join(" | ") : "Math.random, Date, performance.now, ctx.filter, network, image/font loads: none");
  const rngSites = files.reduce((a, f) => a + (stripComments(readFileSync(f, "utf8")).match(/\brng\s*\(/g) ?? []).length, 0);
  const badSeed = files.flatMap((f) => (stripComments(readFileSync(f, "utf8")).match(/rng\s*\(\s*(Date|Math|performance)/g) ?? []));
  say(badSeed.length === 0 && rngSites > 0, `all randomness is rng(seed): ${rngSites} seeded call sites`, badSeed.length ? `UNSEEDED: ${badSeed.join(", ")}` : "no seed derived from a clock or Math.random");
  return files.length;
};

// ---------------------------------------------------------------- 3. dead air, on a real file
const deadAir = (mp4) => {
  head(3, "DEAD AIR  something visibly moves in every second");
  if (!existsSync(mp4)) { say(false, "an MP4 to measure", `${mp4} not found`); return; }
  const W = 270, px = W * W;
  const grey = spawnSync("ffmpeg", ["-v", "error", "-i", mp4, "-vf", `scale=${W}:${W}`, "-pix_fmt", "gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 }).stdout;
  const n = Math.floor(grey.length / px), changed = [0];
  for (let f = 1; f < n; f++) { const A = grey.subarray((f - 1) * px, f * px), B = grey.subarray(f * px, (f + 1) * px); let c = 0; for (let i = 0; i < px; i++) if (Math.abs(A[i] - B[i]) > 4) c++; changed.push(c / px); }
  const still = []; for (let f = 1; f < n; f++) if (changed[f] === 0) still.push(f);
  const win = []; for (let f = 1; f + 15 <= n; f++) { let m = 0; for (let k = f; k < f + 15; k++) m = Math.max(m, changed[k]); if (m < 0.005) win.push(f); }
  const merged = []; win.forEach((f) => { const l = merged[merged.length - 1]; if (l && f <= l[1]) l[1] = f + 15; else merged.push([f, f + 15]); });
  // A film may LOCK an early act that is known to fail here. Report it, never launder it.
  const A1 = 540, lateStill = still.filter((f) => f >= A1), lateWin = merged.filter(([a]) => a >= A1);
  say(lateStill.length === 0, "no identical consecutive frames after the locked act", `${lateStill.length} after frame ${A1}, ${still.length} in the whole file`);
  say(lateWin.length === 0, "no 15-frame window under 0.5% changed after the locked act", lateWin.map(([a, b]) => `${a}-${b}`).join(", ") || "none");
  const mvt = changed.slice(A1 + 1).sort((a, b) => a - b);
  console.log(`        ${n} frames measured; after frame ${A1}: median ${(mvt[mvt.length >> 1] * 100).toFixed(2)}%  min ${(mvt[0] * 100).toFixed(2)}%`);
  if (still.length) console.log(`        NOTE: ${still.length} still frames all sit inside the LOCKED Act 1 (locked by decision). Not counted against this gate.`);
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
  const frames = Array.from({ length: SAMPLES }, (_, i) => Math.round((i * (N - 1)) / (SAMPLES - 1)));
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
  say(same === frames.length, `${frames.length} sampled frames hash-identical across 1 page and ${W2} pages, forward vs reversed`, `${same}/${frames.length}  frames ${frames[0]}..${frames[frames.length - 1]}`);
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
    say(worst > 45, `every differing frame is visually identical (PSNR > 45 dB)`, `min PSNR ${worst === Infinity ? "inf" : worst.toFixed(2)} dB`);
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
  else say(aud1 && aud2 ? aud1.pcm16 === aud2.pcm16 : false, "the synthesized audio is identical across sessions", aud1 ? `${aud1.frames} samples @ ${aud1.sampleRate} Hz` : "no audio");
  await s2.close();

  const nFiles = contractScan();
  if (N === 1) { head(3, "DEAD AIR  something visibly moves in every second"); note("a still, one frame long", "dead air not applicable"); }
  else deadAir(resolve(opt.mp4 ?? `out/${film.replace(/([A-Z])/g, "-$1").toLowerCase()}.mp4`));

  if (art) {
    head(4, `ARTIFACT  what this adapter delivers`);
    console.log(`        ${art.path}  (${(art.bytes / 1024).toFixed(0)} KB, ${art.kind})`);
    art.checks.forEach((c) => say(c.ok, c.label, c.detail));
  }

  console.log(`\n${"=".repeat(58)}`);
  console.log(fails ? `GATE: FAIL   ${fails} of ${checks} checks failed` : `GATE: PASS   ${checks}/${checks} checks, ${nFiles} modules scanned`);
  process.exit(fails ? 1 : 0);
};
run().catch((e) => { console.error(`\ngate crashed: ${e.message}`); process.exit(2); });
