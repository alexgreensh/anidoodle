#!/usr/bin/env node
// TRACK. Supplied or generated music (a Lyria take, a licensed track) as a first-class path: measured,
// cut by whole bars, mixed under the film's own cues with unpitched effects, mastered, and checked on
// the muxed file. A brand launch film did all of this by hand in Python and shell, and shipped a
// silent ending twice. Generation itself stays with the person's chosen provider: `prompt` writes the
// request and states the price, it never calls a paid API.
//
//   node tools/track.mjs analyze <audio> [--bpm 120] [--downbeat 0.02] [--json] [--out a.json]
//   node tools/track.mjs cut <audio> (--segs "0:6,8:36" | --segs-file f.txt | --bars "0-3,4-18")
//        [--film <name> | --film-s 88.8] [--fade-out S] [--end-tol 0.5] [--xfade 12] [--bpm N] -o cut.wav
//   node tools/track.mjs import <audio> --provider "lyria-3.5" [--cost 0.08] [--prompt p.txt] [--licence "..."]
//   node tools/track.mjs prompt --len 70 --bpm 120 --style "..." [--key "A minor"] [--sections "0-11 Intro: ...; 11-12 Hard stop: ..."] [-o p.txt]
//   node tools/track.mjs kit <outdir> [--from-pack]
//   node tools/track.mjs mix --music cut.wav --cues out/<film>.cues.json [--sounds map.json] -o mix.wav [--stem sfx.wav]
//   node tools/track.mjs master <picture.mp4> <mix.wav> -o out.mp4 [--tp -1] [--lufs -14]
//   node tools/track.mjs check <file.mp4|wav> [--film-s S] [--fps 60] [--quiet-from cut.json|mix.json] [--json]
//   node tools/track.mjs listen <outdir> --mix mix.wav [--at 20] [--len 10] [--takes a.wav,b.wav]
// Exit 1 on a failed check or a refused cut, 2 on bad input.
import { build } from "esbuild";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { isMain } from "./is-main.mjs";
import { filmShape } from "./filmshape.mjs";

const here = dirname(fileURLToPath(import.meta.url)), SR = 48000;
let modP = null;
/** The pure modules (track analysis, the mix over a track, the effects kit, meters) in one bundle. */
export const loadTrack = () => (modP ??= (async () => {
  const src = `export * from "./src/canvas-core/music/track"; export * from "./src/canvas-core/music/trackMix"; export * from "./src/canvas-core/music/meter"; export { renderSfx, sfxInfo, sfxVariants } from "./src/canvas-core/music/sfxKit";`;
  const r = await build({ stdin: { contents: src, resolveDir: join(here, ".."), loader: "ts" }, bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022", logLevel: "error" });
  return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
})());

// ---------------------------------------------------------------- audio in and out
export const decode = (file, sr = SR) => {
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  const b = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vn", "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", String(sr), "pipe:1"], { maxBuffer: 2 ** 31 });
  const f = new Float32Array(b.buffer, b.byteOffset, b.length / 4), n = f.length / 2, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return [L, R];
};
/** 32-bit float stereo WAV: nothing clips on the way to the encoder. */
export const writeWav = (path, L, R, sr = SR) => {
  const n = L.length, data = Buffer.alloc(n * 8), h = Buffer.alloc(44);
  for (let i = 0; i < n; i++) { data.writeFloatLE(L[i], i * 8); data.writeFloatLE(R[i], i * 8 + 4); }
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  mkdirSync(dirname(resolve(path)), { recursive: true }); writeFileSync(path, Buffer.concat([h, data]));
};
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const probeDur = (file) => { const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration,avg_frame_rate:format=duration", "-of", "json", file]).toString()); const v = j.streams.find((s) => s.codec_type === "video"); const [a, b] = (v?.avg_frame_rate ?? "0/1").split("/").map(Number); return { video: v ? Number(v.duration ?? j.format.duration) : null, fps: b ? a / b : 0, duration: Number(j.format.duration), audio: j.streams.some((s) => s.codec_type === "audio") }; };
/** ffmpeg's own EBU R128 reading of a file: integrated loudness and true peak (what a platform measures). */
export const ebur = (file) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const s = r.stderr.slice(r.stderr.lastIndexOf("Summary:")), I = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(s), P = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(s);
  if (!I || !P) throw new Error(`could not meter ${file}: ${r.stderr.slice(-300)}`);
  return { lufs: Number(I[1]), tp: P[1] === "-inf" ? -Infinity : Number(P[1]) };
};
/** A film's length in seconds from its module (meta.durationFrames / meta.fps). */
const filmSeconds = async (name) => { const { loadFilmModule } = await import("./audio.mjs"); const { film } = await loadFilmModule(name); return { s: film.meta.durationFrames / film.meta.fps, fps: film.meta.fps }; };

// ---------------------------------------------------------------- arguments
const parseArgs = (argv) => {
  const pos = [], o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o") { o.out = argv[++i]; continue; }
    if (a.startsWith("--")) { const k = a.slice(2), nx = argv[i + 1]; if (nx === undefined || nx.startsWith("--") || ["json", "from-pack"].includes(k)) o[k] = true; else { o[k] = nx; i++; } continue; }
    pos.push(a);
  }
  return { pos, o };
};
const num = (v, name) => { if (v === undefined) return undefined; const n = Number(v); if (!Number.isFinite(n)) throw new Error(`--${name} wants a number, got "${v}"`); return n; };

// ---------------------------------------------------------------- analyze
export const analyzeFile = async (file, o = {}) => { const T = await loadTrack(), [L, R] = decode(file); return T.analyzeTrack(L, R, SR, { bpm: o.bpm, downbeatS: o.downbeatS }); };
const fmtAnalysis = (a, file) => {
  const out = [`TRACK  ${file}`, `  ${a.durationS} s, ${a.bpm} bpm (beat ${a.beatS} s, bar ${a.barS} s), first downbeat ${a.downbeatS} s`,
    `  tempo candidates: ${a.tempoCandidates.length ? a.tempoCandidates.map((c) => `${c.bpm} (${c.rel})`).join(", ") + "  <- if your ear or the prompt says another, pin it with --bpm" : "pinned with --bpm"}`,
    `  key ${a.key.name}${a.key.confidence < 0.1 ? " (unclear: margin " + a.key.confidence + " over " + a.key.runnerUp + "; a generated take often ignores the key asked for)" : ` (margin ${a.key.confidence} over ${a.key.runnerUp})`}`,
    `  last note ends ${a.lastSoundS} s; ${a.tailS} s of silence after it${a.tailS > 0.5 ? "  <- an edit must not reach past the last note" : ""}`,
    `  stops (designed drop-outs): ${a.stops.length ? a.stops.map((s) => `${s.atS} s for ${s.lenS} s`).join(", ") : "none"}`, "", "  SECTIONS (by bar level against the body, " + a.bodyDb + " dB)"];
  for (const s of a.sections) out.push(`    bars ${String(s.fromBar).padStart(3)}-${String(s.toBar).padEnd(4)} ${String(s.fromS).padStart(7)}-${String(s.toS).padEnd(8)} ${s.level.padEnd(6)} peak bar ${s.rmsDb} dB`);
  out.push("", "  BARS (bar: start s, level dB)");
  for (let i = 0; i < a.bars.length; i += 6) out.push("    " + a.bars.slice(i, i + 6).map((b) => `${String(b.i).padStart(3)}: ${b.t.toFixed(2).padStart(6)} ${String(b.rmsDb).padStart(6)}`).join("   "));
  return out.join("\n");
};

// ---------------------------------------------------------------- cut
const readSegs = (T, o, a) => {
  const n = ["segs", "segs-file", "bars"].filter((k) => o[k] !== undefined);
  if (n.length !== 1) throw new Error("cut wants exactly one of --segs, --segs-file or --bars");
  const text = o["segs-file"] ? readFileSync(resolve(o["segs-file"]), "utf8") : o.bars ? `bars ${o.bars}` : String(o.segs);
  return T.parseSegs(text, a);
};
export const cutFile = async (file, o) => {
  const T = await loadTrack(), [L, R] = decode(file), a = T.analyzeTrack(L, R, SR, { bpm: num(o.bpm, "bpm"), downbeatS: num(o.downbeat, "downbeat") });
  const segs = readSegs(T, o, a), film = o.film ? await filmSeconds(o.film) : null, filmS = film?.s ?? num(o["film-s"], "film-s");
  const plan = T.planCut(a, segs, { filmS, fadeOutS: num(o["fade-out"], "fade-out"), endTolS: num(o["end-tol"], "end-tol") });
  return { a, plan, render: () => T.renderCut(L, R, SR, plan.segs, { xfadeMs: num(o.xfade, "xfade"), fadeOutS: num(o["fade-out"], "fade-out") }) };
};

// ---------------------------------------------------------------- prompt (never calls the provider)
export const PRICES = { "lyria-3.5": { usd: 0.08, unit: "song", checked: "2026-10-27", source: "https://ai.google.dev/gemini-api/docs/pricing" } };
export const promptText = (o) => {
  const len = num(o.len, "len"), bpm = num(o.bpm, "bpm");
  if (!len || !bpm) throw new Error("prompt wants --len <seconds> and --bpm <tempo>");
  const bar = (240 / bpm).toFixed(2), sections = String(o.sections ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  const lines = [
    `Tempo is locked at exactly ${bpm} BPM (one beat every ${(60 / bpm).toFixed(2)} seconds, one bar every ${bar} seconds), steady metronomic tempo throughout, no tempo changes. Section boundaries fall exactly on bar lines.`, "",
    `${o.style ?? "Warm modern downtempo instrumental."}${o.key ? ` In ${o.key}.` : ""} Instrumental only, no vocals, no voices, no choir. Exactly ${bpm} BPM in 4/4, the first downbeat lands at 0:00 with no pickup or silence before it. Total length ${len} seconds, ending cleanly on one final button hit with under 2 seconds of tail and no long fade.`,
  ];
  if (sections.length) { lines.push(""); for (const s of sections) { const m = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s+(.*)$/.exec(s); if (!m) throw new Error(`--sections: cannot read "${s}" (write "from-to Name: what happens")`); const t = (x) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, "0")}`; lines.push(`[${t(+m[1])} - ${t(+m[2])}] ${m[3]}`); } }
  return lines.join("\n");
};

// ---------------------------------------------------------------- kit
// The recorded route, ported from a brand launch film's hand-written kit script with its bug fixed by construction: every
// strike is cut from its own PEAK (the first cut trimmed leading silence and kept a -46 dB tick), then
// filtered, faded and normalised to -6 dBFS. Too short to carry a note under someone else's music.
export const PACK_KIT = [
  { name: "tick", pat: /^C7_l3_rr1.*\.flac$/, dir: "marimba", preMs: 1.5, lenMs: 16, af: "highpass=f=1800,afade=t=in:d=0.0008,afade=t=out:st=0.006:d=0.010" },
  { name: "tickHi", pat: /^C8_l2_rr1.*\.flac$/, dir: "glockenspiel", preMs: 1.0, lenMs: 10, af: "highpass=f=3000,afade=t=in:d=0.0006,afade=t=out:st=0.004:d=0.006" },
  { name: "tock", pat: /^C5_l3_rr1.*\.flac$/, dir: "marimba", preMs: 2.0, lenMs: 26, af: "highpass=f=500,lowpass=f=6000,afade=t=in:d=0.001,afade=t=out:st=0.010:d=0.016" },
  { name: "thump", pat: /^Timpani2A_l3_rr1.*\.flac$/, dir: "timpani", preMs: 3.0, lenMs: 110, af: "lowpass=f=150,lowpass=f=150,afade=t=in:d=0.002,afade=t=out:st=0.04:d=0.07" },
  { name: "impact", pat: /^Timpani3A_l3_rr1.*\.flac$/, dir: "timpani", preMs: 3.0, lenMs: 1600, af: "lowpass=f=500,afade=t=in:d=0.002,afade=t=out:st=0.6:d=1.0" },
];
/** Cut one transient from its peak: the sample index of the loudest sample, minus preMs. */
export const cutFromPeak = (x, sr, preMs, lenMs) => {
  let pk = 0, at = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > pk) { pk = Math.abs(x[i]); at = i; }
  const s = Math.max(0, at - Math.round((preMs * sr) / 1000)); return x.slice(s, s + Math.round((lenMs * sr) / 1000));
};

// ---------------------------------------------------------------- mix
/** A sounds map: cue name (or a prefix ending in *) -> "tap:thump -9 pan=0.3". The cue's own `sound` wins. */
const soundFor = (cue, map) => cue.sound ?? map[cue.name] ?? Object.entries(map).find(([k]) => k.endsWith("*") && cue.name.startsWith(k.slice(0, -1)))?.[1];

// ---------------------------------------------------------------- check (the muxed file)
/**
 * Everything a delivered external-track mix must pass, on the exact file: integrated loudness near the
 * target, true peak at or under the ceiling (AAC adds peak, so it is measured AFTER encoding), and the
 * film shape: the sound starts with the picture, has no hole, and does not stop before the picture does.
 */
export const checkFile = async (file, o = {}) => {
  const p = probeDur(file); if (!p.audio) throw new Error(`${basename(file)} has no audio stream`);
  const [L, R] = decode(file), m = ebur(file), rows = [], fps = num(o.fps, "fps") ?? (p.fps || 30);
  const lufsT = num(o.lufs, "lufs") ?? -14, tpT = num(o.tp, "tp") ?? -1;
  const picS = num(o["film-s"], "film-s") ?? p.video ?? p.duration, soundS = L.length / SR;
  const add = (ok, label, value, fix) => rows.push({ status: ok ? "PASS" : "FAIL", label, value, fix: ok ? undefined : fix });
  add(Math.abs(m.lufs - lufsT) <= 1, "integrated loudness", `${m.lufs} LUFS (target ${lufsT})`, `re-master to ${lufsT} LUFS: node tools/track.mjs master <picture> <mix.wav> -o <out>`);
  add(m.tp <= tpT, "true peak after encoding", `${m.tp} dBTP (ceiling ${tpT})`, "AAC adds about 3 dB of peak: master again (track.mjs master lowers the limiter until the ENCODED file passes)");
  const quiet = quietFrom(file, o).map(({ fromS, toS }) => [Math.floor(fromS * fps), Math.ceil(toS * fps)]);
  const shape = filmShape(L, R, SR, { fps, quiet });
  for (const pr of shape.problems) add(false, `sound shape: ${pr.kind}`, pr.msg, pr.kind === "dead end" ? "the music ends before the picture: extend the outro by whole bars (track.mjs cut --film-s), or end the picture on the music's last note" : "declare a designed silence in meta.quiet, or fill it");
  if (!shape.problems.length) add(true, "sound shape", `starts ${shape.firstS.toFixed(1)} s, longest hole ${shape.holeS.toFixed(1)} s, ends ${shape.endS.toFixed(1)} s before the picture`);
  if (p.video !== null || o["film-s"] !== undefined) add(soundS >= picS - 0.1, "sound covers the picture", `${soundS.toFixed(2)} s of sound for ${picS.toFixed(2)} s of picture`, "the audio stream is shorter than the picture: rebuild the mix at the film's length");
  return { file, rows, verdict: rows.some((r) => r.status === "FAIL") ? "FAIL" : "PASS", lufs: m.lufs, tp: m.tp };
};
/**
 * Designed silences in seconds: --quiet-from <cut.json|mix.json>, else the sidecars next to the file
 * (<out>.mix.json written by mix and copied by master), so a track's own hard stops are declared once,
 * by the analysis, and never reported as holes.
 */
const quietFrom = (file, o) => {
  const cands = [o["quiet-from"], `${file}.mix.json`, `${file}.cut.json`].filter(Boolean).map((f) => resolve(f));
  const f = cands.find((c) => existsSync(c)); if (o["quiet-from"] && !existsSync(resolve(o["quiet-from"]))) throw new Error(`--quiet-from: no such file ${o["quiet-from"]}`);
  return f ? JSON.parse(readFileSync(f, "utf8")).quiet ?? [] : [];
};
const printRows = (title, rows, verdict) => { console.log(title); for (const r of rows) console.log(`  ${r.status.padEnd(5)} ${r.label.padEnd(28)} ${r.value}${r.fix ? `\n        fix: ${r.fix}` : ""}`); console.log(`VERDICT: ${verdict}`); };

// ---------------------------------------------------------------- master
/**
 * The delivery chain a brand launch film ended on (loudnorm to the target, a limiter, AAC 256k), with
 * the step it did by hand made automatic: the true peak is read from the ENCODED file, and while it is
 * over the ceiling the limiter comes down by the excess and the file is encoded again (at most 5 times).
 */
export const master = (picture, mix, out, o = {}) => {
  const lufs = num(o.lufs, "lufs") ?? -14, ceil = num(o.tp, "tp") ?? -1;
  // The picture's length is measured on the SOURCE picture, never on the output: the film is never cut to
  // the mix. A mix shorter than the picture is refused before anything is written; a longer one is trimmed
  // to the picture.
  const pv = probeDur(picture), pictureS = pv.video ?? pv.duration, mixS = probeDur(mix).duration;
  if (!(pictureS > 0)) throw new Error(`${basename(picture)} has no picture to master onto`);
  if (mixS < pictureS - 0.05) return { out, ok: false, refused: `the mix ${basename(mix)} is ${mixS.toFixed(2)} s, shorter than the picture ${basename(picture)} (${pictureS.toFixed(2)} s): rebuild the mix at the film's length (track.mjs cut --film-s ${pictureS.toFixed(2)}). Nothing written.`, pictureS };
  let limitDb = ceil - 2.6, m = null; const tmp = out.replace(/\.[^.]+$/, "") + ".master.wav";
  try {
    for (let k = 0; k < 5; k++) {
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", mix, "-af", `loudnorm=I=${lufs}:TP=${ceil - 0.5}:LRA=11:linear=true,alimiter=limit=${Math.pow(10, limitDb / 20).toFixed(4)}:level=false:attack=3:release=60`, "-ar", String(SR), tmp]);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", picture, "-t", pictureS.toFixed(4), "-i", tmp, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", out]);
      m = ebur(out);
      if (m.tp <= ceil) break;
      limitDb -= m.tp - ceil + 0.3;
    }
  } finally { rmSync(tmp, { force: true }); }
  return { out, limitDb: +limitDb.toFixed(2), ...m, ok: m.tp <= ceil, pictureS };
};

// ---------------------------------------------------------------- listen
const listenPage = (title, items) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>:root{--bg:#F0EEE6;--ink:#1d1b16;--line:#d8d3c4}@media (prefers-color-scheme:dark){:root{--bg:#1b1a17;--ink:#eeeae0;--line:#34322c}}body{background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:auto;padding:24px 16px}h1{font-size:24px}h2{font-size:17px;margin-top:24px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.c{border:1px solid var(--line);border-radius:10px;padding:10px 12px}audio{width:100%}</style></head><body>
<h1>${title}</h1><p>Listen before the full mix: the effects on their own, then ten seconds of the mix, then the takes. Your ears are the check the tools cannot make.</p>
${items.map(([h, list]) => `<h2>${h}</h2><div class="g">${list.map(([f, t, d]) => `<div class="c"><b>${t}</b><div>${d}</div><audio controls preload="none" src="${f}"></audio></div>`).join("")}</div>`).join("\n")}
</body></html>`;

// ---------------------------------------------------------------- command line
if (isMain(import.meta.url)) {
  const { pos, o } = parseArgs(process.argv.slice(2)), cmd = pos[0];
  const die = (msg, code = 2) => { console.error(`track: ${msg}`); process.exit(code); };
  try {
    if (cmd === "analyze") {
      if (!pos[1]) die("usage: node tools/track.mjs analyze <audio> [--bpm N] [--downbeat S] [--json] [--out a.json]");
      const a = await analyzeFile(resolve(pos[1]), { bpm: num(o.bpm, "bpm"), downbeatS: num(o.downbeat, "downbeat") });
      if (o.out) writeFileSync(resolve(o.out), JSON.stringify(a, null, 1) + "\n");
      console.log(o.json ? JSON.stringify(a, null, 1) : fmtAnalysis(a, pos[1]));
    } else if (cmd === "cut") {
      if (!pos[1] || !o.out) die("usage: node tools/track.mjs cut <audio> (--segs \"0:6,8:36\" | --segs-file f.txt | --bars \"0-3,4-18\") [--film <name> | --film-s S] [--fade-out S] -o cut.wav");
      const { a, plan, render } = await cutFile(resolve(pos[1]), o);
      console.log(`CUT  ${pos[1]}  (${a.bpm} bpm, bar ${a.barS} s, last note ${a.lastSoundS} s)`);
      plan.segs.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.from}-${s.to} s  (${(s.to - s.from).toFixed(2)} s, ${((s.to - s.from) / a.barS).toFixed(2)} bars)`));
      console.log(`  edit length ${plan.lengthS} s; joins at ${plan.joins.map((j) => j.atS.toFixed(2)).join(", ") || "none"}`);
      for (const w of plan.warnings) console.log(`  WARN  ${w}`);
      for (const e of plan.errors) console.log(`  FAIL  ${e}`);
      if (plan.errors.length) { console.log("VERDICT: REFUSED (nothing written)"); process.exit(1); }
      const [L, R] = render(); writeWav(o.out, L, R);
      writeFileSync(o.out + ".cut.json", JSON.stringify({ source: resolve(pos[1]), sourceSha256: sha256(resolve(pos[1])), segs: plan.segs, lengthS: plan.lengthS, downbeats: plan.downbeats, quiet: plan.quiet, bpm: a.bpm }, null, 1) + "\n");
      console.log(`wrote ${o.out} (${(L.length / SR).toFixed(3)} s) and ${o.out}.cut.json (the edit's downbeats, for trackGrid)\nVERDICT: PASS`);
    } else if (cmd === "import") {
      if (!pos[1] || !o.provider) die("usage: node tools/track.mjs import <audio> --provider <model or source> [--cost USD] [--prompt p.txt] [--licence \"...\"]");
      const f = resolve(pos[1]), a = await analyzeFile(f, {});
      const man = { file: basename(f), sha256: sha256(f), provider: o.provider, costUsd: num(o.cost, "cost") ?? null, prompt: o.prompt ? readFileSync(resolve(o.prompt), "utf8") : null, licence: o.licence ?? null, importedAt: new Date().toISOString().slice(0, 10), analysis: { durationS: a.durationS, bpm: a.bpm, downbeatS: a.downbeatS, key: a.key.name, lastSoundS: a.lastSoundS, tailS: a.tailS, stops: a.stops } };
      writeFileSync(f + ".track.json", JSON.stringify(man, null, 1) + "\n");
      console.log(`pinned ${man.file} sha256 ${man.sha256.slice(0, 16)}... -> ${basename(f)}.track.json\n${fmtAnalysis(a, pos[1]).split("\n").slice(0, 4).join("\n")}`);
    } else if (cmd === "prompt") {
      const text = promptText(o), model = o.model ?? "lyria-3.5", price = PRICES[model];
      if (o.out) writeFileSync(resolve(o.out), text + "\n");
      console.log(text);
      console.log(`\n---\nNot sent. This tool never calls a paid API. ${price ? `${model} costs $${price.usd} per ${price.unit} (checked ${price.checked}, ${price.source}); check the page again before running.` : `No price on record for ${model}: look it up before running.`}\nState the cost to the person before generating, log every take in a COST.md ledger (date, model, result, cost), and ask for 3 to 4 takes: a model ignores exact timestamps, so the picture is fitted to the take with 'track.mjs analyze' and 'cut'.`);
    } else if (cmd === "kit") {
      if (!pos[1]) die("usage: node tools/track.mjs kit <outdir> [--from-pack]");
      const T = await loadTrack(), dir = resolve(pos[1]); mkdirSync(dir, { recursive: true });
      const rows = [];
      if (o["from-pack"]) {
        const pack = process.env.ANIDOODLE_SOUNDS || join(homedir(), ".anidoodle", "sounds");
        for (const k of PACK_KIT) {
          const d = join(pack, k.dir); if (!existsSync(d)) die(`the sound pack has no ${k.dir}/ (fetch it: node tools/soundfetch.mjs)`);
          const src = readdirSync(d).filter((f) => k.pat.test(f)).sort()[0]; if (!src) die(`no ${k.pat} in ${d}`);
          const [xl, xr] = decode(join(d, src)), seg = cutFromPeak(T.monoOf(xl, xr), SR, k.preMs, k.lenMs), raw = join(dir, `_${k.name}.wav`), out = join(dir, `${k.name}.wav`);
          writeWav(raw, seg, seg); execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", k.af, "-c:a", "pcm_f32le", join(dir, `_${k.name}2.wav`)]);
          const [y] = decode(join(dir, `_${k.name}2.wav`)); let pk = 0; for (const v of y) pk = Math.max(pk, Math.abs(v)); const g = Math.pow(10, -6 / 20) / Math.max(pk, 1e-9); const z = y.map((v) => v * g);
          writeWav(out, z, z); for (const f of [raw, join(dir, `_${k.name}2.wav`)]) rmSync(f, { force: true });
          rows.push([k.name, T.pitchSalience(z, SR), `${src}`]);
        }
      } else {
        for (const v of T.sfxVariants("tap")) { const s = T.renderSfx("tap", { variant: v, seed: 1 }, SR); writeWav(join(dir, `${v}.wav`), s.L, s.R); rows.push([v, T.pitchSalience(T.monoOf(s.L, s.R), SR), "engine tap:" + v]); }
      }
      console.log(`KIT  ${dir}`); for (const [n, p, src] of rows) console.log(`  ${(p.salience > T.PITCHED ? "FAIL" : "PASS").padEnd(5)} ${n.padEnd(8)} pitch salience ${p.salience.toFixed(2)} (raw ${p.raw}, rings ${p.ringMs} ms${Number.isFinite(p.hz) ? `, ${p.hz} Hz` : ""})  ${src}`);
      if (rows.some(([, p]) => p.salience > T.PITCHED)) process.exit(1);
    } else if (cmd === "mix") {
      if (!o.music || !o.cues || !o.out) die("usage: node tools/track.mjs mix --music cut.wav --cues out/<film>.cues.json [--sounds map.json] -o mix.wav [--stem sfx.wav]");
      const T = await loadTrack(), cuesDoc = JSON.parse(readFileSync(resolve(o.cues), "utf8")), map = o.sounds ? JSON.parse(readFileSync(resolve(o.sounds), "utf8")) : {};
      if (!Array.isArray(cuesDoc.cues) || !cuesDoc.fps || !cuesDoc.durationFrames) die(`${o.cues} is not a cue sheet (write one with: node tools/cues.mjs <film>)`);
      const cues = []; const unsounded = [];
      for (const c of cuesDoc.cues) { const spec = soundFor(c, map); if (spec === undefined) { unsounded.push(c.name); continue; } if (spec === null || spec === "none") continue; cues.push({ ...T.parseSoundSpec(spec), frame: c.frame, label: c.name }); }
      if (unsounded.length) console.log(`  note: ${unsounded.length} cue(s) have no sound (silent on purpose?): ${unsounded.slice(0, 8).join(", ")}${unsounded.length > 8 ? " ..." : ""}`);
      const music = decode(resolve(o.music)), m = T.mixOverTrack(music, { fps: cuesDoc.fps, frames: cuesDoc.durationFrames, cues, seed: 1 }, SR);
      console.log(T.trackMixReport(m));
      if (!m.ok) { console.log("VERDICT: FAIL (nothing written)"); process.exit(1); }
      writeWav(o.out, m.L, m.R); if (o.stem) writeWav(o.stem, m.sfx[0], m.sfx[1]);
      const cutJson = resolve(o.music) + ".cut.json", quiet = existsSync(cutJson) ? JSON.parse(readFileSync(cutJson, "utf8")).quiet ?? [] : [];
      writeFileSync(o.out + ".mix.json", JSON.stringify({ music: resolve(o.music), musicSha256: sha256(resolve(o.music)), cues: resolve(o.cues), cuesSha256: sha256(resolve(o.cues)), film: cuesDoc.film ?? null, lufs: m.lufs, dbtp: m.dbtp, quiet }, null, 1) + "\n");
      console.log(`wrote ${o.out}${o.stem ? ` and ${o.stem}` : ""}\nVERDICT: PASS`);
    } else if (cmd === "master") {
      if (!pos[1] || !pos[2] || !o.out) die("usage: node tools/track.mjs master <picture.mp4> <mix.wav> -o out.mp4 [--tp -1] [--lufs -14]");
      const r = master(resolve(pos[1]), resolve(pos[2]), resolve(o.out), o);
      if (r.refused) { console.log(`MASTER  ${o.out}\n  FAIL  ${r.refused}\nVERDICT: FAIL`); process.exit(1); }
      // The sidecar beside the output always describes THIS mix: an older one is removed first, so
      // provenance never reads the previous mix's record.
      const side = resolve(o.out) + ".mix.json"; rmSync(side, { force: true });
      if (existsSync(resolve(pos[2]) + ".mix.json")) copyFileSync(resolve(pos[2]) + ".mix.json", side);
      else console.log(`  note: no mix sidecar beside ${basename(pos[2])} (track.mjs mix writes one), so ${basename(side)} is not written and provenance will fail`);
      // The picture's film sidecar (<picture>.film.json, written by render) goes with it, re-hashed for the
      // mastered file, so ship and verify-export read the film's own settings from the delivered file. An
      // older one beside the output is removed first, as with the mix sidecar.
      const filmSide = resolve(o.out) + ".film.json", picSide = resolve(pos[1]) + ".film.json"; rmSync(filmSide, { force: true });
      if (existsSync(picSide)) { const rec = JSON.parse(readFileSync(picSide, "utf8")); writeFileSync(filmSide, JSON.stringify({ ...rec, file: basename(resolve(o.out)), sha256: sha256(resolve(o.out)), masteredFrom: basename(resolve(pos[1])) }, null, 1) + "\n"); }
      else console.log(`  note: no film sidecar beside ${basename(pos[1])} (render writes one), so ${basename(filmSide)} is not written`);
      console.log(`MASTER  ${o.out}: ${r.lufs} LUFS, ${r.tp} dBTP after AAC (limiter at ${r.limitDb} dB)`);
      // the picture length comes from the source picture, so the check can never measure a cut output against itself
      const c = await checkFile(resolve(o.out), { ...o, "film-s": o["film-s"] ?? r.pictureS }); printRows("CHECK (the muxed file)", c.rows, c.verdict);
      process.exit(r.ok && c.verdict === "PASS" ? 0 : 1);
    } else if (cmd === "check") {
      if (!pos[1]) die("usage: node tools/track.mjs check <file.mp4|wav> [--film-s S] [--fps N] [--lufs -14] [--tp -1] [--json]");
      const c = await checkFile(resolve(pos[1]), o);
      if (o.json) console.log(JSON.stringify(c, null, 1)); else printRows(`TRACK CHECK  ${pos[1]}`, c.rows, c.verdict);
      process.exit(c.verdict === "PASS" ? 0 : 1);
    } else if (cmd === "listen") {
      if (!pos[1] || !o.mix) die("usage: node tools/track.mjs listen <outdir> --mix mix.wav [--at 20] [--len 10] [--takes a.wav,b.wav] [--kit dir]");
      const T = await loadTrack(), dir = resolve(pos[1]); mkdirSync(dir, { recursive: true });
      const mp3 = (src, out, extra = []) => execFileSync("ffmpeg", ["-y", "-v", "error", ...extra, "-i", src, "-codec:a", "libmp3lame", "-b:a", "256k", join(dir, out)]);
      const kitRows = [];
      if (o.kit) for (const f of readdirSync(resolve(o.kit)).filter((f) => f.endsWith(".wav")).sort()) { mp3(join(resolve(o.kit), f), `kit-${f.replace(/\.wav$/, ".mp3")}`); kitRows.push([`kit-${f.replace(/\.wav$/, ".mp3")}`, f.replace(/\.wav$/, ""), "recorded transient"]); }
      else for (const v of T.sfxVariants("tap")) { const s = T.renderSfx("tap", { variant: v, seed: 1 }, SR), w = join(dir, `_${v}.wav`); writeWav(w, s.L, s.R); mp3(w, `kit-${v}.mp3`); rmSync(w, { force: true }); kitRows.push([`kit-${v}.mp3`, `tap:${v}`, T.sfxInfo("tap").use]); }
      const at = num(o.at, "at") ?? 20, len = num(o.len, "len") ?? 10;
      mp3(resolve(o.mix), "mix-sample.mp3", ["-ss", String(at), "-t", String(len)]);
      const takes = String(o.takes ?? "").split(",").filter(Boolean).map((t, i) => { mp3(resolve(t), `take-${i + 1}.mp3`); return [`take-${i + 1}.mp3`, basename(t), ""]; });
      writeFileSync(join(dir, "index.html"), listenPage("Sound check by ear", [["The effects, alone", kitRows], [`The mix, ${len} s from ${at} s`, [["mix-sample.mp3", "mix sample", basename(o.mix)]]], ...(takes.length ? [["The takes", takes]] : [])]));
      console.log(`wrote ${join(dir, "index.html")}: ${kitRows.length} effects, a ${len} s mix sample${takes.length ? `, ${takes.length} takes` : ""}. Open it and listen before rendering the full mix.`);
    } else die("commands: analyze, cut, import, prompt, kit, mix, master, check, listen (see the header of tools/track.mjs)");
  } catch (e) { die(e.message, 2); }
}
