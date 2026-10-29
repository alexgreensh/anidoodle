// NARRATE. A film's narration from a script: takes, word timing, a round-trip check, and a module the
// film imports. Every line is one take, cached by what makes its sound, so re-runs are free and the
// same script gives the same takes.
//
//   node tools/narrate.mjs say   <narration.json>   make every take (cached in .cache/voice/)
//   node tools/narrate.mjs time  <narration.json>   word timings by whisper.cpp, mapped onto the SCRIPT's words -> voice-timing.json
//   node tools/narrate.mjs check <narration.json>   the round trip: transcribe each take with no prompt, compare word by word,
//                                                    alignment and audio sanity, the phrase subtitles; exit 1 on any failure
//   node tools/narrate.mjs bake  <narration.json>   time + write the film module (timing + takes as base64 PCM)
//   node tools/narrate.mjs all   <narration.json>   check, then bake when it passes
//   node tools/narrate.mjs providers                which voices this machine can use
//
//   --out DIR       where voice-only stems and voice-timing.json go (default out/narration/<script name>/)
//   --module FILE   bake's module (default src/canvas-core/<script name>Voice.ts)
//   --model FILE    the whisper.cpp model (default: the best ggml-*.bin in ~/.cache/whisper)
//   --shape S       16x9 (default), 9x16 or 1x1: the subtitle line length check uses it
//   --max-wer X     a take fails past this word error rate from extra words (default 0.03); any dropped
//                   or changed script word always fails
//   --mix FILE      check also: transcribe the finished mix (a .wav or the film's .mp4) and hold the whole script
//                   to the same word-for-word rule, so a score that buries a word fails too
//   --force         make the takes again, ignoring the cache
//
// CLOUD VOICES SEND YOUR TEXT TO THAT COMPANY: gemini (Google), openai (OpenAI), elevenlabs (ElevenLabs).
// A paid voice is only ever called when the script itself names it as its provider; keys are read from
// the environment and never printed. say (macOS), kokoro (local) and files (your own recordings) stay
// on this machine.
import { spawnSync } from "node:child_process";
import { enginePath } from "./overlay.mjs";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { build } from "esbuild";
import { isMain } from "./is-main.mjs";
import { audioProblems, alignmentProblems, mapDisplay, mapTimings, placeLines, roundTrip, scriptProblems, takeKey, whisperWords } from "./narrate/core.mjs";
import * as say from "./narrate/providers/say.mjs";
import * as gemini from "./narrate/providers/gemini.mjs";
import * as openai from "./narrate/providers/openai.mjs";
import * as elevenlabs from "./narrate/providers/elevenlabs.mjs";
import * as kokoro from "./narrate/providers/kokoro.mjs";
import * as files from "./narrate/providers/files.mjs";
import { which } from "./narrate/providers/util.mjs";

export const PROVIDERS = { say, gemini, openai, elevenlabs, kokoro, files };
const SR = 24000, CACHE = resolve(".cache/voice"), POST = "trim45-pad40-80-lufs20-pk3-v1"; // POST names the take processing: change it and every take is made again
const USAGE = "node tools/narrate.mjs say|time|check|bake|all <narration.json> [--out DIR] [--module FILE] [--model FILE] [--shape 16x9|9x16|1x1] [--max-wer 0.03] [--mix out/<film>.mp4] [--force]\n       node tools/narrate.mjs providers";
const die = (m, code = 2) => { console.error(`narrate: ${m}`); process.exit(code); };
const sha = (s) => createHash("sha256").update(s).digest("hex");
const ff = (args) => { const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr.trim()}`); return r; };

// ---------------------------------------------------------------- the script
export const loadScript = (path) => {
  if (!path || !existsSync(path)) die(`no script '${path ?? ""}'\nusage: ${USAGE}`);
  let s; try { s = JSON.parse(readFileSync(path, "utf8")); } catch (e) { die(`${path} is not valid JSON: ${e.message}`); }
  const p = scriptProblems(s);
  if (p.length) die(`${path}:\n  ${p.join("\n  ")}`);
  if (!PROVIDERS[s.provider]) die(`${path}: unknown provider '${s.provider}' (say, gemini, openai, elevenlabs, kokoro, files)`);
  return { ...s, path: resolve(path), dir: dirname(resolve(path)), name: basename(path).replace(/\.json$/, "").replace(/[^A-Za-z0-9_]/g, "_") };
};
const voiceOf = (s, ln) => ({ ...(s.voice ?? {}), ...(ln.voice ?? {}) });

// ---------------------------------------------------------------- takes
// samples of a mono 24 kHz float WAV/any file, decoded by ffmpeg
export const readMono = (file, sr = SR) => { const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(sr), "-"], { maxBuffer: 1 << 30 }); if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${r.stderr}`); return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.byteLength)); };
const pcm16 = (x, gain) => { const b = Buffer.alloc(x.length * 2); for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * gain * 32767))), i * 2); return b; };
const wavOf = (pcm) => { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
// one provider take -> the house take: mono 24 kHz 16-bit, silence trimmed at -45 dB and padded
// (40 ms before, 80 ms after), set to -20 LUFS with its sample peak no higher than -3 dBFS
const finishTake = (raw, out) => {
  const tmp = out + ".trim.wav";
  ff(["-i", raw, "-af", "aformat=channel_layouts=mono,aresample=24000,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=40,apad=pad_dur=0.08", "-ar", String(SR), "-ac", "1", "-c:a", "pcm_f32le", tmp]);
  const r = spawnSync("ffmpeg", ["-v", "info", "-nostats", "-i", tmp, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" });
  const I = Number(((r.stdout + r.stderr).match(/Integrated loudness:\s*\n\s*I:\s*(-?[0-9.]+) LUFS/) ?? [])[1]);
  const x = readMono(tmp); let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
  const gainDb = Math.min(Number.isFinite(I) ? -20 - I : 0, -3 - 20 * Math.log10(Math.max(pk, 1e-9)));
  writeFileSync(out, wavOf(pcm16(x, Math.pow(10, gainDb / 20)))); rmSync(tmp, { force: true });
};

/** Every line's take, from the cache or the provider. Returns [{ line, file, hash, cached }]. */
export const makeTakes = async (s, { force = false, log = console.log } = {}) => {
  // the provider (and its key) is needed only for a take that is not cached yet: checking, timing and
  // baking cached cloud takes never needs the key and never calls the company
  const P = PROVIDERS[s.provider];
  let ready = false;
  const need = () => {
    if (ready) return; ready = true;
    const av = P.available(); if (!av.ok) die(`provider '${s.provider}' is not available here: ${av.why}`);
    if (P.cloud) log(`narrate: ${s.provider} is a cloud voice: each line's text is sent to ${P.about.match(/goes to (\w+)/)?.[1] ?? "its company"}`);
  };
  if (s.provider === "files") need();
  mkdirSync(CACHE, { recursive: true });
  const out = [];
  for (const ln of s.lines) {
    const voice = voiceOf(s, ln);
    // a recording's own bytes are what make its sound: they go in the key instead of the text alone
    const src = s.provider === "files" ? await P.synth({ voice, lineId: ln.id, scriptDir: s.dir }) : null;
    const hash = sha(takeKey({ provider: s.provider, voice, text: ln.text, post: POST }) + (src ? sha(readFileSync(src)) : ""));
    const file = join(CACHE, `${hash}.wav`), cached = existsSync(file) && !force;
    if (!cached) {
      need();
      const raw = join(CACHE, `${hash}.raw`);
      const got = src ?? await P.synth({ text: ln.text, voice, raw, lineId: ln.id, scriptDir: s.dir });
      finishTake(got, file);
      if (!src) for (const f of readdirSync(CACHE)) if (f.startsWith(`${hash}.raw`)) rmSync(join(CACHE, f), { force: true });
      writeFileSync(join(CACHE, `${hash}.json`), JSON.stringify({ provider: s.provider, voice, text: ln.text, post: POST }, null, 1));
    }
    out.push({ line: ln, file, hash, cached });
  }
  return out;
};

// ---------------------------------------------------------------- whisper.cpp
const MODEL_ORDER = ["ggml-small.en.bin", "ggml-medium.en.bin", "ggml-base.en.bin", "ggml-large-v3-turbo.bin", "ggml-large-v3.bin", "ggml-small.bin", "ggml-base.bin", "ggml-tiny.en.bin"];
export const findModel = (flag) => {
  if (flag) { if (!existsSync(flag)) die(`no whisper model at ${flag}`); return resolve(flag); }
  if (process.env.NARRATE_WHISPER_MODEL && existsSync(process.env.NARRATE_WHISPER_MODEL)) return process.env.NARRATE_WHISPER_MODEL;
  const dir = join(homedir(), ".cache/whisper"), have = existsSync(dir) ? readdirSync(dir).filter((f) => /^ggml-.*\.bin$/.test(f) && !f.includes("for-tests")) : [];
  const pick = MODEL_ORDER.find((m) => have.includes(m)) ?? have[0];
  if (!pick) die(`no whisper.cpp model in ${dir}. Get one (MIT, about 148 MB):\n  mkdir -p ~/.cache/whisper && curl -L -o ~/.cache/whisper/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin\n(ggml-small.en.bin, about 488 MB, hears better)`);
  return join(dir, pick);
};
const whisperBin = () => { for (const c of ["whisper-cli", "whisper-cpp"]) { const f = which(c); if (f) return f; } die("whisper.cpp is not installed (brew install whisper-cpp gives whisper-cli)"); };
/** Transcribe a take with NO prompt (the check must hear what was said, not what was meant). Cached by take + model. */
export const transcribe = (file, model, lang = "en") => {
  const key = sha(readFileSync(file).toString("base64") + "\0" + basename(model) + "\0" + lang + "\0ml1-sow"), dir = join(CACHE, "asr"), hit = join(dir, `${key}.json`);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(hit)) {
    const wav16 = join(dir, `${key}.16k.wav`), base = join(dir, key);
    ff(["-i", file, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav16]);
    const r = spawnSync(whisperBin(), ["-m", model, "-f", wav16, "-l", lang, "-ml", "1", "-sow", "-ojf", "-of", base, "-np", "-bs", "5"], { encoding: "utf8", maxBuffer: 1 << 26 });
    rmSync(wav16, { force: true });
    if (r.status !== 0 || !existsSync(base + ".json")) throw new Error(`whisper-cli failed on ${file}: ${(r.stderr || r.stdout).trim().slice(-400)}`);
  }
  return whisperWords(JSON.parse(readFileSync(hit, "utf8")));
};

// ---------------------------------------------------------------- time
const outDir = (s, flag) => resolve(flag ?? join("out/narration", s.name));
export const timeScript = async (s, o = {}) => {
  const takes = await makeTakes(s, o), model = findModel(o.model), per = [];
  for (const t of takes) {
    const x = readMono(t.file), asr = transcribe(t.file, model, s.lang ?? "en"), m = mapTimings(t.line.text, asr, { aliases: s.aliases });
    const words = mapDisplay(t.line.display ?? t.line.text, m.tokens);
    per.push({ ...t, x, asr, mapped: m, take: { durationS: x.length / SR, words } });
  }
  const timing = { ...placeLines(s, per.map((p) => p.take)), provider: s.provider, sampleRate: SR };
  timing.lines.forEach((l, i) => { l.file = relative(process.cwd(), per[i].file); l.hash = per[i].hash; });
  const dir = outDir(s, o.out); mkdirSync(join(dir, "lines"), { recursive: true });
  // voice-only stems next to every mix (lesson 51): one line can be swapped without touching the rest
  for (const p of per) copyFileSync(p.file, join(dir, "lines", `${p.line.id}.wav`));
  writeFileSync(join(dir, "voice-timing.json"), JSON.stringify(timing, null, 1));
  return { timing, per, dir, model };
};

// ---------------------------------------------------------------- check
// the phrase subtitles, built by the film's own module, so the check and the film can never disagree
const loadSubtitles = async () => {
  const js = (await build({ entryPoints: [enginePath("src/canvas-core/subtitles.ts")], bundle: true, format: "esm", write: false, platform: "neutral", logLevel: "error" })).outputFiles[0].text;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
};
const show = (p) => { const r = relative(process.cwd(), p); return r.startsWith("..") ? p : r; };
const pad = (s, n) => String(s).padEnd(n).slice(0, Math.max(n, String(s).length));
export const checkScript = async (s, o = {}) => {
  const { timing, per, model } = await timeScript(s, o), maxWer = Number(o.maxWer ?? 0.03), rows = [];
  for (const [i, p] of per.entries()) {
    const rt = roundTrip(p.line.text, p.asr, { aliases: s.aliases, maxWer }), al = alignmentProblems(p.mapped.tokens), au = audioProblems(p.x, SR, { words: rt.tokens.filter((t) => t.words.length).length });
    rows.push({ id: p.line.id, dur: p.take.durationS, frames: `${timing.lines[i].start}-${timing.lines[i].end}`, wer: rt.wer, heard: rt.heard, problems: [...rt.problems, ...al.map((x) => `ALIGN ${x}`), ...au.problems.map((x) => `AUDIO ${x}`)], peak: au.peakDb });
  }
  const sub = await loadSubtitles(), plan = sub.phrasePlan(timing, { shape: o.shape ?? "16x9" });
  console.log(`NARRATE CHECK   ${show(s.path)}   provider ${s.provider}, ${s.lines.length} line(s), ${timing.totalFrames} frames at ${timing.fps} fps   ASR ${basename(model)} (no prompt)`);
  console.log(`  ${pad("line", 10)} ${pad("frames", 11)} ${pad("dur", 6)} ${pad("WER", 6)} ${pad("peak", 7)} verdict`);
  for (const r of rows) {
    console.log(`  ${pad(r.id, 10)} ${pad(r.frames, 11)} ${pad(r.dur.toFixed(2) + "s", 6)} ${pad((r.wer * 100).toFixed(1) + "%", 6)} ${pad(r.peak.toFixed(1), 7)} ${r.problems.length ? "FAIL" : "PASS"}`);
    for (const pr of r.problems) console.log(`      ${pr}`);
    if (r.problems.length) console.log(`      heard: "${r.heard}"`);
  }
  console.log(`  SUBTITLES  ${plan.events.length} phrase(s) for ${o.shape ?? "16x9"}${plan.problems.length ? "" : ": every phrase lands on its words and holds its reading time"}`);
  for (const pr of plan.problems) console.log(`      ${pr}`);
  // after the mix: the voice must still be heard word for word over the score (research: run the round trip again on the final mix)
  let mixBad = 0;
  if (o.mix) {
    if (!existsSync(o.mix)) die(`--mix: no file ${o.mix}`);
    const all = s.lines.map((l) => l.text).join(" "), mrt = roundTrip(all, transcribe(resolve(o.mix), model, s.lang ?? "en"), { aliases: s.aliases, maxWer });
    mixBad = mrt.problems.length;
    console.log(`  MIX  ${show(resolve(o.mix))}: WER ${(mrt.wer * 100).toFixed(1)} % over the whole script   ${mixBad ? "FAIL" : "PASS"}`);
    for (const pr of mrt.problems) console.log(`      ${pr}`);
    if (mixBad) console.log(`      heard: "${mrt.heard}"`);
  }
  // the film plays the BAKED takes: a module baked from other takes (or another timing) is a stale film
  const mod = resolve(o.module ?? `src/canvas-core/${s.name}Voice.ts`); let stale = false;
  if (existsSync(mod)) {
    stale = bakedStale(readFileSync(mod, "utf8"), timing, !!o.ignoreStale);
    console.log(`  BAKED  ${show(mod)}: ${stale ? "FAIL   baked from other takes or timing: run narrate.mjs bake" : "matches these takes and this timing"}`);
  } else console.log(`  BAKED  ${show(mod)}: not baked yet (narrate.mjs bake writes it)`);
  const bad = rows.filter((r) => r.problems.length).length + (plan.problems.length ? 1 : 0) + (mixBad ? 1 : 0) + (stale ? 1 : 0);
  console.log(bad ? `NARRATE CHECK: FAIL   ${rows.filter((r) => r.problems.length).length} line(s) failed${plan.problems.length ? `, ${plan.problems.length} subtitle problem(s)` : ""}${mixBad ? ", the mix lost words" : ""}${stale ? ", the baked module is stale" : ""}` : `NARRATE CHECK: PASS   ${rows.length}/${rows.length} lines heard word for word, timed and clean`);
  return { ok: !bad, rows, timing, plan };
};

/**
 * Is a baked module out of date for these takes and this timing? It is when its take hashes or its
 * length differ. `all` passes ignoreStale, because re-baking a stale module is the job it exists to do:
 * the parentheses make that cover a changed length too, not only changed takes.
 */
export const bakedStale = (src, timing, ignoreStale = false) => {
  const hashes = [...src.matchAll(/"hash":"([0-9a-f]{64})"/g)].map((m) => m[1]), frames = Number((src.match(/"totalFrames":(\d+)/) ?? [])[1]);
  return !ignoreStale && (hashes.join() !== timing.lines.map((l) => l.hash).join() || frames !== timing.totalFrames);
};

// ---------------------------------------------------------------- bake
export const bakeScript = async (s, o = {}) => {
  const { timing, per } = await timeScript(s, o), mod = resolve(o.module ?? `src/canvas-core/${s.name}Voice.ts`), name = `${s.name}Voice`;
  const pcm = Object.fromEntries(per.map((p) => [p.line.id, readFileSync(p.file).subarray(44).toString("base64")]));
  const t = { ...timing, lines: timing.lines.map(({ file, ...l }) => l) }; // the local take path stays out of the film
  const src = `// GENERATED by tools/narrate.mjs bake from ${relative(dirname(mod), s.path)}: do not edit. Re-run the bake after changing the script.\n` +
    `// The narration's timing (frames at ${timing.fps} fps) and each line's take as 16-bit mono PCM at ${SR} Hz, base64, so the film needs no file and no network.\n` +
    `// Voice: ${s.provider}${s.provider === "say" ? " (macOS system voice: a draft; check its licence before publishing a film made with it)" : ""}.\n` +
    `import type { BakedVoice } from "./voice";\n\nexport const ${name}: BakedVoice = {\n  timing: ${JSON.stringify(t)},\n  sampleRate: ${SR},\n  pcm: {\n${Object.entries(pcm).map(([k, v]) => `    ${JSON.stringify(k)}: "${v}",`).join("\n")}\n  },\n};\n`;
  writeFileSync(mod, src);
  return { mod, bytes: src.length, timing };
};

// ---------------------------------------------------------------- the command line
if (isMain(import.meta.url)) {
  const [cmd, file, ...rest] = process.argv.slice(2), o = {};
  for (let i = 0; i < rest.length; i++) { const a = rest[i]; if (!a.startsWith("--")) die(`unexpected '${a}'\nusage: ${USAGE}`); const k = a.slice(2); if (k === "force") o.force = true; else o[{ "max-wer": "maxWer" }[k] ?? k] = rest[++i]; }
  if (o.shape && !["16x9", "9x16", "1x1"].includes(o.shape)) die(`--shape is 16x9, 9x16 or 1x1, got '${o.shape}'`);
  try {
    if (cmd === "providers") {
      for (const [k, P] of Object.entries(PROVIDERS)) { const a = P.available(); console.log(`  ${pad(k, 11)} ${a.ok ? "ready  " : "missing"} ${P.about}${a.ok ? "" : `: ${a.why}`}`); }
      console.log("Cloud voices send each line's text to that company. A script names its provider; nothing else is ever called.");
    } else if (cmd === "say") {
      const s = loadScript(file), t = await makeTakes(s, o);
      for (const x of t) console.log(`  ${pad(x.line.id, 10)} ${x.cached ? "cached" : "made  "} ${relative(process.cwd(), x.file)}`);
      console.log(`narrate say: ${t.length} take(s), ${t.filter((x) => !x.cached).length} new`);
    } else if (cmd === "time") {
      const s = loadScript(file), r = await timeScript(s, o);
      for (const l of r.timing.lines) console.log(`  ${pad(l.id, 10)} frames ${l.start}-${l.end}   ${l.words.map((w) => `${w.w}@${w.from}${w.est ? "?" : ""}`).join(" ")}`);
      console.log(`narrate time: ${r.timing.totalFrames} frames -> ${relative(process.cwd(), join(r.dir, "voice-timing.json"))}`);
    } else if (cmd === "check" || cmd === "all") {
      const s = loadScript(file), r = await checkScript(s, { ...o, ignoreStale: cmd === "all" });
      if (!r.ok) process.exit(1);
      if (cmd === "all") { const b = await bakeScript(s, o); console.log(`narrate bake: ${relative(process.cwd(), b.mod)} (${(b.bytes / 1024).toFixed(0)} KB)`); }
    } else if (cmd === "bake") {
      const s = loadScript(file), b = await bakeScript(s, o);
      console.log(`narrate bake: ${relative(process.cwd(), b.mod)} (${(b.bytes / 1024).toFixed(0)} KB), ${b.timing.totalFrames} frames. Run check before you ship it.`);
    } else die(`unknown command '${cmd ?? ""}'\nusage: ${USAGE}`);
  } catch (e) { die(e.message, 2); }
}
