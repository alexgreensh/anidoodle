// SOUNDCHECK. Scores a rendered film's soundtrack from the numbers alone: it decodes the mix, measures
// it without any model, checks each value against a range, and lists the changes to make, most
// important first, each tied to a moment in the film.
//   node tools/soundcheck.mjs <film|file.mp4|file.wav> [--profile references/music/sound-profile.json]
//        [--allow 3.1:3.6,...] [--no-video] [--json] [--out f.json] [--sfx stem.wav]
//   --sfx: the effects stem of a film whose music is an external track (track.mjs mix --stem). Every
//   effect in it must be a transient, never a note: a cue with pitch salience over 0.5 FAILS, because a
//   note the engine did not choose clashes with the track's key (a brand launch "disharmonious" note).
//   node tools/soundcheck.mjs profile <files...> -o references/music/sound-profile.json [--name "drawing film"]
// Decodes what a player would (ffmpeg, stereo float at 48 kHz). The metrics are pure functions in
// src/canvas-core/music/soundcheck.ts (unit-tested on synthetic signals); visual sync reuses
// motion.mjs changedArea and is INFO only (not every picture change is meant to be a cue).
// Exit 1 on any FAIL, 2 on bad input.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changedArea } from "./motion.mjs";
import { isMain } from "./is-main.mjs";

const here = dirname(fileURLToPath(import.meta.url)), SR = 48000;
export const loadCheck = async () => {
  const r = await build({ entryPoints: [join(here, "../src/canvas-core/music/soundcheck.ts")], bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022", logLevel: "error" });
  return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
};
/** A film name is out/<name>.mp4, as the other tools read it. */
export const resolveInput = (a) => { const f = resolve(/\.[a-z0-9]{2,4}$/i.test(a) ? a : `out/${a}.mp4`); if (!existsSync(f)) throw new Error(`no such file: ${f}`); return f; };
export const probe = (file) => {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,avg_frame_rate,width,height:format=duration", "-of", "json", file]).toString());
  const v = j.streams.find((s) => s.codec_type === "video" && s.width), a = j.streams.find((s) => s.codec_type === "audio");
  const [n, d] = (v?.avg_frame_rate ?? "0/1").split("/").map(Number);
  return { audio: !!a, video: v ? { width: v.width, height: v.height, fps: d ? n / d : 0 } : null, duration: Number(j.format?.duration) };
};
export const decode = (file) => {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vn", "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", String(SR), "pipe:1"], { maxBuffer: 1 << 30 });
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4), n = f.length / 2, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return [L, R];
};
export const parseAllow = (s) => (s ? String(s).split(",").filter(Boolean).map((p) => { const [a, b] = p.split(":").map(Number); if (!(b > a)) throw new Error(`--allow wants from:to seconds, got '${p}'`); return [a, b]; }) : []);
export const loadProfile = (C, path) => {
  if (!path) return C.DEFAULT_PROFILE;
  const j = JSON.parse(readFileSync(resolve(path), "utf8"));
  return j.metrics ? C.profileFrom(j) : { ...C.DEFAULT_PROFILE, ...j, ranges: { ...C.DEFAULT_PROFILE.ranges, ...(j.ranges ?? {}) } };
};

/** Everything for one file: measures, curves, visual sync (when there is a picture and `video`), rows and the fix list. */
let trackP = null;
const loadPitch = () => (trackP ??= build({ entryPoints: [join(here, "../src/canvas-core/music/track.ts")], bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022", logLevel: "error" }).then((r) => import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"))));
/** One row per effect in an effects stem: its onset, and how much of a note it carries. */
export const pitchedCues = async (stemFile) => { const T = await loadPitch(), [L, R] = decode(stemFile); return T.stemCues(L, R, SR); };
export const pitchRows = (cues, threshold = 0.5) => {
  const bad = cues.filter((c) => c.salience > threshold), worst = [...cues].sort((a, b) => b.salience - a.salience)[0];
  const at = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
  if (!cues.length) return [{ key: "sfxPitch", label: "effects pitch (external track)", value: null, text: "no effects found", status: "FAIL", fix: "the --sfx stem is silent: pass the stem track.mjs mix --stem wrote" }];
  return [{ key: "sfxPitch", label: "effects pitch (external track)", value: worst.salience, text: `${bad.length} of ${cues.length} carry a note`, status: bad.length ? "FAIL" : "PASS", range: { max: threshold }, at: bad[0]?.atS,
    fix: bad.length ? `effects carry notes under a track the engine did not write (${bad.slice(0, 4).map((c) => `${at(c.atS)} ${c.hz} Hz, salience ${c.salience}`).join("; ")}): use the tap kind (sfx.mjs list) or cut strikes under 25 ms (track.mjs kit --from-pack)` : undefined }];
};

export const check = async (C, file, { profile, allow = [], video = "auto", sfx = null } = {}) => {
  const p = probe(file);
  if (!p.audio) throw new Error(`${basename(file)} has no audio stream`);
  const [L, R] = decode(file), prof = profile ?? C.DEFAULT_PROFILE;
  const { measures, curves } = C.analyze(L, R, SR, { allow: [...allow, ...(prof.allow ?? [])] });
  let sync = null;
  if (p.video && video !== false && p.video.fps > 0) {
    const W = 160, H = Math.max(2, Math.round((W * p.video.height) / p.video.width)), changed = await changedArea(file, W, H, 4);
    const events = C.visualEvents(changed, p.video.fps);
    sync = { ...C.visualSync(events, curves.onsets, measures.durationS), times: events, fps: p.video.fps };
  }
  const rows = C.evaluate(measures, prof);
  if (sfx) rows.push(...pitchRows(await pitchedCues(sfx)));
  return { file, profile: prof.name, measures, curves, sync, rows, fixes: C.startHere(rows), video: p.video, L, R };
};

const pad = (s, n) => String(s).padEnd(n);
export const report = (C, r) => {
  const m = r.measures, fails = r.rows.filter((x) => x.status === "FAIL").length, warns = r.rows.filter((x) => x.status === "WARN").length;
  const o = [`SOUNDCHECK  ${r.file}`, `  ${m.durationS.toFixed(2)} s, profile: ${r.profile}`, ""];
  const head = !fails && !warns ? "Sound is within every range." : `${fails} fail, ${warns} warn. ${r.fixes[0] ? `Worst: ${r.fixes[0].fix.split(":")[0]}.` : ""}`;
  o.push(`  ${head}`, "", `  ${pad("status", 7)}${pad("metric", 31)}${pad("value", 24)}range`);
  const graded = r.rows.filter((x) => x.status !== "INFO"), info = r.rows.filter((x) => x.status === "INFO");
  for (const x of [...graded, ...info]) o.push(`  ${pad(x.status, 7)}${pad(x.label, 31)}${pad(x.text, 24)}${C.rangeText(x.range)}`);
  if (r.sync) {
    const s = r.sync, pct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)} %` : "n/a");
    o.push(`  ${pad("INFO", 7)}${pad("visual events with an onset", 31)}${pad(`${pct(s.share)} of ${s.events}`, 24)}chance ${pct(s.chance)}`);
    o.push(`  ${pad("INFO", 7)}${pad("median onset offset", 31)}${pad(Number.isFinite(s.medianOffsetMs) ? `${s.medianOffsetMs > 0 ? "+" : ""}${s.medianOffsetMs} ms` : "n/a", 24)}a sound may lead its frame a little; a lag reads as late`);
    if (s.unanswered.length) o.push(`  ${pad("INFO", 7)}${pad("events with no sound", 31)}${s.unanswered.slice(0, 8).map(C.fmtT).join(", ")}${s.unanswered.length > 8 ? ` (+${s.unanswered.length - 8})` : ""}`);
  }
  o.push("", r.fixes.length ? "START HERE" : "START HERE: nothing to fix");
  r.fixes.forEach((x, i) => o.push(`  ${i + 1}. [${x.status}] ${x.fix}`));
  o.push("", "DETAIL", `  arc (LU vs integrated, 0..100 %): ${m.arc.map((v) => (v === null ? "silent" : (v > 0 ? "+" : "") + v.toFixed(1))).join("  ")}`);
  o.push(`  bands (dB share): ${Object.entries(m.bands).map(([k, v]) => `${k} ${v.toFixed(1)}`).join("  ")}`);
  o.push(`  band correlation: ${Object.entries(m.bandCorr).map(([k, v]) => `${k} ${Number.isFinite(v) ? v.toFixed(2) : "n/a"}`).join("  ")}   150-2k ${Number.isFinite(m.bodyCorr) ? m.bodyCorr.toFixed(2) : "n/a"}`);
  o.push(`  mono fold: -${m.monoDrop.toFixed(1)} dB (3.0 expected)   sample peak ${m.samplePeak.toFixed(1)} dBFS`);
  const holes = m.gaps.filter((g) => g.len >= 0.1); if (holes.length) o.push(`  holes: ${holes.map((g) => `${C.fmtT(g.at)} ${g.len.toFixed(2)} s${g.allowed ? " (allowed)" : ""}`).join(", ")}`);
  o.push("", `VERDICT: ${fails ? "FAIL" : warns ? "PASS with warnings" : "PASS"}`);
  return o.join("\n");
};
/** The JSON form: no sample buffers, curves trimmed to what a reader can use. */
export const asJson = (r) => ({ file: r.file, profile: r.profile, verdict: r.rows.some((x) => x.status === "FAIL") ? "FAIL" : "PASS", measures: r.measures, sync: r.sync, rows: r.rows, fixes: r.fixes.map((x) => ({ key: x.key, status: x.status, fix: x.fix, at: x.at })), onsets: r.curves.onsets.map((t) => +t.toFixed(3)), accents: r.curves.accents });

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), flag = (k) => argv.includes(`--${k}`), opt = (...ks) => { for (const k of ks) { const i = argv.indexOf(k); if (i >= 0) return argv[i + 1]; } return undefined; };
  const VAL = new Set(["--profile", "--out", "--allow", "-o", "--name", "--sfx"]), pos = argv.filter((a, i) => !a.startsWith("-") && !VAL.has(argv[i - 1]));
  const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
  if (!pos.length) die("usage: node tools/soundcheck.mjs <film|file.mp4|file.wav> [--profile p.json] [--allow a:b] [--no-video] [--json] [--out f.json]\n       node tools/soundcheck.mjs profile <files...> -o references/music/sound-profile.json [--name \"drawing film\"]");
  const C = await loadCheck();
  try {
    if (pos[0] === "profile") {
      const out = opt("-o", "--out"); if (!out || pos.length < 2) die("profile wants films and -o <path.json>");
      const sets = [];
      for (const a of pos.slice(1)) { const f = resolveInput(a), [L, R] = decode(f); sets.push({ file: basename(f), measures: C.analyze(L, R, SR).measures }); console.log(`  measured ${basename(f)}`); }
      const p = C.buildProfile(opt("--name") ?? "picked films", sets);
      mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(resolve(out), JSON.stringify(p, null, 1) + "\n");
      console.log(`profile of ${sets.length} film(s) -> ${out}`); for (const [k, v] of Object.entries(p.metrics)) console.log(`  ${pad(k, 12)} ${v.min} .. ${v.max}   median ${v.median}`);
      process.exit(0);
    }
    const file = resolveInput(pos[0]), r = await check(C, file, { profile: loadProfile(C, opt("--profile")), allow: parseAllow(opt("--allow")), video: flag("no-video") ? false : "auto", sfx: opt("--sfx") ? resolveInput(opt("--sfx")) : null });
    const j = asJson(r);
    if (opt("--out")) { mkdirSync(dirname(resolve(opt("--out"))), { recursive: true }); writeFileSync(resolve(opt("--out")), JSON.stringify(j, null, 1) + "\n"); }
    console.log(flag("json") ? JSON.stringify(j, null, 1) : report(C, r));
    process.exit(j.verdict === "FAIL" ? 1 : 0);
  } catch (e) { die(`soundcheck: ${e.message}`); }
}
