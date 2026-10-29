// Placing the kit in a film: cues addressed by FILM FRAME, optionally snapped to the beat, the score
// ducked under the cues that matter, one final master (a look-ahead true-peak ceiling), and an
// audibility guarantee: every cue is measured against the ducked score at its own moment and the
// mix FAILS if a cue sits more than minDb under it (a cue nobody hears is a bug, not a choice).
import { renderSfx, validateSfx, sfxNeeds, sfxDuckDb, SFX, SFX_KINDS, type SfxKind, type SfxOpts, type SfxSound } from "./sfxKit";
import { kWeight, winLufs, mixSeed, strSeed, secs, type SfxStereo } from "./sfxCore";
import { Biquad, db } from "./dsp";
import { MODES } from "./theory";
import type { Piece } from "./plan";
import { loudness, truePeak } from "./meter";
import { deliver, layBed, type Delivered, type MasterMode } from "./delivery";

export type SfxSnap = "none" | "bar" | "beat" | "8th" | "16th";
export type SfxHarshOptions = { mode?: "report" | "throw" | "tame"; maxLiftDb?: number; maxTiltDb?: number; maxPeakDb?: number };
export type SfxCue = SfxOpts & {
  /** the whole frame the sound's sync point lands on (the hit; the pass-by of a whoosh; the END of a riser). A fractional frame throws. */
  frame: number; kind: SfxKind; label?: string;
  /** snap the sync point to the beat grid (needs plan.bpm). Default: plan.snap ?? "none". */
  snap?: SfxSnap;
  /** how far the score dips under this cue (dB); default = the kind's own (impact 6, tick 0...). */
  duckDb?: number;
  /** audibility floor for this cue (dB vs the score); default plan.minDb ?? -6. */
  minDb?: number;
  /** Overrides plan.harsh field by field (including mode). */
  harsh?: SfxHarshOptions;
};
export type SfxPlan = {
  fps: number; frames: number; cues: SfxCue[];
  /** seeds every cue that has no seed of its own; per-cue seeds depend on (kind, frame), not on list order. */
  seed?: number;
  /** tempo grid: bpm, the time of beat 1 in seconds (beatZeroS), beats per bar. */
  bpm?: number; beatZeroS?: number; beatsPerBar?: number; snap?: SfxSnap;
  /** key for the tuned kinds ("C", "Eb", "Am"). No default: set it, or pass `score`. */
  key?: string;
  /** the film's score: key (first section), bpm (tempo, or the fitted tempo) and beats per bar come from it unless set above. */
  score?: { piece: Piece; tempo?: number };
  duck?: { attackS?: number; releaseS?: number; maxDb?: number };
  /** audibility floor in dB (cue loudness minus score loudness over the cue's window). Default -6. */
  minDb?: number;
  /** final true-peak ceiling in dBTP. Default -1. */
  ceilingDb?: number;
  /** the whole mix's loudness target (delivery.ts): "gentle" -16 LUFS (default), "dense" -14, a number, or "none" for the old peak-only ceiling */
  master?: MasterMode;
  /** an effects-only mix (no score) sits on quiet room tone this many dB under its cues, so it never drops to silence between them. Default 22; false for none. */
  bed?: number | false;
  /** Default report: samples stay frozen. Caps are cue-minus-score band RMS, band-minus-full RMS,
   * and absolute sample peak dBFS. Tame scales cues only, never the score or duck envelope. */
  harsh?: SfxHarshOptions;
};
export type PlacedCue = { i: number; cue: SfxCue; sound: SfxSound; hitS: number; snappedFromS: number; start: number; window: [number, number] };
export type SfxAudibility = { i: number; kind: SfxKind; variant: string; label: string; atS: number; cueLufs: number; musicLufs: number; marginDb: number; peakMarginDb: number; minDb: number; ok: boolean };
export type SfxHarshness = {
  i: number; kind: SfxKind; variant: string; label: string; atS: number;
  cueBandDb: number; musicBandDb: number; liftDb: number | null; cueRmsDb: number; tiltDb: number;
  peakDb: number; musicPeakDb: number; peakMarginDb: number | null; peakAtS: number; bodyDb: number; crestDb: number;
  mode: "report" | "throw" | "tame"; maxLiftDb: number; maxTiltDb: number; maxPeakDb: number;
  violations: { metric: "liftDb" | "tiltDb" | "peakDb"; valueDb: number; capDb: number; excessDb: number }[];
  ok: boolean; reductionDb: number; conflict: "audibility floor" | "tilt cannot be fixed by gain" | null;
};
export type SfxMix = { L: Float32Array; R: Float32Array; sfx: SfxStereo; music: SfxStereo; duck: Float32Array; placed: PlacedCue[]; audibility: SfxAudibility[]; harshness: SfxHarshness[]; ok: boolean; lufs: number; dbtp: number; limiterDb: number; delivered?: Delivered };

// test/sfxKitSurvey.ts: all 44 variants, default gain/seed 1, C/90 bpm, 48 kHz, silence and
// a steady mid-level score. Maxima 16.49 / -0.80 / -1.00; margins 1.01 / 0.55 / 0.50 dB.
export const SFX_HARSH_CAPS = Object.freeze({ maxLiftDb: 17.5, maxTiltDb: -0.25, maxPeakDb: -0.5 });

const GRID: Record<Exclude<SfxSnap, "none">, number> = { bar: 0, beat: 1, "8th": 0.5, "16th": 0.25 };
const name = (c: SfxCue, i: number) => `cue #${i} (${c.kind}${c.variant ? ":" + c.variant : ""}${c.label ? ` "${c.label}"` : ""} @ frame ${c.frame})`;
const validateHarsh = (o: SfxHarshOptions | undefined, where: string) => {
  if (o === undefined) return;
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error(`sfx plan: ${where}: harsh must be an options object`);
  if (o.mode !== undefined && !["report", "throw", "tame"].includes(o.mode)) throw new Error(`sfx plan: ${where}: harsh.mode must be report|throw|tame`);
  for (const key of ["maxLiftDb", "maxTiltDb", "maxPeakDb"] as const) if (o[key] !== undefined && !Number.isFinite(o[key])) throw new Error(`sfx plan: ${where}: harsh.${key} must be a finite number`);
};

/** A plan with key / bpm / beatsPerBar filled in from its score (explicit plan values win). */
export const resolveSfxPlan = (p: SfxPlan): SfxPlan => {
  if (!p.score) return p;
  const pl = p.score.piece?.plan, sec = pl?.sections?.[0];
  if (!pl || !sec) throw new Error("sfx plan: score.piece has no plan/sections to take the key and tempo from");
  const minor = (MODES[sec.mode]?.intervals ?? []).includes(3);
  return { ...p, key: p.key ?? `${sec.key}${minor ? "m" : ""}`, bpm: p.bpm ?? p.score.tempo ?? pl.tempo, beatsPerBar: p.beatsPerBar ?? Number(String(pl.meter).split("/")[0]) };
};

export const validateSfxPlan = (plan: SfxPlan) => {
  const p = resolveSfxPlan(plan);
  if (!Number.isSafeInteger(p.fps) || p.fps <= 0) throw new Error(`sfx plan: fps must be a positive integer, got ${String(p.fps)}`);
  if (!Number.isSafeInteger(p.frames) || p.frames <= 0) throw new Error(`sfx plan: frames must be a positive integer, got ${String(p.frames)}`);
  if (p.seed !== undefined && (!Number.isSafeInteger(p.seed) || p.seed < 0 || p.seed > 0xffffffff)) throw new Error(`sfx plan: seed must be an integer 0..4294967295, got ${String(p.seed)}`);
  if (p.bpm !== undefined && (!Number.isFinite(p.bpm) || p.bpm < 20 || p.bpm > 300)) throw new Error(`sfx plan: bpm must be 20..300, got ${String(p.bpm)}`);
  if (p.minDb !== undefined && !Number.isFinite(p.minDb)) throw new Error("sfx plan: minDb must be a finite number");
  validateHarsh(p.harsh, "plan");
  if (!Array.isArray(p.cues)) throw new Error("sfx plan: cues must be an array");
  p.cues.forEach((c, i) => {
    if (!c || typeof c !== "object") throw new Error(`sfx plan: cue #${i} is not an object`);
    if (!(c.kind in SFX)) throw new Error(`sfx plan: cue #${i} has unknown kind "${String(c.kind)}" (kinds: ${SFX_KINDS.join(", ")})`);
    if (typeof c.frame !== "number" || !Number.isFinite(c.frame) || c.frame < 0 || c.frame >= p.frames) throw new Error(`sfx plan: ${name(c, i)}: frame must be 0..${p.frames - 1}`);
    if (!Number.isInteger(c.frame)) throw new Error(`sfx plan: ${name(c, i)}: frame must be a whole frame (cues are addressed by the frame the picture shows; for a hit between frames, snap it to the beat grid)`);
    const snap = c.snap ?? p.snap ?? "none";
    if (!(snap === "none" || snap in GRID)) throw new Error(`sfx plan: ${name(c, i)}: snap must be none|bar|beat|8th|16th`);
    if ((snap !== "none" || c.beats !== undefined) && p.bpm === undefined && c.bpm === undefined) throw new Error(`sfx plan: ${name(c, i)}: snap/beats need a bpm (plan.bpm)`);
    if (c.duckDb !== undefined && (!Number.isFinite(c.duckDb) || c.duckDb < 0 || c.duckDb > 18)) throw new Error(`sfx plan: ${name(c, i)}: duckDb must be 0..18`);
    validateHarsh(c.harsh, name(c, i));
    try { validateSfx(c.kind, optsOf(p, c, 0)); } catch (e) { throw new Error(`sfx plan: ${name(c, i)}: ${(e as Error).message}`); }
    const o = optsOf(p, c, 0), need = sfxNeeds(c.kind, c.variant ?? SFX[c.kind].variants[0], o);
    if (need.key && o.key === undefined) throw new Error(`sfx plan: ${name(c, i)} is tuned: set plan.key, cue.key, or plan.score (the film's piece); there is no default key`);
    if (need.bpm && o.bpm === undefined) throw new Error(`sfx plan: ${name(c, i)} is tempo-synced: set plan.bpm, cue.bpm, or plan.score (the film's piece); there is no default tempo`);
  });
};
const optsOf = (p: SfxPlan, c: SfxCue, seed: number): SfxOpts => ({ seed: c.seed ?? seed, variant: c.variant, pitch: c.pitch, lengthS: c.lengthS, beats: c.beats, bpm: c.bpm ?? p.bpm, key: c.key ?? p.key, dir: c.dir, gainDb: c.gainDb });

/** Render and place every cue. Throws if a cue's pre-roll (whoosh approach, riser build) would start before 0. */
export const placeSfx = (plan: SfxPlan, sr: number): PlacedCue[] => {
  validateSfxPlan(plan);
  const p = resolveSfxPlan(plan);
  const seen = new Map<string, number>(), filmS = p.frames / p.fps;
  return p.cues.map((cue, i) => {
    const k = `${cue.kind}@${cue.frame}`, occ = seen.get(k) ?? 0; seen.set(k, occ + 1);
    const seed = mixSeed(p.seed ?? 0, (strSeed(cue.kind) ^ Math.round(cue.frame * 1000) ^ (occ * 7919)) >>> 0);
    const t0 = cue.frame / p.fps, snap = cue.snap ?? p.snap ?? "none";
    let hitS = t0;
    if (snap !== "none") {
      const bpm = cue.bpm ?? p.bpm!, beat = 60 / bpm, g = snap === "bar" ? beat * (p.beatsPerBar ?? 4) : beat * GRID[snap], z = p.beatZeroS ?? 0;
      hitS = z + Math.round((t0 - z) / g) * g;
      if (hitS >= filmS) hitS -= g;
      if (hitS < 0) hitS += g;
    }
    const sound = renderSfx(cue.kind, optsOf(p, cue, seed), sr), start = Math.round(hitS * sr) - sound.hit;
    if (start < 0) {
      const pre = sound.hit / sr, need = Math.ceil(pre * p.fps);
      throw new Error(`sfx plan: ${name(cue, i)}: its ${pre.toFixed(2)} s pre-roll starts before frame 0; move it to frame >= ${need} or shorten it (lengthS/beats)`);
    }
    return { i, cue, sound, hitS, snappedFromS: t0, start, window: [start + sound.window[0], start + sound.window[1]] as [number, number] };
  });
};

/** The score's gain under the cues: raised-cosine dip before each cue's window, held, released. */
export const sfxDuck = (placed: PlacedCue[], n: number, sr: number, o: SfxPlan["duck"] = {}) => {
  const g = new Float32Array(n).fill(1), att = secs(sr, o.attackS ?? 0.04), maxDb = o.maxDb ?? 9;
  for (const pc of placed) {
    const depth = Math.min(maxDb, pc.cue.duckDb ?? sfxDuckDb(pc.cue.kind, pc.sound.variant)); if (depth <= 0) continue;
    const rel = secs(sr, pc.cue.kind === "impact" ? 1.2 : o.releaseS ?? 0.28), lo = db(-depth), [a, b] = pc.window;
    for (let i = Math.max(0, a - att); i < Math.min(n, b + rel); i++) {
      const s = i < a ? 0.5 - 0.5 * Math.cos((Math.PI * (i - (a - att))) / att) : i < b ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (i - b)) / rel);
      const v = 1 - (1 - lo) * s; if (v < g[i]) g[i] = v;
    }
  }
  return g;
};

/** Look-ahead true-peak ceiling (2 ms look-ahead, 80 ms release, 1.12 inter-sample margin). Returns the deepest gain reduction in dB. */
const ceiling = (L: Float32Array, R: Float32Array, sr: number, ceil: number) => {
  const n = L.length, la = secs(sr, 0.002), rel = Math.exp(-1 / (0.08 * sr)), need = new Float32Array(n), g = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])) * 1.12; need[i] = a > ceil ? ceil / a : 1; }
  // running minimum over the look-ahead window, then a smooth ramp INTO each reduction
  for (let i = n - 1; i >= 0; i--) { let m = 1; for (let j = i; j < Math.min(n, i + la); j++) if (need[j] < m) m = need[j]; g[i] = m; }
  let cur = 1, deepest = 1;
  for (let i = 0; i < n; i++) { cur = g[i] < cur ? g[i] : 1 - (1 - cur) * rel; if (cur > g[i]) cur = g[i]; L[i] *= cur; R[i] *= cur; if (cur < deepest) deepest = cur; }
  return 20 * Math.log10(deepest);
};

/** Audibility of each placed cue vs the (ducked) score over the cue's speaking window (the score's window is at least 100 ms). */
export const sfxAudibility = (placed: PlacedCue[], music: SfxStereo, sr: number, p: Pick<SfxPlan, "minDb">): SfxAudibility[] => {
  const mL = kWeight(music[0], sr), mR = kWeight(music[1], sr), minWin = secs(sr, 0.1);
  return placed.map((pc) => {
    const s = pc.sound, kL = kWeight(s.L, sr), kR = kWeight(s.R, sr), [wa, wb] = s.window, cueLufs = winLufs(kL, kR, wa, wb);
    let [a, b] = pc.window; if (b - a < minWin) { const c = (a + b) >> 1; a = c - (minWin >> 1); b = a + minWin; }
    const musicLufs = winLufs(mL, mR, a, b);
    let cp = 0, mp = 0; for (let i = wa; i < wb; i++) cp = Math.max(cp, Math.abs(s.L[i]), Math.abs(s.R[i]));
    for (let i = Math.max(0, a); i < Math.min(music[0].length, b); i++) mp = Math.max(mp, Math.abs(music[0][i]), Math.abs(music[1][i]));
    const silent = musicLufs < -70, marginDb = silent ? 99 : cueLufs - musicLufs, peakMarginDb = mp < 1e-6 ? 99 : 20 * Math.log10(cp / mp);
    const minDb = pc.cue.minDb ?? p.minDb ?? -6;
    return { i: pc.i, kind: pc.cue.kind, variant: s.variant, label: pc.cue.label ?? "", atS: pc.hitS, cueLufs, musicLufs, marginDb, peakMarginDb, minDb, ok: marginDb >= minDb };
  });
};

// Measurement only: RBJ 2nd-order Butterworth HP at 2 kHz then LP at 8 kHz, zero state,
// Float64 throughout, run from buffer start (not reset at the speaking window). No K weighting.
const presence = (x: Float32Array, sr: number) => {
  const hp = Biquad.make(sr, "hp", 2000, Math.SQRT1_2), lp = Biquad.make(sr, "lp", 8000, Math.SQRT1_2), out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = lp.tick(hp.tick(x[i]));
  return out;
};
// Stereo mean power: a duplicated mono sine has its ordinary RMS dBFS, not +3 dB.
// A body window is always the full 150 ms; a short tail contributes zero after its end.
const rmsDb = (L: ArrayLike<number>, R: ArrayLike<number>, a: number, b: number, pad = false) => {
  const lo = Math.max(0, a), hi = Math.min(L.length, b); let e = 0;
  for (let i = lo; i < hi; i++) e += L[i] * L[i] + R[i] * R[i];
  return 10 * Math.log10(Math.max(e / (2 * Math.max(1, pad ? b - a : hi - lo)), 1e-20));
};
const peakOf = (L: Float32Array, R: Float32Array, a: number, b: number) => {
  let peak = 0, at = Math.max(0, a);
  for (let i = Math.max(0, a); i < Math.min(L.length, b); i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (v > peak) { peak = v; at = i; } }
  return { db: 20 * Math.log10(Math.max(peak, 1e-12)), at };
};

/** Pre-master cue harshness vs the ducked score. Score windows match sfxAudibility's 100 ms
 * minimum. Silence-relative measurements are null below -70 dBFS; levels have a -200 dB RMS /
 * -240 dB peak numeric floor. The body starts one sample AFTER the first largest window peak. */
export const sfxHarshness = (placed: PlacedCue[], music: SfxStereo, sr: number, p: Pick<SfxPlan, "minDb" | "harsh">): SfxHarshness[] => {
  if (!placed.length) return [];
  const mL = presence(music[0], sr), mR = presence(music[1], sr), minWin = secs(sr, 0.1);
  return placed.map((pc) => {
    const s = pc.sound, [wa, wb] = s.window, cueBandDb = rmsDb(presence(s.L, sr), presence(s.R, sr), wa, wb), cueRmsDb = rmsDb(s.L, s.R, wa, wb);
    let [a, b] = pc.window; if (b - a < minWin) { const c = (a + b) >> 1; a = c - (minWin >> 1); b = a + minWin; }
    const musicBandDb = rmsDb(mL, mR, a, b), peak = peakOf(s.L, s.R, wa, wb), musicPeakDb = peakOf(music[0], music[1], a, b).db;
    const bodyDb = rmsDb(s.L, s.R, peak.at + 1, peak.at + 1 + secs(sr, 0.15), true);
    const o = pc.cue.harsh, mode = o?.mode ?? p.harsh?.mode ?? "report", maxLiftDb = o?.maxLiftDb ?? p.harsh?.maxLiftDb ?? SFX_HARSH_CAPS.maxLiftDb,
      maxTiltDb = o?.maxTiltDb ?? p.harsh?.maxTiltDb ?? SFX_HARSH_CAPS.maxTiltDb, maxPeakDb = o?.maxPeakDb ?? p.harsh?.maxPeakDb ?? SFX_HARSH_CAPS.maxPeakDb;
    const liftDb = musicBandDb < -70 ? null : cueBandDb - musicBandDb, tiltDb = cueBandDb - cueRmsDb, violations: SfxHarshness["violations"] = [];
    for (const [metric, valueDb, capDb] of [["liftDb", liftDb, maxLiftDb], ["tiltDb", tiltDb, maxTiltDb], ["peakDb", peak.db, maxPeakDb]] as const)
      if (valueDb !== null && valueDb > capDb) violations.push({ metric, valueDb, capDb, excessDb: valueDb - capDb });
    return { i: pc.i, kind: pc.cue.kind, variant: s.variant, label: pc.cue.label ?? "", atS: pc.hitS,
      cueBandDb, musicBandDb, liftDb, cueRmsDb, tiltDb,
      peakDb: peak.db, musicPeakDb, peakMarginDb: musicPeakDb < -70 ? null : peak.db - musicPeakDb, peakAtS: (pc.start + peak.at) / sr, bodyDb, crestDb: peak.db - bodyDb,
      mode, maxLiftDb, maxTiltDb, maxPeakDb, violations, ok: !violations.length, reductionDb: 0, conflict: null };
  });
};

/**
 * The whole film's sound: score (any length; padded or cut to the film) ducked under the cues,
 * effects added, one true-peak ceiling. `music` null = effects only. Does not throw on an inaudible
 * cue: read `ok` / `audibility`, or call assertSfxAudible (filmSfx does).
 */
export const mixSfx = (music: SfxStereo | null, p: SfxPlan, sr = 48000): SfxMix => {
  const n = Math.round((p.frames / p.fps) * sr), placed = placeSfx(p, sr);
  const duck = sfxDuck(placed, n, sr, p.duck), mL = new Float32Array(n), mR = new Float32Array(n);
  if (music) { const m = Math.min(n, music[0].length); for (let i = 0; i < m; i++) { mL[i] = music[0][i] * duck[i]; mR[i] = music[1][i] * duck[i]; } }
  let harshness = sfxHarshness(placed, [mL, mR], sr, p);
  const changes = new Map<number, { reductionDb: number; conflict: SfxHarshness["conflict"] }>();
  if (harshness.some((h) => h.mode === "tame" && !h.ok)) {
    const aud = sfxAudibility(placed, [mL, mR], sr, p);
    for (let i = 0; i < placed.length; i++) {
      const h = harshness[i]; if (h.mode !== "tame" || h.ok) continue;
      // Gain cannot change spectral tilt. Leave this cue untouched, even if another cap broke.
      if (h.violations.some((v) => v.metric === "tiltDb")) { changes.set(h.i, { reductionDb: 0, conflict: "tilt cannot be fixed by gain" }); continue; }
      const a = aud[i], excess = Math.max(...h.violations.map((v) => v.excessDb)), room = a.musicLufs < -70 ? Infinity : Math.max(0, a.marginDb - a.minDb - 1e-5);
      // Float32 scaling can move a measurement by a few ulps: stay just inside both boundaries.
      const down = a.ok ? Math.min(excess + 1e-5, room) : 0, pc = placed[i], g = db(-down);
      if (down > 0) {
        for (let j = 0; j < pc.sound.L.length; j++) { pc.sound.L[j] *= g; pc.sound.R[j] *= g; }
        pc.sound.lufs -= down; pc.cue = { ...pc.cue, gainDb: (pc.cue.gainDb ?? 0) - down };
      }
      changes.set(h.i, { reductionDb: down, conflict: down < excess ? "audibility floor" : null });
    }
    harshness = sfxHarshness(placed, [mL, mR], sr, p).map((h) => ({ ...h, ...changes.get(h.i) }));
  }
  const bad = harshness.filter((h) => h.mode === "throw" && !h.ok);
  if (bad.length) throw new Error(`sfx: ${bad.length} harsh cue(s):\n` + bad.map((h) => `  #${h.i} ${h.kind}:${h.variant}${h.label ? ` "${h.label}"` : ""} @ ${h.atS.toFixed(2)} s: ` + h.violations.map((v) => `${v.metric} ${v.valueDb.toFixed(2)} dB (cap ${v.capDb} dB, excess ${v.excessDb.toFixed(2)} dB)`).join(", ")).join("\n"));
  const fxL = new Float32Array(n), fxR = new Float32Array(n);
  for (const pc of placed) { const { L, R } = pc.sound; for (let i = 0; i < L.length && pc.start + i < n; i++) { fxL[pc.start + i] += L[i]; fxR[pc.start + i] += R[i]; } }
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = mL[i] + fxL[i]; R[i] = mR[i] + fxR[i]; }
  // no score: lay the cues on room tone, set against the cues' own loudness
  if (!music && p.bed !== false && placed.length) layBed(L, R, [fxL, fxR], sr, mixSeed(p.cues.length, p.frames), p.bed ?? 22);
  // the whole mix to its loudness target, then the ceiling; "none" keeps the old peak-only master
  const delivered = (p.master ?? "gentle") === "none" ? undefined : deliver(L, R, sr, p.master ?? "gentle", { ceilingDb: (p.ceilingDb ?? -1) - 0.3 });
  const limiterDb = delivered ? delivered.limitDb : ceiling(L, R, sr, db((p.ceilingDb ?? -1) - 0.3));
  const fade = Math.min(n, secs(sr, 0.015)); for (let i = 0; i < fade; i++) { const g = i / fade; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  const audibility = sfxAudibility(placed, [mL, mR], sr, p);
  const lu = n >= secs(sr, 0.4) ? loudness([L, R], sr).integrated : NaN;
  return { L, R, sfx: [fxL, fxR], music: [mL, mR], duck, placed, audibility, harshness, ok: audibility.every((a) => a.ok), lufs: lu, dbtp: truePeak([L, R]).dbtp, limiterDb, delivered };
};

export const assertSfxAudible = (m: SfxMix) => {
  const bad = m.audibility.filter((a) => !a.ok);
  if (bad.length) throw new Error(`sfx: ${bad.length} cue(s) buried under the score:\n` + bad.map((a) => `  #${a.i} ${a.kind}:${a.variant}${a.label ? ` "${a.label}"` : ""} @ ${a.atS.toFixed(2)} s is ${a.marginDb.toFixed(1)} dB vs the score (floor ${a.minDb} dB): raise its gainDb or its duckDb`).join("\n"));
  return m;
};

/** What a Film's `audio(sampleRate)` returns: score + effects at exactly the film's length. Throws on a buried cue. */
export const filmSfx = (music: ((sr: number) => SfxStereo) | null, p: SfxPlan) => (sr: number): SfxStereo => {
  const m = assertSfxAudible(mixSfx(music ? music(sr) : null, p, sr)); return [m.L, m.R];
};
