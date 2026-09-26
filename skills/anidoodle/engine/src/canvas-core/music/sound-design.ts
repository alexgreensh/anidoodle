// Deterministic, frame-addressed film sound design. No recordings or runtime assets.
import { Biquad, clamp, db, pan, SVF, TAU } from "./dsp";
import { loudness, truePeak } from "./meter";
import { renderPiece, type RenderOpts } from "./render";
import type { Piece } from "./plan";
import { rng } from "../core";

export type SoundKind = "impact" | "whoosh" | "riser" | "click" | "flutter" | "ink" | "paper";
export type SoundBus = "foley" | "transition" | "ambience";
export type SoundCue = { frame: number; kind: SoundKind; strength?: number; lengthFrames?: number; pan?: number; pitch?: number; seed?: number; bus?: SoundBus };
export type SoundPlan = { fps: number; frames: number; cues: SoundCue[]; ambience?: { level: number; seed?: number }; duckDb?: number; master?: "gentle" | "dense" };
export type Stereo = [Float32Array, Float32Array];
export type FilmMix = { L: Float32Array; R: Float32Array; stems: { music: Stereo; foley: Stereo; transition: Stereo; ambience: Stereo }; lufs: number; dbtp: number; gainDb: number };
const stereo = (n: number): Stereo => [new Float32Array(n), new Float32Array(n)];
export const frameSample = (frame: number, fps: number, sr: number) => Math.round(frame * sr / fps);
export const cueStart = (cue: SoundCue, fps: number) => cue.frame - (cue.kind === "whoosh" || cue.kind === "riser" ? (cue.lengthFrames ?? Math.round(fps * (cue.kind === "riser" ? 1.2 : 0.55))) : 0);
export const validateSoundPlan = (p: SoundPlan) => {
  if (!Number.isSafeInteger(p.fps) || p.fps <= 0 || !Number.isSafeInteger(p.frames) || p.frames <= 0) throw new Error("positive integer fps and frames required");
  if (p.duckDb !== undefined && (!Number.isFinite(p.duckDb) || p.duckDb < 0 || p.duckDb > 18)) throw new Error("duckDb must be 0..18");
  if (p.ambience && (!Number.isFinite(p.ambience.level) || p.ambience.level < 0 || p.ambience.level > 1)) throw new Error("ambience level must be 0..1");
  for (const c of p.cues) {
    if (!Number.isSafeInteger(c.frame) || c.frame < 0 || c.frame >= p.frames) throw new Error("cue frame outside film");
    if (c.lengthFrames !== undefined && (!Number.isSafeInteger(c.lengthFrames) || c.lengthFrames <= 0)) throw new Error("cue length must be positive frames");
    if (c.strength !== undefined && (!Number.isFinite(c.strength) || c.strength < 0 || c.strength > 1)) throw new Error("cue strength must be 0..1");
    if (c.pan !== undefined && (!Number.isFinite(c.pan) || Math.abs(c.pan) > 1)) throw new Error("cue pan must be -1..1");
    if (c.pitch !== undefined && (!Number.isFinite(c.pitch) || c.pitch < 0.5 || c.pitch > 2)) throw new Error("cue pitch must be 0.5..2");
  }
};
/** An exact-length buffer, with pre-roll rendered before the target frame and tails clipped at the film end. */
export const renderSound = (p: SoundPlan, sr: number) => {
  validateSoundPlan(p);
  if (!Number.isSafeInteger(sr) || sr < 8000) throw new Error("invalid sample rate");
  const n = frameSample(p.frames, p.fps, sr), foley = stereo(n), transition = stereo(n), ambience = stereo(n);
  const destinations = { foley, transition, ambience };
  p.cues.forEach((c) => {
    const dest = destinations[c.bus ?? ((c.kind === "whoosh" || c.kind === "riser") ? "transition" : "foley")];
    const start = frameSample(cueStart(c, p.fps), p.fps, sr), target = frameSample(c.frame, p.fps, sr);
    const duration = c.lengthFrames ? frameSample(c.lengthFrames, p.fps, sr) : Math.round((c.kind === "impact" ? 0.42 : c.kind === "paper" ? 0.3 : c.kind === "flutter" ? 0.22 : c.kind === "ink" ? 0.26 : c.kind === "riser" ? 1.2 : c.kind === "whoosh" ? 0.55 : 0.055) * sr);
    const count = (c.kind === "whoosh" || c.kind === "riser") ? Math.max(1, target - start) : Math.max(1, duration);
    // A cue keeps its sound when an unrelated cue is inserted earlier in the timeline.
    const kindSeed = [...c.kind].reduce((h, ch) => Math.imul(h, 31) + ch.charCodeAt(0) | 0, 17);
    const strength = c.strength ?? 0.55, pitch = c.pitch ?? 1, rand = rng((c.seed ?? 0) + c.frame * 7919 + kindSeed);
    const [gl, gr] = pan(c.pan ?? 0), filter = Biquad.make(sr, "hp", c.kind === "impact" ? 35 : 180, 0.7);
    const swept = new SVF(sr, 300, 0.75);
    let phase = 0;
    for (let j = 0; j < count; j++) {
      const i = start + j;
      // Pre-roll can start before the film; generate the *entire* envelope before clipping.
      const t = j / sr, u = j / count, noise = rand() * 2 - 1;
      let raw = 0;
      if (c.kind === "whoosh" || c.kind === "riser") {
        // The swell reaches its peak at the target frame, not after it.
        const curve = Math.pow(u, c.kind === "riser" ? 2.2 : 1.7) * Math.min(1, (1 - u) * count / (sr * 0.012));
        const tone = c.kind === "riser" ? Math.sin(TAU * (140 + 440 * u) * t) * 0.3 : 0;
        if (j % 64 === 0) swept.set(250 + 6500 * u * u, 0.8);
        raw = (swept.tick(noise) * (0.55 + 0.45 * u) + tone) * curve;
      } else if (c.kind === "impact") {
        phase += (55 + 105 * Math.exp(-t / 0.035)) * pitch / sr;
        raw = (Math.sin(TAU * phase) * Math.exp(-t / 0.11) + noise * 0.5 * Math.exp(-t / 0.028)) * Math.min(1, t * 900);
      } else if (c.kind === "click") raw = noise * Math.exp(-t / 0.007);
      else if (c.kind === "flutter") raw = noise * Math.sin(TAU * 43 * t) * Math.exp(-t / 0.065);
      else if (c.kind === "ink") raw = (Math.sin(TAU * (510 - 250 * u) * pitch * t) + noise * 0.28) * Math.exp(-t / 0.045) * Math.min(1, t * 700);
      else raw = noise * Math.exp(-t / 0.07) * (0.6 + 0.4 * Math.sin(TAU * 37 * t));
      if (i < 0 || i >= n) continue;
      const v = filter.tick(raw) * strength * (c.kind === "impact" ? 0.36 : c.kind === "riser" ? 0.18 : 0.23);
      dest[0][i] += v * gl; dest[1][i] += v * gr;
    }
  });
  if (p.ambience && p.ambience.level > 0) {
    const r = rng(p.ambience.seed ?? 0), lp = Biquad.make(sr, "lp", 1400, 0.7);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / (0.2 * sr), (n - i - 1) / (0.2 * sr));
      const v = lp.tick(r() * 2 - 1) * p.ambience.level * 0.04 * Math.max(0, env);
      ambience[0][i] = v * 0.85; ambience[1][i] = v;
    }
  }
  return { foley, transition, ambience };
};
/** Mix the unmastered score with effect stems; master once, after all scene sound exists. */
export const renderFilmMix = (piece: Piece | null, p: SoundPlan, sr: number, musicOptions: RenderOpts = {}): FilmMix => {
  const fx = renderSound(p, sr), n = fx.foley[0].length, music = stereo(n), L = new Float32Array(n), R = new Float32Array(n);
  if (piece) {
    const m = renderPiece(piece, sr, { ...musicOptions, seconds: p.frames / p.fps, master: "none" });
    music[0].set(m.L.subarray(0, n)); music[1].set(m.R.subarray(0, n));
  }
  // A short attack and slower release keep the score out of the way of an effect without pumping.
  let duck = 0, duckTarget = 0;
  const maxDuck = db(-(p.duckDb ?? 3));
  for (let i = 0; i < n; i++) {
    const ev = Math.max(Math.abs(fx.foley[0][i]), Math.abs(fx.foley[1][i]), Math.abs(fx.transition[0][i]), Math.abs(fx.transition[1][i]));
    duckTarget = Math.max(ev > 0.014 ? 1 : 0, duckTarget * Math.exp(-1 / (0.14 * sr)));
    duck += (duckTarget > duck ? 1 / (0.012 * sr) : 1 / (0.19 * sr)) * (duckTarget - duck);
    const g = 1 - duck * (1 - maxDuck);
    L[i] = music[0][i] * g + fx.foley[0][i] + fx.transition[0][i] + fx.ambience[0][i];
    R[i] = music[1][i] * g + fx.foley[1][i] + fx.transition[1][i] + fx.ambience[1][i];
  }
  for (const c of [L, R]) Biquad.make(sr, "hp", 28, 0.7).run(c);
  const current = loudness([L, R], sr).integrated;
  let gainDb = Number.isFinite(current) ? clamp((p.master === "dense" ? -14 : -16) - current, -24, 24) : 0;
  const peak = truePeak([L, R]).dbtp;
  gainDb = Math.min(gainDb, -1.2 - peak);
  const gain = db(gainDb);
  for (let i = 0; i < n; i++) {
    // Fade the final 15ms so a sound cut by picture length never clicks.
    const end = Math.min(1, (n - i - 1) / Math.max(1, sr * 0.015));
    L[i] *= gain * Math.max(0, end); R[i] *= gain * Math.max(0, end);
  }
  return { L, R, stems: { music, ...fx }, lufs: loudness([L, R], sr).integrated, dbtp: truePeak([L, R]).dbtp, gainDb };
};
export const filmSound = (piece: Piece | null, p: SoundPlan) => (sr: number): Stereo => {
  const { L, R } = renderFilmMix(piece, p, sr); return [L, R];
};
