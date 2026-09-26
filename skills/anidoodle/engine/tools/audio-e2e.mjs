#!/usr/bin/env node
// Render and inspect the two short scored films at the film level, not only the music stems.
import { build } from "esbuild";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { writeWavFloat, decode } from "./music.mjs";
const src = join(import.meta.dirname, "../src/canvas-core/music/index.ts");
const js = (await build({ entryPoints: [src], bundle: true, write: false, platform: "neutral", format: "esm" })).outputFiles[0].text;
const M = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const sr = 48000, fps = 30, frames = 240, dir = process.argv[2] || ".tmp/audio-e2e";
mkdirSync(dir, { recursive: true });
const sceneSrc = join(import.meta.dirname, "../src/canvas-core/audioShowcase.ts");
const sceneJs = (await build({ entryPoints: [sceneSrc], bundle: true, write: false, platform: "neutral", format: "esm" })).outputFiles[0].text;
const S = await import("data:text/javascript;base64," + Buffer.from(sceneJs).toString("base64"));
const presets = [
  { name: "colorArrives", film: S.colorArrives, piece: M.synthPopHouse(), plan: S.showcaseSound("color") },
  { name: "inkTakesShape", film: S.inkTakesShape, piece: M.brokenBeat(), plan: S.showcaseSound("ink") },
];
for (const { name, film, piece, plan } of presets) {
  const cues = plan.cues;
  assert.equal(plan.frames, frames);
  assert.equal(plan.fps, fps);
  const a = M.renderFilmMix(piece, plan, sr), b = M.renderFilmMix(piece, plan, sr);
  assert.equal(a.L.length, M.frameSample(frames, fps, sr));
  const actual = film.audio(sr);
  for (let i = 0; i < a.L.length; i++) { assert.equal(actual[0][i], a.L[i], `${name} film audio L drift`); assert.equal(actual[1][i], a.R[i], `${name} film audio R drift`); }
  for (let i = 0; i < a.L.length; i++) { assert.equal(a.L[i], b.L[i], `L nondeterministic at ${i}`); assert.equal(a.R[i], b.R[i], `R nondeterministic at ${i}`); }
  assert(a.dbtp <= -1, `${name}: true peak ${a.dbtp}`);
  assert(a.lufs > -20 && a.lufs < -12.5, `${name}: integrated ${a.lufs}`);
  for (const cue of cues) {
    const bus = (cue.kind === "riser" || cue.kind === "whoosh") ? a.stems.transition : a.stems.foley;
    const from = M.frameSample(M.cueStart(cue, fps), fps, sr), target = M.frameSample(cue.frame, fps, sr);
    assert.equal(target, Math.round(cue.frame * sr / fps));
    if (cue.kind === "riser" || cue.kind === "whoosh") assert(from < target, "pre-roll before target");
    const span = cue.kind === "riser" || cue.kind === "whoosh" ? [Math.max(0, from), target] : [target, Math.min(target + sr / 20, bus[0].length)];
    let peak = 0; for (let i = span[0]; i < span[1]; i++) peak = Math.max(peak, Math.abs(bus[0][i]), Math.abs(bus[1][i]));
    assert(peak > 0.0005, `${name} ${cue.kind}@${cue.frame} silent (${peak})`);
    // Inspect each onset in an isolated cue render; simultaneous pre-rolls must not mask mistakes.
    const solo = M.renderSound({ fps, frames, cues: [cue] }, sr);
    const channel = cue.kind === "riser" || cue.kind === "whoosh" ? solo.transition[0] : solo.foley[0];
    if (cue.kind !== "riser" && cue.kind !== "whoosh") assert.equal(channel[target - 1], 0, `${cue.kind}@${cue.frame} starts early`);
    else if (from > 0) assert.equal(channel[from - 1], 0, `${cue.kind}@${cue.frame} pre-roll starts early`);
  }
  let largest = 0; for (let i = 1; i < a.L.length; i++) largest = Math.max(largest, Math.abs(a.L[i] - a.L[i - 1]), Math.abs(a.R[i] - a.R[i - 1]));
  assert(largest < 0.6, `${name}: abrupt sample-to-sample jump ${largest}`);
  assert(Math.abs(a.L.at(-1)) < 0.002 && Math.abs(a.R.at(-1)) < 0.002, `${name}: tail click`);
  const wav = join(dir, `${name}.wav`); writeWavFloat(wav, a.L, a.R, sr);
  const decoded = decode(wav), lu = M.loudness(decoded, sr).integrated, tp = M.truePeak(decoded).dbtp;
  assert(Math.abs(lu - a.lufs) < 0.1 && Math.abs(tp - a.dbtp) < 0.1, "WAV meter disagreement");
  const mp4 = join(dir, `${name}.mp4`);
  if (existsSync(mp4)) {
    const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", mp4]));
    assert(info.streams.some((x) => x.codec_type === "video" && +x.nb_frames === frames), "video frame count");
    assert(info.streams.some((x) => x.codec_type === "audio"), "missing audio stream");
    const compressed = decode(mp4), cl = M.loudness(compressed, sr).integrated, cp = M.truePeak(compressed).dbtp;
    assert(Math.abs(cl - a.lufs) < 0.7, `${name}: MP4 audio not matched to this mix (${cl} vs ${a.lufs})`);
    assert(cp <= -0.8, `${name}: AAC peak ${cp}`);
    console.log(`${name}: decoded MP4 ${cl.toFixed(2)} LUFS, ${cp.toFixed(2)} dBTP`);
  }
  console.log(`${name}: deterministic ${a.L.length} samples; cues ${cues.length}; ${a.lufs.toFixed(2)} LUFS, ${a.dbtp.toFixed(2)} dBTP, jump ${largest.toFixed(3)}`);
}
