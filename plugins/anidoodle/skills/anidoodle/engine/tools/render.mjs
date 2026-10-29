// node tools/render.mjs <film> [--scale 1] [--workers 4] [--out out/x.mp4|.gif|.webm|.apng] [--gif-fps 15] [--width 640]
//                       [--blur N] [--from F] [--to F]
// --blur N|auto  motion blur: every output frame is the average of subframes spread over the shutter,
//           integrated in linear light and weighted by alpha inside the page. Fast pans and dolly
//           moves stop juddering. Stepped art (meta.step > 1 or onTwos) is NOT blurred: the shutter
//           would straddle two drawings. --blur 1 is untouched.
//           N: N subframes on every frame (costs N times the draw time).
//           auto: as many as the frame's own on-screen speed needs, measured per frame by block-
//           matching two sharp renders at the shutter's ends: subframes at most --blur-px apart
//           (default 3 px), 1 on a still frame (the sharp frame, untouched), at most --blur-max (32).
//           Deterministic: the count is a function of the frame's pixels.
//           Type, photos and anything drawn inside sharp() are NEVER blurred (hosts/instrument.ts): they
//           are left out of the subframes and laid over the result sharp. Blurred type and faces read
//           as violent motion (a brand launch film, critic round 2). --blur-all blurs everything, as before.
// --shutter DEG  the shutter angle: 180 (default, film's standard: half the frame interval) to 360
//           (the whole interval, the old --blur behaviour). 180-240 reads as natural motion.
// --from/--to  render only frames [from, to): for checking a passage, not for shipping. A range
//           render is silent (the score would not line up), says so, and by default writes
//           out/<film>.<from>-<to>.<ext> so it can never overwrite the finished film.
// --hashes file  also write "frame md5" of every PNG handed to the encoder: two renders compared
//           frame by frame, before any codec can blur the difference.
// --poster-frame N [--poster-fade 6]  platforms show frame 0 as the thumbnail: open on frame N (the
//           wall of styles, the logo) and dissolve into the real opening by frame 6. The frame
//           count and the score are unchanged. A delivery whose frame 0 is near-blank gets a
//           warning after the encode (verify-export --delivery makes it a failure).
// Auto-detects a backend, renders every frame through it, encodes with ffmpeg, then VERIFIES.
//   .mp4   the film, with its score
//   .gif   loops and README heroes: silent, loops forever, ONE palette built from the whole piece
//          so a wash does not band differently from frame to frame
//   .webm  VP9 with its alpha kept: stickers and overlays. Leave the background unpainted and
//          whatever sits behind the page shows through
//   .apng  animated PNG, alpha kept, loops forever, plays in every browser
// --width only applies to the silent formats; the MP4 is always the film's own size.
// Every render also writes <out>.film.json beside the file: the film id, frame range, blur, sha256 and
//           the film's meta, so the checks on a delivered file never infer the film from its name.
// --shapes 16x9,1x1,4x5,9x16  a launch template film in several frame shapes from ONE timeline: each
//           shape is re-composed by its layout (launchLayout.ts), never cropped, and rendered as the
//           film <film>-<shape> to out/<film>-<shape>.mp4, one after another, with the other flags.
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { basename, join, resolve } from "node:path";
import { buildPage } from "./build-page.mjs";
import { enginePath } from "./overlay.mjs";
import { detect } from "./detect.mjs";
import * as playwright from "./adapters/playwright.mjs";
import { defaultOutput, requireFilm } from "./names.mjs";
import { float32Wav } from "./audio.mjs";
import { firstFrameBlank } from "./thumb.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
if (process.argv.includes("--shapes")) {
  const { SHAPE_NAMES, splitShape } = await import("./names.mjs");
  const shapes = String(arg("shapes", "")).split(",").map((x) => x.trim()).filter(Boolean), bad = shapes.filter((x) => !SHAPE_NAMES.includes(x));
  if (!shapes.length || bad.length) { console.error(`--shapes wants a list of ${SHAPE_NAMES.join(", ")}, got '${arg("shapes", "")}'`); process.exit(2); }
  if (process.argv.includes("--out")) { console.error("--shapes writes out/<film>-<shape>.<ext> for each shape; drop --out"); process.exit(2); }
  const base = splitShape(process.argv[2]).base, rest = process.argv.slice(3).filter((a, i, all) => a !== "--shapes" && all[i - 1] !== "--shapes");
  for (const sh of shapes) { console.log(`\n==== ${base}-${sh} ====`); const r = spawnSync(process.execPath, [process.argv[1], `${base}-${sh}`, ...rest], { stdio: "inherit" }); if (r.status) process.exit(r.status); }
  process.exit(0);
}
const film = requireFilm(process.argv[2], "render", "node tools/render.mjs <film> [--scale 1] [--out out/x.mp4|.gif|.webm|.apng] [--from F] [--to F] [--poster-frame N] [--blur N]");
const BLUR = arg("blur", "1") === "auto" ? "auto" : Number(arg("blur", 1)), SHUTTER = Number(arg("shutter", 180)), BMAX = Number(arg("blur-max", 32)), BPX = Number(arg("blur-px", 3));
if (BLUR !== "auto" && (!Number.isInteger(BLUR) || BLUR < 1)) { console.error(`--blur wants a whole number of subframes >= 1 or 'auto', got '${arg("blur")}'`); process.exit(2); }
if (!(SHUTTER > 0 && SHUTTER <= 360)) { console.error(`--shutter wants an angle in (0, 360] degrees, got '${arg("shutter")}'`); process.exit(2); }
if (!Number.isInteger(BMAX) || BMAX < 2 || !(BPX > 0)) { console.error(`--blur-max wants a whole number >= 2 and --blur-px a number > 0`); process.exit(2); }
const SHARP = !process.argv.includes("--blur-all"); // type and photos stay sharp under the blur unless asked otherwise
const BLURRED = BLUR === "auto" || BLUR > 1, BSPEC = BLUR === "auto" ? { samples: 0, shutter: SHUTTER, max: BMAX, px: BPX, sharp: SHARP } : { samples: BLUR, shutter: SHUTTER, sharp: SHARP };
const scale = Number(arg("scale", 1)), fmt = (arg("out", "").match(/\.(gif|webm|apng)$/i)?.[1] ?? "mp4").toLowerCase(), workers = Number(arg("workers", Math.max(1, Math.min(4, Math.floor(cpus().length / 2)))));
const HASHES = arg("hashes", null) ? new Map() : null;
const RANGE_ASKED = process.argv.includes("--from") || process.argv.includes("--to");
const POSTER = arg("poster-frame", null) === null ? null : Number(arg("poster-frame")), FADE = Number(arg("poster-fade", 6));
if (POSTER !== null && (!Number.isInteger(POSTER) || POSTER < 0)) { console.error(`--poster-frame wants a frame number >= 0, got '${arg("poster-frame")}'`); process.exit(2); }
if (!Number.isInteger(FADE) || FADE < 0) { console.error(`--poster-fade wants a whole number of frames >= 0, got '${arg("poster-fade")}'`); process.exit(2); }

const env = detect();
console.log("backends found:"); for (const [k, v] of Object.entries(env.report)) console.log(`  ${k.padEnd(11)} ${v}`);
if (!env.chosen) { console.error("\nno usable render backend. The HTML player still works: node tools/build-page.mjs"); process.exit(2); }
console.log(`using: ${env.chosen}\n`);

const page = await buildPage({ entry: `src/hosts/page-${film}.ts`, out: resolve(`dist/${film}.html`), title: film });
console.log(`page: ${page.out} (${(page.bytes / 1024).toFixed(0)} KB)`);
const t0 = Date.now(), session = await playwright.open(env, page.out, { scale, workers }), meta = await session.info(), N = meta.durationFrames;
// out of range is an error that names the valid range, never a silent clamp (the same rule as --poster-frame)
const FROM = Number(arg("from", 0)), TO = Number(arg("to", N)), bad = (m) => { console.error(`${m}; this film has frames 0-${N - 1}: --from 0..${N - 1}, --to 1..${N} (exclusive)`); process.exit(2); };
if (!Number.isInteger(FROM) || FROM < 0 || FROM >= N) bad(`--from ${arg("from")} ${Number.isInteger(FROM) ? "is outside the film" : "is not a whole frame number"}`);
if (!Number.isInteger(TO) || TO < 1 || TO > N) bad(`--to ${arg("to")} ${Number.isInteger(TO) ? "is outside the film" : "is not a whole frame number"}`);
if (TO <= FROM) bad(`--to ${TO} must be after --from ${FROM}`);
const ranged = FROM !== 0 || TO !== N;
// a passage never lands on the finished film's path: default to out/<film>.<from>-<to>.<ext>, and refuse an explicit --out that IS the film
const full = resolve(defaultOutput(film).replace(/\.mp4$/, `.${fmt}`));
const out = resolve(arg("out", ranged ? `out/${film}.${FROM}-${TO}.${fmt}` : full));
if (ranged && out === resolve(defaultOutput(film))) { console.error(`refusing to write a range render over the finished film ${out}; pick another --out or drop --from/--to`); process.exit(2); }
if (RANGE_ASKED && !ranged) console.log("range covers the whole film: rendering it complete, with its score");
if (POSTER !== null && POSTER >= N) { console.error(`--poster-frame ${POSTER} is outside the film; this film has frames 0-${N - 1}`); process.exit(2); }
if (POSTER !== null) console.log(`poster: frame 0 is frame ${POSTER}, dissolving into the opening by frame ${Math.max(1, FADE)}`);
const posterAt = (n) => POSTER !== null && n < Math.max(1, FADE); // frames the poster dissolve touches
const drawAt = (n, w) => (posterAt(n) ? session.poster(n, POSTER, FADE, BLURRED ? BSPEC : 1, w) : BLURRED ? session.blur(n, BSPEC, w) : session.frame(n, w));
// a film whose cuts sit on its beat grid (meta.score.grid) must hear its score at that grid's tempo
if (meta.score?.grid && Math.abs(meta.score.tempo / meta.bpm - 1) > 0.005) { console.error(`render: the score plays at ${meta.score.tempo.toFixed(2)} bpm but this film's cuts sit on a ${meta.bpm} bpm grid (${((meta.score.tempo / meta.bpm - 1) * 100).toFixed(1)} %, limit 0.5 %): the cuts would drift off the downbeats. Play the score at the film's bpm and make the film whole bars of it (launchTemplate does), or compose a 1-bar stretch section`); process.exit(2); }
console.log(`film: "${meta.title}" ${meta.W}x${meta.H} @ ${meta.fps} fps, ${N} frames, ${meta.bpm} bpm, scale ${scale}, ${session.workers} page(s)`);
if (BLURRED) console.log(`motion blur: ${BLUR === "auto" ? `adaptive (subframes <= ${BPX} px apart, max ${BMAX})` : `${BLUR} subframes per frame`}, ${SHUTTER}-degree shutter, linear light, ${SHARP ? "type and photos kept sharp" : "EVERYTHING blurred (--blur-all), type and photos too"}`);
if (ranged) console.log(`range render: frames [${FROM}, ${TO}) of ${N}, silent by design`);

// audio: the page returns its embedded recorded track or its code-built mix -> WAV here
// (skipped for a range render: the score would not line up).
mkdirSync(resolve(".tmp"), { recursive: true }); const wav = resolve(`.tmp/${film}.wav`), a = ranged ? null : await session.audio(48000);
if (a) writeFileSync(wav, float32Wav(a));
if (a) { // the audio report: loudness and true peak, and the score's fit against the picture's grid
  // the meter is an engine file: a linked project (scaffold --linked) runs from its own folder and has no copy
  const { build } = await import("esbuild"), js = (await build({ entryPoints: [enginePath("src/canvas-core/music/meter.ts")], bundle: true, write: false, format: "esm", platform: "neutral", logLevel: "error" })).outputFiles[0].text;
  const { loudness, truePeak } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  const pcm = new Float32Array(Uint8Array.from(Buffer.from(a.float32, "base64")).buffer), L = new Float32Array(a.frames), R = new Float32Array(a.frames);
  for (let i = 0; i < a.frames; i++) { L[i] = pcm[2 * i]; R[i] = pcm[2 * i + 1]; }
  const lu = loudness([L, R], a.sampleRate).integrated, tp = truePeak([L, R]).dbtp;
  console.log(`audio: ${lu.toFixed(1)} LUFS integrated, ${tp.toFixed(1)} dBTP true peak`);
  if (lu < -14.5 && tp > -1.1) console.log(`  NOTE the -1 dBTP ceiling held the gain ${(-14 - lu).toFixed(1)} dB under -14 LUFS (the cross-platform target): peaks are a composing problem (stagger the bass under the loudest downbeat, roll the big chord); a launch template bed takes \`limit: true\``);
  if (meta.score) { const off = (meta.score.tempo / meta.bpm - 1) * 100;
    console.log(`score: ${meta.score.tempo.toFixed(2)} bpm (${meta.score.form}); the picture's grid is ${meta.bpm} bpm (${off >= 0 ? "+" : ""}${off.toFixed(2)} %)`);
    if (!meta.score.grid && Math.abs(off) > 2) console.log("  NOTE past 2 % the score's downbeats drift from meta.bpm: a 1-bar stretch section, or the Material's `tail`, lets the fit land nearer it"); }
}

mkdirSync(join(out, ".."), { recursive: true });
const input = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(meta.fps), "-c:v", "png", "-i", "-"];
const gifFps = Math.min(meta.fps, Number(arg("gif-fps", meta.fps))), width = Number(arg("width", Math.round(meta.W * scale)));
const size = `scale=${width}:-2:flags=lanczos`;
const encode = {
  gif: [...input, "-vf", `fps=${gifFps},${size},split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`, "-loop", "0", out],
  webm: [...input, "-vf", size, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30", "-an", out],
  apng: [...input, "-vf", size, "-f", "apng", "-plays", "0", out],
  mp4: [...input, ...(a ? ["-i", wav] : []), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "medium", ...(a ? ["-c:a", "aac", "-b:a", "192k", "-shortest"] : []), "-movflags", "+faststart", out],
}[fmt];
const ff = spawn(env.ffmpeg.bin, encode, { stdio: ["pipe", "inherit", "inherit"] });
const done = new Promise((res, rej) => ff.on("close", (c) => (c ? rej(new Error(`ffmpeg exited ${c}`)) : res())));

// frames render in parallel across pages, and are fed to ffmpeg strictly in order
const cost = [], pending = new Map(); let next, write;
const pump = async () => { while (pending.has(write)) { const b = pending.get(write); pending.delete(write); if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once("drain", r)); write++; } };
next = FROM; write = FROM;
await Promise.all(Array.from({ length: session.workers }, async (_, w) => { while (next < TO) { const n = next++; while (n - write > session.workers * 3) await new Promise((r) => setTimeout(r, 5)); const f = await drawAt(n, w); if (HASHES) HASHES.set(n, createHash("md5").update(f.png).digest("hex")); cost.push({ n, shot: f.shot, draw: f.drawMs, enc: f.encodeMs, rt: f.roundTripMs, samples: f.samples ?? 1, sharp: f.sharpPx ?? 0, typeInLayers: f.typeInLayers ?? 0 }); pending.set(n, f.png); await pump(); } }));
await pump(); ff.stdin.end(); await done;
const wall = (Date.now() - t0) / 1000;
if (HASHES) { const hf = resolve(arg("hashes")); mkdirSync(join(hf, ".."), { recursive: true }); writeFileSync(hf, [...HASHES].sort((a, b) => a[0] - b[0]).map(([n, h]) => `${n} ${h}`).join("\n") + "\n"); console.log(`frame hashes -> ${hf}`); }

// ---- frame cost
const stat = (xs) => { const s = [...xs].sort((a, b) => a - b); return { med: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
console.log("\nframe cost (ms), draw = art core only, png = canvas PNG encode in page:");
for (const id of [...new Set(cost.map((c) => c.shot))]) { const c = cost.filter((x) => x.shot === id), d = stat(c.map((x) => x.draw)), e = stat(c.map((x) => x.enc)); console.log(`  ${id.padEnd(12)} draw median ${d.med.toFixed(0)}  p95 ${d.p95.toFixed(0)}  max ${d.max.toFixed(0)}   | png median ${e.med.toFixed(0)}   (${c.length} frames)`); }
const slow = [...cost].sort((a, b) => b.draw - a.draw).slice(0, 3).map((c) => `#${c.n} ${c.shot} ${c.draw.toFixed(0)}ms`).join(", ");
console.log(`  slowest: ${slow}\n  budget: 150 ms draw per frame -> ${cost.every((c) => c.draw <= 150) ? "PASS" : "OVER on " + cost.filter((c) => c.draw > 150).length + " frames"}`);
if (BLUR === "auto") { const hist = {}; cost.forEach((c) => { const b = c.samples <= 1 ? "1" : c.samples <= 4 ? "2-4" : c.samples <= 8 ? "5-8" : c.samples <= 16 ? "9-16" : "17+"; hist[b] = (hist[b] ?? 0) + 1; }); console.log(`  adaptive blur: subframes per frame ${Object.entries(hist).map(([k, v]) => `${k}: ${v}`).join(", ")} (mean ${(cost.reduce((a, c) => a + c.samples, 0) / cost.length).toFixed(1)}, max ${Math.max(...cost.map((c) => c.samples))})`); }
console.log(`  wall clock: ${wall.toFixed(1)} s for ${TO - FROM} frames = ${((TO - FROM) / wall).toFixed(1)} fps end to end (build + launch + render + encode)`);

// ---- verify: same frame, different order, different page. Standard = visually identical; hash equality is the cheap first test.
const probe = [...new Set([0, ...meta.shots.flatMap((s) => [s.start, s.end - 1]), ...((k) => Array.from({ length: k }, (_, i) => Math.round(i * (N - 1) / (k - 1 || 1))))(Math.min(6, N)), N - 1])].filter((n) => n >= FROM && n < TO).sort((a, b) => a - b), fwd = [], rev = [];
if (!probe.length) probe.push(FROM);
const hashOf = (n, w) => (posterAt(n) ? session.posterHash(n, POSTER, FADE, BLURRED ? BSPEC : 1, w) : BLURRED ? session.blurHash(n, BSPEC, w) : session.hash(n, w)); // probe what was WRITTEN: poster dissolve, blurred frame
for (const n of probe) fwd.push(await hashOf(n, 0)); for (const n of [...probe].reverse()) rev.unshift(await hashOf(n, session.workers - 1));
const same = probe.filter((_, i) => fwd[i] === rev[i]).length;
console.log(`\ndeterminism: ${same}/${probe.length} probe frames${BLURRED ? ` (blurred, ${BLUR === "auto" ? "adaptive" : `${BLUR} subframes`}, ${SHUTTER} degrees)` : ""} hash-identical (forward on page 0 vs reversed on page ${session.workers - 1})${same === probe.length ? "" : "  -> fall back to PSNR > 45 dB in the Phase 2 gate"}`);
await session.close();
// THE SIDECAR. <out>.film.json says which film and which frames this file is, so the checks that read a
// delivered file (verify-export, motionscan, soundcheck) never have to guess the film from its name: the
// A brand film's deliverables were called brandLaunch-v12.mp4 while the film was brandHook, and verify-export
// could not find them. The sha256 ties the sidecar to these exact bytes; a re-encode or a rename-and-
// replace is caught by comparing it. The file is named without its folder: the sidecar travels with the
// film, and an absolute path would carry the maker's home folder with it.
{
  const { readFileSync } = await import("node:fs"), sha = createHash("sha256").update(readFileSync(out)).digest("hex");
  const pick = ({ title, W, H, fps, bpm, durationFrames, kind, holds, quiet, sync, captions, poster, motion, checks, shots }) => ({ title, W, H, fps, bpm, durationFrames, kind, holds, quiet, sync, captions, poster, motion, checks, shots });
  writeFileSync(`${out}.film.json`, JSON.stringify({ film, file: basename(out), sha256: sha, frames: [FROM, TO], scale, blur: BLURRED ? { samples: BLUR, shutter: SHUTTER, sharp: SHARP } : null, poster: POSTER, meta: pick(meta) }, null, 1) + "\n");
}
const sharpFrames = cost.filter((c) => c.sharp > 0).length;
if (BLURRED && SHARP) console.log(`blur mask: type and photos kept sharp on ${sharpFrames} of ${cost.length} frames`);
// the mask only sees type drawn on the frame's own canvas: type composited from an offscreen layer blurs with it (instrument.ts)
const layerTypeFrames = cost.filter((c) => c.typeInLayers > 0).length;
if (BLURRED && SHARP && layerTypeFrames) console.log(`  NOTE ${layerTypeFrames} frame(s) composited type from layers that blurred: that type is NOT kept sharp. Draw it on the frame's canvas, not in a layer, to keep it crisp`);
const pr = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,nb_frames,duration", "-of", "csv=p=0", out]).toString().trim().split("\n");
console.log(`\noutput: ${out}\nsidecar: ${out}.film.json`); pr.forEach((l) => console.log(`  ${l}`));
if (fmt === "mp4" && !ranged) { const t = firstFrameBlank(out); if (t.blank) console.log(`\nWARNING  frame 0 is near-blank (${t.detail}). Platforms use frame 0 as the thumbnail: re-render with --poster-frame N (a legible frame: the wall, the logo).`); }
