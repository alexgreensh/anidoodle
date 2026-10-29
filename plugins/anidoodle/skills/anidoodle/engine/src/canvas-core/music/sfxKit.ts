// anidoodle's sound-effects kit: every sound designed in layers (transient + body + tail), placed
// in stereo, and varied per hit from its seed so a repeated cue never sounds like a loop.
// Levels are set in K-weighted loudness over the sound's own "speaking window" (sfxCore), the
// same yardstick the audibility check uses, so a kind's level means the same thing everywhere.
import { rng as mkRng } from "../core";
import { pcOf } from "./theory";
import { clamp, db, type Rng } from "./dsp";
import { Bus, modal, chirp, burst, white, pink, filt, sweep, shape, ad, smooth, finish, secs, buf, kWeight, winLufs, speakingWindow, type Mode, type SfxStereo } from "./sfxCore";
import { smallRoom } from "./roomSmall";

/**
 * The space every sound sits in: a diffused small room (roomSmall.ts: dense early reflections and a
 * modulated, damped tail that does not ring like the old 8-line FDN). The room's size follows the
 * decay asked for, and every trigger gets its own room seed and +-8 % decay and level, so a repeated
 * cue never has the identical tail.
 */
const space = (b: Bus, r: Rng, o: { rt60: number; mix: number; er?: number; predelay?: number; hp?: number; lp?: number }) => {
  const rt = o.rt60 * (0.92 + 0.16 * r()), mix = o.mix * (0.92 + 0.16 * r()), seed = Math.floor(r() * 0xffffffff);
  const [wL, wR] = smallRoom(b.L, b.R, b.sr, { rt60: rt, size: clamp(0.35 + rt * 0.55, 0.35, 1.8), er: (o.er ?? 0.5) * 1.1, late: 0.75, predelay: o.predelay ?? 0.008, hp: o.hp ?? 250, lp: o.lp ?? 7000, damp: (o.lp ?? 7000) * 0.7, seed });
  for (let i = 0; i < b.n; i++) { b.L[i] += wL[i] * mix; b.R[i] += wR[i] * mix; }
};
/**
 * Transient design (a transient shaper): the ratio of a fast envelope (0.2 ms attack, 6 ms release) to
 * a slow one (7 ms, 70 ms) is large only on the attack, so `amt` > 0 sharpens the contact and leaves
 * the body and tail alone. Linked across channels (the image does not shift). Gain capped at +9 dB.
 */
const punch = (b: Bus, amt: number) => {
  const sr = b.sr, ka = (t: number) => 1 - Math.exp(-1 / (t * sr)), fa = ka(0.0002), fr = ka(0.006), sa = ka(0.007), srl = ka(0.07), sm = ka(0.0008);
  let f = 0, s = 0, g = 1;
  for (let i = 0; i < b.n; i++) {
    const x = Math.max(Math.abs(b.L[i]), Math.abs(b.R[i]));
    f += (x > f ? fa : fr) * (x - f); s += (x > s ? sa : srl) * (x - s);
    const want = s > 1e-9 ? clamp(Math.pow(f / s, amt), 1, 2.8) : 1; g += sm * (want - g);
    b.L[i] *= g; b.R[i] *= g;
  }
};

export type SfxOpts = {
  /** per-hit variation: same seed, same samples; a different seed, a different (but same-family) hit. */
  seed?: number; variant?: string;
  /** transpose in semitones (-24..24). */
  pitch?: number;
  /** length for sustained kinds (scratch, riser, whoosh, paper, thread); riser may use beats instead. */
  lengthS?: number; beats?: number; bpm?: number;
  /** tonal kinds (chime, riser, impact "bloom", press "confirm") are tuned to this key: "C", "Eb", "F#m" (m = minor). */
  key?: string;
  /** direction of travel for moving sounds: +1 left-to-right, -1 right-to-left. */
  dir?: 1 | -1;
  /** extra gain in dB on top of the kind's calibrated level. */
  gainDb?: number;
};
export type SfxSound = { L: Float32Array; R: Float32Array; sr: number; kind: SfxKind; variant: string; seed: number;
  /** sample index of the sync point (the hit, the pass-by, the end of a riser): this lands on the cue frame. */
  hit: number;
  /** [a, b) samples where the sound speaks (used for ducking and the audibility check). */
  window: [number, number]; lufs: number };

type Ctx = { sr: number; r: Rng; P: number; o: SfxOpts; dir: number; key: { pc: number; minor: boolean } | null; bpm: number;
  /** x jittered by +-amt (relative). */ j: (x: number, amt: number) => number };
type Made = { bus: Bus; hit: number };
type Def = { variants: readonly string[]; level: number; duckDb: number; use: string; make: (c: Ctx, v: string) => Made };

const keyHz = (c: Ctx, octave: number, semis = 0) => 440 * Math.pow(2, (c.key!.pc + semis + 12 * (octave + 1) - 69) / 12);
const PENTA = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
/** Glockenspiel-bar partials: a bright tuned strike that sits above a lo-fi mix. */
const glock = (f: number, tau: number, a: number, t0 = 0): Mode[] => [
  { f, tau, a, t0 }, { f: f * 2.756, tau: tau * 0.42, a: a * 0.32, t0 }, { f: f * 5.404, tau: tau * 0.18, a: a * 0.14, t0 }, { f: f * 8.933, tau: tau * 0.09, a: a * 0.06, t0 },
];

// ---------------------------------------------------------------------------------------------
const tick: Def = {
  variants: ["key", "soft", "ui", "space"], level: -20.5, duckDb: 0,
  use: "typing (one per character: key), a laptop key (soft), an interface tick (ui), the space bar (space)",
  make(c, v) {
    const { sr, r, P } = c, n = secs(sr, 0.22), b = new Bus(sr, n), p0 = (r() - 0.5) * 0.5;
    if (v === "ui") {
      const f = c.j(4300, 0.05) * P;
      b.add(modal(sr, n, [{ f, tau: 0.0017, a: 1 }, { f: f * 2.03, tau: 0.0009, a: 0.3 }, { f: f * 0.51, tau: 0.004, a: 0.25 }]), 0, 0.8, p0);
      b.add(burst(sr, r, 0.002, 0.00028, { hp: 5500 }), 0, 0.45, p0);
      space(b, r, { rt60: 0.18, mix: 0.05, hp: 1500 });
      return { bus: b, hit: 0 };
    }
    const soft = v === "soft", spc = v === "space";
    const f1 = c.j(soft ? 1550 : spc ? 1900 : 3150, 0.07) * P;
    // 1 the key's plastic click (three stiff modes), 2 the contact transient, 3 bottom-out into the plate
    b.add(burst(sr, r, 0.0016, 0.00035, { hp: soft ? 1200 : 2800 }), 0, soft ? 0.3 : 0.55, p0);
    b.add(modal(sr, n, [{ f: f1, tau: soft ? 0.0024 : 0.0031, a: 1 }, { f: f1 * c.j(1.63, 0.03), tau: 0.002, a: 0.5 }, { f: f1 * c.j(2.41, 0.03), tau: 0.0014, a: 0.3 }]), 0, soft ? 0.45 : 0.65, p0, 0.12);
    b.add(modal(sr, n, [{ f: c.j(spc ? 145 : soft ? 205 : 265, 0.1) * P, tau: spc ? 0.02 : 0.009, a: 1, t0: c.j(0.0028, 0.3), att: 0.0004 }, { f: c.j(spc ? 520 : 780, 0.1) * P, tau: 0.004, a: 0.35, t0: 0.003 }]), 0, spc ? 0.9 : 0.55, p0);
    if (spc) b.add(modal(sr, n, [{ f: c.j(2500, 0.1) * P, tau: 0.004, a: 1 }, { f: c.j(4100, 0.1) * P, tau: 0.002, a: 0.5 }]), secs(sr, c.j(0.0065, 0.25)), 0.28, p0 + 0.15); // stabiliser wire
    if (!soft) { // the upstroke, a quieter higher click as the key returns
      const up = secs(sr, c.j(spc ? 0.12 : 0.085, 0.25));
      b.add(modal(sr, n, [{ f: f1 * 1.18, tau: 0.0017, a: 1 }, { f: f1 * 1.9, tau: 0.001, a: 0.4 }]), up, 0.17, p0);
      b.add(burst(sr, r, 0.001, 0.00025, { hp: 4000 }), up, 0.1, p0);
    }
    if (soft) for (const ch of [b.L, b.R]) filt(ch, sr, { lp: 6000 });
    punch(b, soft ? 0.25 : 0.4);
    space(b, r, { rt60: 0.22, mix: 0.06, hp: 600 });
    return { bus: b, hit: 0 };
  },
};

const press: Def = {
  variants: ["thock", "soft", "confirm"], level: -13, duckDb: 2,
  use: "a button press, the Generate thock (thock), a gentle toggle (soft), a press that succeeds, tuned to the key (confirm)",
  make(c, v) {
    const { sr, r, P } = c, n = secs(sr, v === "confirm" ? 2.8 : 1.2), b = new Bus(sr, n), soft = v === "soft";
    // body: a pitch-dropping sine, the "th" of thock
    const lo = c.j(soft ? 70 : 84, 0.05) * P, drop = c.j(soft ? 105 : 150, 0.1) * P, tau = c.j(soft ? 0.065 : 0.052, 0.1);
    const body = chirp(sr, secs(sr, 0.5), (t) => lo + drop * Math.exp(-t / 0.017), ad(0.0006, tau));
    b.add(body.map((x) => Math.tanh(x * 1.5) / Math.tanh(1.5)), 0, 1, 0);
    // transient
    b.add(burst(sr, r, 0.004, soft ? 0.001 : 0.0006, { lp: soft ? 2500 : 7000, hp: 500 }), 0, soft ? 0.3 : 0.5, 0);
    if (!soft) {
      // the plastic cap: three modes, a hair to the side
      b.add(modal(sr, n, [{ f: c.j(1060, 0.05) * P, tau: 0.007, a: 1 }, { f: c.j(1790, 0.05) * P, tau: 0.005, a: 0.6 }, { f: c.j(2870, 0.05) * P, tau: 0.0035, a: 0.4 }]), 0, 0.42, 0.08, 0.3);
      const up = secs(sr, c.j(0.14, 0.2)); // release: the button coming back up
      b.add(modal(sr, n, [{ f: c.j(1420, 0.05) * P, tau: 0.003, a: 1 }, { f: c.j(2330, 0.05) * P, tau: 0.002, a: 0.5 }]), up, 0.13, 0.05);
      b.add(chirp(sr, secs(sr, 0.1), () => lo * 1.6, ad(0.0005, 0.012)), up, 0.12, 0);
    }
    if (v === "confirm") { // a glassy tuned answer 12 ms after the press
      const f = keyHz(c, 6);
      b.add(modal(sr, n, glock(f, 0.35, 1, 0.012)), 0, 0.18, -0.25);
      b.add(modal(sr, n, glock(f * 1.5, 0.28, 1, 0.07)), 0, 0.12, 0.3);
    }
    punch(b, soft ? 0.3 : 0.5);
    space(b, r, { rt60: v === "confirm" ? 0.9 : 0.4, mix: v === "confirm" ? 0.16 : 0.1, hp: 220 });
    return { bus: b, hit: 0 };
  },
};

const pop: Def = {
  variants: ["pop", "cork", "tiny"], level: -16, duckDb: 1,
  use: "something appears (pop), a cap coming off / a card landing (cork), a small dot or badge appearing (tiny)",
  make(c, v) {
    const { sr, r, P } = c, n = secs(sr, 0.5), b = new Bus(sr, n), p0 = (r() - 0.5) * 0.3;
    const [f0, rise, tau, nz] = v === "cork" ? [260, 0.9, 0.032, 0.7] : v === "tiny" ? [920, 1.1, 0.012, 0.3] : [420, 1.6, 0.022, 0.45];
    const f = c.j(f0, 0.1) * P, tt = c.j(tau, 0.15);
    b.add(chirp(sr, n, (t) => f * (1 + rise * (1 - Math.exp(-t / 0.005))), ad(0.0004, tt)), 0, 1, p0);
    b.add(burst(sr, r, 0.005, v === "cork" ? 0.0014 : 0.0008, { bp: v === "tiny" ? 3200 : v === "cork" ? 900 : 1400, q: 1.4 }), 0, nz * 2.2, p0);
    if (v !== "tiny") b.add(modal(sr, n, [{ f: c.j(v === "cork" ? 110 : 140, 0.1) * P, tau: 0.01, a: 1, att: 0.0005 }]), 0, 0.3, 0);
    if (v === "cork") b.add(shape(filt(pink(r, secs(sr, 0.12)), sr, { hp: 1800 }), sr, ad(0.004, 0.025)), secs(sr, 0.004), 0.25, p0); // the rush of air
    punch(b, 0.35);
    space(b, r, { rt60: 0.35, mix: 0.1 });
    return { bus: b, hit: 0 };
  },
};

const drop = (c: Ctx, b: Bus, at: number, f0: number, tau: number, g: number, p: number) => {
  const { sr, r } = c;
  b.add(burst(sr, r, 0.001, 0.00025, { hp: 2500 }), at, 0.35 * g, p); // the surface tick
  // the plink: a bubble of air trapped by the drop rings with a RISING pitch (van den Doel)
  b.add(modal(sr, b.n, [{ f: f0, tau, a: 1, t0: 0.0015, att: 0.0012, rise: 0.4 / tau }, { f: f0 * 2.01, tau: tau * 0.3, a: 0.08, t0: 0.0015, att: 0.0012, rise: 0.4 / tau }]), at, g, p);
};
const ink: Def = {
  variants: ["plip", "double", "bloom"], level: -15, duckDb: 2,
  use: "an ink drop landing (plip), a drop and its smaller echo (double), the drop that opens an ink bloom (bloom)",
  make(c, v) {
    const { sr, r, P } = c, n = secs(sr, 3.5), b = new Bus(sr, n), p0 = (r() - 0.5) * 0.3, f0 = c.j(1150, 0.12) * P, tau = c.j(0.04, 0.15);
    drop(c, b, 0, f0, tau, 1, p0);
    if (v === "double") drop(c, b, secs(sr, c.j(0.085, 0.2)), f0 * c.j(1.35, 0.06), tau * 0.7, 0.42, p0 + 0.25);
    if (v === "bloom") { // the ink spreads: a soft wet swell and a low round note under it
      const sw = shape(filt(pink(r, secs(sr, 1.5)), sr, { lp: 750, hp: 120 }), sr, ad(0.09, 0.45));
      const sw2 = shape(filt(pink(r, secs(sr, 1.5)), sr, { lp: 750, hp: 120 }), sr, ad(0.11, 0.45));
      b.add2(sw, sw2, secs(sr, 0.02), 0.5);
      b.add(chirp(sr, secs(sr, 2.2), (t) => c.j(98, 0.04) * P * (1 - 0.06 * smooth(t / 0.6)), ad(0.05, 0.34)), secs(sr, 0.01), 0.22, 0);
    }
    punch(b, 0.3);
    space(b, r, { rt60: v === "bloom" ? 1.1 : 0.6, mix: v === "bloom" ? 0.22 : 0.14, hp: 300 });
    return { bus: b, hit: 0 };
  },
};

/** Stroke velocity for writing: strokes of 60-200 ms, small lifts between, one-pole smoothed. */
const strokes = (c: Ctx, n: number, meanS: number) => {
  const { sr, r } = c, v = buf(n); let i = 0;
  while (i < n) {
    const d = secs(sr, c.j(meanS, 0.5)), peak = 0.55 + 0.45 * r();
    for (let k = 0; k < d && i + k < n; k++) v[i + k] = peak * Math.pow(Math.sin((Math.PI * k) / d), 0.7);
    i += d + (r() < 0.3 ? secs(sr, c.j(0.05, 0.5)) : secs(sr, c.j(0.012, 0.5)));
  }
  const k = 1 - Math.exp((-2 * Math.PI * 60) / sr); let z = 0;
  for (let q = 0; q < n; q++) { z += k * (v[q] - z); v[q] = z; }
  return v;
};
const scratch: Def = {
  variants: ["nib", "pencil", "marker"], level: -18.5, duckDb: 1.5,
  use: "lettering being written: a metal pen nib (nib), graphite (pencil), a felt marker (marker). lengthS = how long the writing lasts",
  make(c, v) {
    const { sr, r, P } = c, len = c.o.lengthS ?? 1.0, n = secs(sr, len + 0.15), b = new Bus(sr, n), N = secs(sr, len);
    const cfg = v === "pencil" ? { base: 1400, span: 1800, q: 1.1, rate: 500, crack: 0.35, fric: 0.7, body: 0.3, mean: 0.13 }
      : v === "marker" ? { base: 850, span: 900, q: 1.6, rate: 70, crack: 0.1, fric: 0.8, body: 0.35, mean: 0.16 }
      : { base: 2700, span: 2600, q: 2.2, rate: 950, crack: 0.55, fric: 0.55, body: 0.14, mean: 0.1 };
    const vel = strokes(c, N, cfg.mean), panAt = (i: number) => clamp(c.dir * (-0.3 + (0.6 * i) / Math.max(1, N)) + 0.05 * Math.sin(i / sr * 7), -1, 1);
    // 1 friction: noise through a band that brightens with pen speed
    const fr = white(r, N), fOf = (t: number) => (cfg.base + cfg.span * vel[Math.min(N - 1, Math.round(t * sr))]) * P; sweep(fr, sr, fOf, cfg.q, "bp"); sweep(fr, sr, fOf, cfg.q * 0.7, "bp");
    for (let i = 0; i < N; i++) fr[i] *= vel[i] * vel[i];
    b.add(fr, 0, cfg.fric * 3.2, panAt);
    // 2 the paper's tooth: sparse micro-clicks, denser when the pen moves fast
    const cr = buf(N);
    for (let i = 0; i < N; i++) if (r() < (cfg.rate * vel[i]) / sr) { const a = (r() - 0.5) * 2 * (0.4 + 0.6 * r()); for (let k = 0; k < secs(sr, 0.0012) && i + k < N; k++) cr[i + k] += a * Math.exp(-k / (sr * 0.00015)); }
    filt(cr, sr, { hp: 2500 }); b.add(cr, 0, cfg.crack, panAt);
    // 3 the hand and the sheet under it: low rustle following the stroke
    const bd = filt(pink(r, N), sr, { lp: 700, hp: 150 }); for (let i = 0; i < N; i++) bd[i] *= vel[i];
    b.add(bd, 0, cfg.body, panAt);
    if (v === "marker") { const f = c.j(1300, 0.1) * P; b.add(chirp(sr, N, (t) => f * (1 + 0.15 * vel[Math.min(N - 1, Math.round(t * sr))]), (t) => Math.pow(vel[Math.min(N - 1, Math.round(t * sr))], 3)), 0, 0.05, panAt); }
    const fade = secs(sr, 0.008); for (let i = 0; i < fade; i++) { const g = i / fade; b.L[i] *= g; b.R[i] *= g; }
    space(b, r, { rt60: 0.3, mix: 0.08, hp: 400 });
    return { bus: b, hit: 0 };
  },
};

const paper: Def = {
  variants: ["slide", "flip", "rustle"], level: -18, duckDb: 1.5,
  use: "a sheet sliding in and landing (slide, hit = the landing), a page turn (flip, hit = the snap), handling paper (rustle)",
  make(c, v) {
    const { sr, r, P } = c;
    if (v === "flip") {
      const len = c.o.lengthS ?? c.j(0.32, 0.1), N = secs(sr, len), b = new Bus(sr, N + secs(sr, 0.6));
      let ph = 0; const am = buf(N); for (let i = 0; i < N; i++) { const u = i / N; ph += (2 * Math.PI * (55 - 30 * u)) / sr; am[i] = 1 - 0.55 * (0.5 + 0.5 * Math.sin(ph)); }
      const env = (t: number) => { const u = t / len; return smooth(u / 0.55) * (u < 0.55 ? 1 : 1 - smooth((u - 0.55) / 0.45) * 0.85); };
      for (const [side, amt] of [[0, 1], [1, 1]] as const) {
        const s = white(r, N); sweep(s, sr, (t) => (1500 + 2700 * Math.sin(Math.PI * Math.min(1, t / len))) * P, 0.9, "bp");
        for (let i = 0; i < N; i++) s[i] *= am[i] * env(i / sr);
        b.add(s, 0, 1.1 * amt, side ? 0.2 * c.dir : -0.2 * c.dir);
      }
      const snap = N - secs(sr, 0.01);
      b.add(burst(sr, r, 0.006, 0.0009, { hp: 1500 }), snap, 0.55, 0.25 * c.dir);
      b.add(modal(sr, b.n, [{ f: c.j(880, 0.1) * P, tau: 0.005, a: 1 }, { f: c.j(190, 0.1) * P, tau: 0.012, a: 0.6, att: 0.0005 }]), snap, 0.3, 0.2 * c.dir);
      space(b, r, { rt60: 0.4, mix: 0.1 });
      return { bus: b, hit: snap };
    }
    if (v === "rustle") {
      const len = c.o.lengthS ?? c.j(0.5, 0.15), N = secs(sr, len), b = new Bus(sr, N + secs(sr, 0.5)), k = 28 + Math.floor(r() * 24);
      for (let g = 0; g < k; g++) {
        const t = len * Math.pow(r(), 1.3), gl = c.j(0.008, 0.6), f = (1500 + 4500 * r()) * P;
        b.add(burst(sr, r, gl, gl * 0.35, { bp: f, q: 1.3 }), secs(sr, t), (0.4 + r()) * 1.2 * Math.sin(Math.PI * Math.min(1, t / len + 0.05)), (r() - 0.5) * 0.8);
      }
      const bed = shape(filt(pink(r, N), sr, { lp: 3200, hp: 500 }), sr, (t) => Math.sin(Math.PI * Math.min(1, t / len)));
      b.add(bed, 0, 0.35, 0);
      space(b, r, { rt60: 0.35, mix: 0.08 });
      return { bus: b, hit: 0 };
    }
    // slide: the sheet travels, speeding then braking, then lands
    const len = c.o.lengthS ?? c.j(0.45, 0.12), N = secs(sr, len), land = secs(sr, len * 0.86), b = new Bus(sr, N + secs(sr, 0.6));
    const sp = (t: number) => { const u = t / (len * 0.86); return u < 1 ? smooth(u / 0.3) * (1 - 0.4 * u) : 0.15 * Math.exp(-(t - len * 0.86) / 0.02); };
    const pan = (i: number) => c.dir * (-0.3 + 0.55 * Math.min(1, i / land));
    for (const side of [0, 1]) {
      const s = pink(r, N); sweep(s, sr, (t) => (1000 + 1700 * sp(t)) * P, 0.8, "bp"); for (let i = 0; i < N; i++) s[i] *= sp(i / sr);
      b.add(s, 0, 1.3, (i) => pan(i) + (side ? 0.15 : -0.15));
    }
    const fib = buf(N); for (let i = 0; i < N; i++) if (r() < (180 * sp(i / sr)) / sr) fib[i] = (r() - 0.5) * 2;
    b.add(filt(fib, sr, { hp: 3000 }), 0, 0.35, pan);
    b.add(modal(sr, b.n, [{ f: c.j(150, 0.1) * P, tau: 0.02, a: 1, att: 0.0008 }, { f: c.j(620, 0.1) * P, tau: 0.006, a: 0.3 }]), land, 0.45, pan(land));
    b.add(burst(sr, r, 0.008, 0.0015, { lp: 3000, pink: true }), land, 0.5, pan(land));
    space(b, r, { rt60: 0.4, mix: 0.1 });
    return { bus: b, hit: land };
  },
};

/**
 * A pass-by: the source moves along a line past the listener. Distance sets level and air
 * absorption, the radial velocity sets the doppler glide (high approaching, low leaving) and the
 * angle sets the pan. hit = the closest point.
 */
const passBy = (c: Ctx, b: Bus, len: number, o: { air: number; tone: number; toneQ: number; body: number; toneAmt: number; bodyAmt: number; dop: number; spread: number }) => {
  const { sr, r, P } = c, N = secs(sr, len), tc = len * 0.56, w = len * 0.2;
  const geo = (t: number) => { const x = (t - tc) / w, d = Math.sqrt(1 + x * x); return { x, d, D: 1 / (1 + o.dop * (x / d)) }; };
  const edge = (t: number) => Math.min(1, t / 0.03, (len - t) / 0.03);
  const amp = (t: number) => { const { d } = geo(t); return Math.pow(d, -1.7) * Math.max(0, edge(t)); };
  const panAt = (i: number) => { const { x, d } = geo(i / sr); return clamp(c.dir * o.spread * (x / d), -1, 1); };
  const air = [pink(r, N), pink(r, N)];
  for (const s of air) { sweep(s, sr, (t) => { const g = geo(t); return o.air * P * g.D * (0.55 + 0.45 / g.d); }, 0.7, "bp"); for (let i = 0; i < N; i++) s[i] *= amp(i / sr); }
  // mostly panned (the source moves), partly decorrelated (the air around it)
  const mono = air[0].map((x, i) => x * 0.75 + air[1][i] * 0.25);
  b.add(mono, 0, 3.2, panAt);
  b.add2(air[1], air[0], 0, 0.9);
  // pre-attack air: the thin high edge of the moving air reaches the ear ~3 ms before its body
  const edgeAir = filt(pink(r, N), sr, { hp: 5200 }); for (let i = 0; i < N; i++) edgeAir[i] *= amp(i / sr) * Math.pow(geo(i / sr).D, 3);
  b.add(edgeAir, -secs(sr, 0.003), 0.55, panAt);
  if (o.toneAmt > 0) { const t = white(r, N); sweep(t, sr, (tt) => o.tone * P * geo(tt).D, o.toneQ, "bp"); for (let i = 0; i < N; i++) t[i] *= amp(i / sr); b.add(t, 0, o.toneAmt, panAt); }
  if (o.bodyAmt > 0) { const s = pink(r, N); sweep(s, sr, (t) => o.body * geo(t).D, 0.8, "lp"); for (let i = 0; i < N; i++) s[i] *= amp(i / sr); b.add(s, 0, o.bodyAmt, (i) => panAt(i) * 0.4); }
  return secs(sr, tc);
};
const whoosh: Def = {
  variants: ["soft", "air", "fast", "deep"], level: -16, duckDb: 2,
  use: "something travels past camera: a gentle transition (soft, the default), a card flying (air), a quick flick (fast), a big heavy move (deep). hit = the pass-by",
  make(c, v) {
    const cfg = { soft: { len: 0.9, air: 620, tone: 1050, toneQ: 5, body: 180, toneAmt: 0.35, bodyAmt: 0.25, dop: 0.14, spread: 0.6 },
      air: { len: 0.7, air: 950, tone: 1750, toneQ: 7, body: 220, toneAmt: 0.5, bodyAmt: 0.3, dop: 0.22, spread: 0.8 },
      fast: { len: 0.38, air: 1400, tone: 2600, toneQ: 8, body: 260, toneAmt: 0.55, bodyAmt: 0.15, dop: 0.32, spread: 0.85 },
      deep: { len: 1.05, air: 460, tone: 780, toneQ: 5, body: 150, toneAmt: 0.3, bodyAmt: 0.9, dop: 0.2, spread: 0.7 } }[v]!;
    const len = c.o.lengthS ?? c.j(cfg.len, 0.08), b = new Bus(c.sr, secs(c.sr, len + 0.8));
    const hit = passBy(c, b, len, { ...cfg, air: c.j(cfg.air, 0.1), tone: c.j(cfg.tone, 0.1) });
    space(b, c.r, { rt60: v === "deep" ? 1.2 : 0.7, mix: 0.12, hp: 300 });
    return { bus: b, hit };
  },
};

const swish: Def = {
  variants: ["in", "out", "soft"], level: -17, duckDb: 1,
  use: "a UI panel or card sliding (in = rising, out = falling), a subtle nudge (soft). Short, never sharp",
  make(c, v) {
    const { sr, r, P } = c, len = c.o.lengthS ?? c.j(v === "soft" ? 0.28 : 0.2, 0.1), N = secs(sr, len), b = new Bus(sr, secs(sr, len + 0.5));
    const [f1, f2] = v === "out" ? [3400, 1300] : v === "soft" ? [900, 1900] : [1300, 3400], pk = 0.35;
    const f = (t: number) => f1 * Math.pow(f2 / f1, smooth(t / len)) * P;
    const env = (t: number) => { const u = t / len; return u < pk ? 0.5 - 0.5 * Math.cos((Math.PI * u) / pk) : Math.exp(-(u - pk) * 4.5) * (1 - smooth((u - 0.85) / 0.15)); };
    const pan = (i: number) => c.dir * (-0.35 + (0.7 * i) / N);
    for (const side of [0, 1]) { const s = pink(r, N); sweep(s, sr, f, v === "soft" ? 0.9 : 1.3, "bp"); sweep(s, sr, f, 0.8, "bp"); shape(s, sr, env); b.add(s, 0, 1.4, (i) => pan(i) + (side ? 0.2 : -0.2)); }
    const t = white(r, N); sweep(t, sr, f, 6, "bp"); shape(t, sr, env); b.add(t, 0, v === "soft" ? 0.1 : 0.2, pan);
    space(b, r, { rt60: 0.35, mix: 0.08 });
    return { bus: b, hit: secs(sr, len * pk) };
  },
};

const riser: Def = {
  variants: ["soft", "air", "tonal"], level: -15, duckDb: 2,
  use: "the ONE build into the big reveal: soft (the signature: air + a tuned chord), air (noise only), tonal (more chord). Tempo-synced: beats + bpm; hit = its end, on the downbeat",
  make(c, v) {
    const { sr, r } = c, len = c.o.lengthS ?? ((c.o.beats ?? 4) * 60) / c.bpm, N = secs(sr, len), b = new Bus(sr, N + secs(sr, 0.03));
    const [nz, tn] = v === "air" ? [1, 0] : v === "tonal" ? [0.45, 1] : [0.8, 0.55];
    const cut = (t: number) => Math.min(1, (len - t) / 0.02); // it stops ON the downbeat
    // 1 air: noise through a resonant low-pass opening 250 Hz -> 10 kHz, growing wider
    for (const side of [0, 1]) {
      const s = pink(r, N); sweep(s, sr, (t) => 250 * Math.pow(40, Math.pow(t / len, 1.4)), (t) => 1.2 + 1.6 * (t / len), "lp"); filt(s, sr, { hp: 160 });
      shape(s, sr, (t) => Math.pow(t / len, 2.2) * cut(t));
      b.add(s, 0, nz * 1.6, (i) => (side ? 1 : -1) * (0.15 + 0.6 * (i / N)));
    }
    // 2 a tuned chord (root, fifth, octave, the octave above fading in) pulsing in tempo: 8ths -> 16ths -> 32nds
    if (tn > 0) {
      const beat = c.bpm / 60, voices: [number, number, number][] = [[keyHz(c, 3), -0.5, 0], [keyHz(c, 3, 7), 0.5, 0.5], [keyHz(c, 4), 0, 0.25], [keyHz(c, 5), 0, 0.75]];
      voices.forEach(([f, p, phase], vi) => {
        const s = buf(N); let ph = 0, tp = phase;
        for (let i = 0; i < N; i++) {
          const t = i / sr, u = t / len, rate = beat * (u < 0.5 ? 2 : u < 0.8 ? 4 : 8), I = 0.2 + 1.6 * u;
          tp += rate / sr; ph += (2 * Math.PI * f * c.P) / sr;
          const trem = 1 - (0.25 + 0.45 * u) * (0.5 + 0.5 * Math.cos(2 * Math.PI * tp));
          const fadeIn = vi === 3 ? smooth((u - 0.55) / 0.35) : 1;
          s[i] = Math.sin(ph + I * Math.sin(2 * ph)) * trem * Math.pow(u, 1.8) * fadeIn * cut(t);
        }
        b.add(s, 0, tn * 0.22, p);
      });
    }
    for (const ch of [b.L, b.R]) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * 1.3) / 1.3;
    return { bus: b, hit: N };
  },
};

const impact: Def = {
  variants: ["boom", "soft", "bloom"], level: -9, duckDb: 6,
  use: "the ONE big reveal (boom), a smaller landing (soft), the reveal with a tuned shimmer and a breath in before it (bloom)",
  make(c, v) {
    const { sr, r, P } = c, soft = v === "soft", pre = v === "bloom" ? secs(sr, 0.28) : 0, n = pre + secs(sr, soft ? 4.5 : 7.5), b = new Bus(sr, n);
    // 1 sub drop, saturated so small speakers still hear its harmonics
    const lo = c.j(soft ? 40 : 44, 0.04) * P, subTau = c.j(soft ? 0.3 : 0.38, 0.1), sub = chirp(sr, secs(sr, subTau * 8), (t) => lo + (soft ? 55 : 72) * P * Math.exp(-t / 0.07), ad(0.002, subTau));
    b.add(sub.map((x) => Math.tanh(x * 1.8) / Math.tanh(1.8)), pre, 1, 0);
    // 2 punch: dark noise + two chest modes, a hair wide
    b.add(burst(sr, r, 0.35, soft ? 0.05 : 0.07, { lp: soft ? 500 : 950, pink: true }), pre, soft ? 0.9 : 1.3, -0.1, 0.4);
    b.add(burst(sr, r, 0.35, soft ? 0.05 : 0.07, { lp: soft ? 500 : 950, pink: true }), pre, soft ? 0.9 : 1.3, 0.1, -0.4);
    b.add(modal(sr, n, [{ f: c.j(170, 0.06) * P, tau: 0.09, a: 1, att: 0.001 }, { f: c.j(96, 0.06) * P, tau: 0.15, a: 0.8, att: 0.001 }]), pre, soft ? 0.25 : 0.4, 0);
    if (!soft) b.add(burst(sr, r, 0.004, 0.0007, { hp: 1500 }), pre, 0.35, 0); // 3 the crack on top
    if (v === "bloom") {
      // a breath in before it: a reversed swell that stops on the hit
      for (const side of [0, 1]) { const s = pink(r, pre); sweep(s, sr, (t) => 400 * Math.pow(8, t / 0.28), 1, "lp"); shape(s, sr, (t) => Math.pow(t / 0.28, 3)); b.add(s, 0, 0.8, side ? 0.4 : -0.4); }
      // and a tuned shimmer on the key: root, 3rd, 5th, 9th in the upper octaves, spread across the field
      const third = c.key!.minor ? 3 : 4;
      [[keyHz(c, 5), -0.6], [keyHz(c, 5, third), 0.6], [keyHz(c, 5, 7), -0.3], [keyHz(c, 6, 2), 0.3], [keyHz(c, 6), 0]].forEach(([f, p], k) => {
        const ms = glock(f * c.P, 1.5, 1, 0.02 + k * 0.012).map((m) => ({ ...m, att: 0.03 }));
        b.add(modal(sr, n, ms), pre, 0.09, p);
      });
    }
    punch(b, soft ? 0.25 : 0.2);
    space(b, r, { rt60: soft ? 1.2 : 2.4, mix: soft ? 0.2 : 0.34, hp: 120, lp: 3500, predelay: 0.02, er: 0.35 });
    return { bus: b, hit: pre };
  },
};

const chime: Def = {
  variants: ["sparkle", "bell", "glint"], level: -17, duckDb: 1.5,
  use: "magic / success, tuned to the film's key: a rising pentatonic sparkle (sparkle), one bell (bell), a tiny glint on a highlight (glint)",
  make(c, v) {
    const { sr, r } = c, n = secs(sr, v === "bell" ? 7 : v === "glint" ? 2.5 : 5.5), b = new Bus(sr, n), scale = PENTA[c.key!.minor ? "minor" : "major"];
    if (v === "bell") {
      b.add(modal(sr, n, glock(keyHz(c, 5) * c.P, 1.4, 1)), 0, 1, -0.1);
      b.add(modal(sr, n, glock(keyHz(c, 6, 7) * c.P, 0.9, 1, 0.004)), 0, 0.3, 0.3);
      b.add(burst(sr, r, 0.003, 0.0005, { hp: 5000 }), 0, 0.2, 0);
      space(b, r, { rt60: 1.6, mix: 0.25, hp: 400 });
      return { bus: b, hit: 0 };
    }
    const count = v === "glint" ? 2 : 4 + Math.floor(r() * 3), oct = v === "glint" ? 7 : 6, start = Math.floor(r() * 3);
    let t = 0;
    for (let k = 0; k < count; k++) {
      const d = start + k, f = keyHz(c, oct + Math.floor(d / 5), scale[d % 5]) * c.P, g = 0.6 + (0.4 * k) / count;
      const p = c.dir * (-0.55 + (1.1 * k) / Math.max(1, count - 1)) * (k % 2 ? 1 : 0.8);
      b.add(modal(sr, n, glock(f, v === "glint" ? 0.14 : c.j(0.5, 0.15), 1)), secs(sr, t), g, p);
      t += c.j(v === "glint" ? 0.04 : 0.055, 0.15);
    }
    if (v === "sparkle") { const s = [white(r, secs(sr, 1)), white(r, secs(sr, 1))]; for (const x of s) { filt(x, sr, { hp: 7500 }); shape(x, sr, ad(0.06, 0.3)); } b.add2(s[0], s[1], 0, 0.035); }
    space(b, r, { rt60: v === "glint" ? 0.8 : 1.8, mix: v === "glint" ? 0.15 : 0.3, hp: 400, predelay: 0.015 });
    return { bus: b, hit: 0 };
  },
};

const bubbleAt = (c: Ctx, b: Bus, at: number, f0: number, tau: number, g: number, p: number) =>
  b.add(modal(c.sr, b.n, [{ f: f0, tau, a: 1, att: 0.001, rise: 0.45 / tau }, { f: f0 * 2.02, tau: tau * 0.25, a: 0.06, att: 0.001, rise: 0.45 / tau }]), at, g, p);
const bubble: Def = {
  variants: ["bubbles", "splash", "gloop"], level: -16.5, duckDb: 1.5,
  use: "water life (the koi): a few rising bubbles (bubbles), a tail flick at the surface (splash), one big lazy bubble (gloop)",
  make(c, v) {
    const { sr, r, P } = c, n = secs(sr, 1.6), b = new Bus(sr, n);
    if (v === "gloop") {
      bubbleAt(c, b, 0, c.j(270, 0.1) * P, c.j(0.075, 0.15), 1, (r() - 0.5) * 0.4);
      bubbleAt(c, b, secs(sr, c.j(0.09, 0.2)), c.j(390, 0.1) * P, 0.05, 0.5, (r() - 0.5) * 0.6);
      for (const ch of [b.L, b.R]) filt(ch, sr, { lp: 2800 });
    } else {
      let t = 0;
      if (v === "splash") {
        for (const side of [0, 1]) b.add(burst(sr, r, 0.3, 0.06, { bp: 1200, q: 0.7, pink: true }), 0, 1.5, side ? 0.35 : -0.35);
        b.add(burst(sr, r, 0.12, 0.028, { hp: 3000 }), 0, 0.35, 0);
        const k = 4 + Math.floor(r() * 4); for (let q = 0; q < k; q++) { const f = (1800 + 1700 * r()) * P; b.add(modal(sr, n, [{ f, tau: 0.008 + 0.012 * r(), a: 1, rise: 30 }]), secs(sr, 0.04 + 0.22 * r()), 0.22, (r() - 0.5) * 0.9); }
        t = 0.05;
      }
      const k = v === "splash" ? 2 : 4 + Math.floor(r() * 5);
      for (let q = 0; q < k; q++) {
        const f0 = (350 + 1100 * Math.pow(r(), 1.5)) * P, tau = 0.012 + 12 / f0;
        bubbleAt(c, b, secs(sr, t), f0, tau, 0.5 + 0.5 * r(), (r() - 0.5) * 1.0);
        t += c.j(0.07, 0.8) * (1 - q / (k + 2));
      }
      for (const ch of [b.L, b.R]) filt(ch, sr, { lp: 5000 });
    }
    space(b, r, { rt60: 0.55, mix: 0.12, hp: 300 });
    return { bus: b, hit: 0 };
  },
};

const BRICK: [number, number, number][] = [[1850, 0.02, 1], [2720, 0.013, 0.7], [3990, 0.009, 0.55], [5240, 0.006, 0.4], [7380, 0.004, 0.25]];
const clack = (c: Ctx, b: Bus, at: number, g: number, p: number, face: number) => {
  const { sr, r, P } = c;
  b.add(modal(sr, b.n, [...BRICK.map(([f, tau, a]) => ({ f: f * c.j(1, 0.035) * P * face, tau: tau * c.j(1, 0.2), a: a * c.j(1, 0.25) })), { f: c.j(720, 0.08) * P * face, tau: 0.016, a: 0.45 }]), at, g, p);
  b.add(burst(sr, r, 0.0008, 0.00015, { hp: 4000 }), at, 0.5 * g, p);
};
const brick: Def = {
  variants: ["clack", "snap", "tumble"], level: -15, duckDb: 1.5,
  use: "toy bricks: two bricks tapping (clack), a brick pressed onto studs (snap), a brick dropped onto a pile (tumble)",
  make(c, v) {
    const { sr, r, P } = c, n = secs(sr, 1.2), b = new Bus(sr, n), p0 = (r() - 0.5) * 0.5;
    if (v === "snap") {
      clack(c, b, 0, 0.45, p0, 1.08);
      const at = secs(sr, c.j(0.024, 0.2)); clack(c, b, at, 1, p0, 0.94);
      b.add(modal(sr, n, [{ f: c.j(380, 0.08) * P, tau: 0.012, a: 1, att: 0.0003 }]), at, 0.5, p0);
      punch(b, 0.35);
      space(b, r, { rt60: 0.35, mix: 0.08 });
      return { bus: b, hit: at };
    }
    if (v === "tumble") {
      let t = 0, gap = c.j(0.11, 0.2), g = 1; const k = 3 + Math.floor(r() * 3);
      for (let q = 0; q < k; q++) { clack(c, b, secs(sr, t), g, clamp(p0 + (r() - 0.5) * 0.4, -1, 1), 0.9 + 0.2 * r()); t += gap; gap *= c.j(0.62, 0.1); g *= c.j(0.6, 0.15); }
    } else clack(c, b, 0, 1, p0, 1);
    punch(b, 0.35);
    space(b, r, { rt60: 0.35, mix: 0.08 });
    return { bus: b, hit: 0 };
  },
};

const thread: Def = {
  variants: ["pull", "pierce", "stitch"], level: -17.5, duckDb: 1.5,
  use: "embroidery: thread drawn through cloth (pull, hit = the tug), the needle going through (pierce), both (stitch)",
  make(c, v) {
    const { sr, r, P } = c, b = new Bus(sr, secs(sr, 1.6)), p0 = (r() - 0.5) * 0.3;
    const pierce = (at: number) => {
      const k = 3 + Math.floor(r() * 3); for (let q = 0; q < k; q++) b.add(burst(sr, r, 0.0006, 0.00012, { hp: 3500 }), at + secs(sr, q * 0.006 + r() * 0.003), 0.15 + 0.15 * r(), p0);
      const pop = at + secs(sr, c.j(0.03, 0.2));
      b.add(modal(sr, b.n, [{ f: c.j(3600, 0.06) * P, tau: 0.002, a: 1 }, { f: c.j(5900, 0.06) * P, tau: 0.0012, a: 0.4 }]), pop, 0.5, p0);
      b.add(burst(sr, r, 0.001, 0.0002, { hp: 2500 }), pop, 0.5, p0);
      b.add(burst(sr, r, 0.06, 0.015, { bp: 2400, q: 2 }), pop, 0.6, p0);
      return pop;
    };
    const pull = (at: number) => {
      const len = c.o.lengthS ?? c.j(0.45, 0.15), N = secs(sr, len), s = white(r, N), sp = (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, t / len), 0.8)), 1.2);
      sweep(s, sr, (t) => (1500 + 1800 * sp(t)) * P, 3, "bp"); sweep(s, sr, (t) => (1500 + 1800 * sp(t)) * P, 2, "bp");
      let ph = 0; for (let i = 0; i < N; i++) { const t = i / sr; ph += (2 * Math.PI * (70 + 110 * sp(t))) / sr; s[i] *= sp(t) * (1 - 0.5 * (0.5 + 0.5 * Math.sin(ph))); }
      b.add(s, at, 2.2, (i) => p0 + c.dir * (-0.1 + (0.3 * i) / N));
      const hiss = filt(white(r, N), sr, { hp: 5000 }); for (let i = 0; i < N; i++) hiss[i] *= sp(i / sr);
      b.add(hiss, at, 0.08, p0);
      const tug = at + N - secs(sr, 0.004);
      b.add(modal(sr, b.n, [{ f: c.j(230, 0.1) * P, tau: 0.012, a: 1, att: 0.0005 }]), tug, 0.4, p0);
      b.add(burst(sr, r, 0.001, 0.0002, { hp: 3000 }), tug, 0.18, p0);
      return tug;
    };
    let hit = 0;
    if (v === "pierce") hit = pierce(0);
    else if (v === "stitch") { hit = pierce(0); pull(hit + secs(sr, 0.1)); }
    else hit = pull(0);
    space(b, r, { rt60: 0.3, mix: 0.07, hp: 400 });
    return { bus: b, hit };
  },
};

// The unpitched family, for films whose music the engine does not control (a generated or supplied
// track). Every layer is filtered noise or a falling sweep under 150 Hz, and the contact lasts a few
// milliseconds, so nothing carries a note that could clash with the track's key: a brand launch
// note was "the sound effects cannot be melodic, it makes disharmonious interruptions to the music".
// Modelled on that film's approved kit (strikes cut to 10-25 ms from their peak). tools/track.mjs kit
// prints each variant's pitch salience; trackMix refuses anything over 0.5 under an external track.
const tap: Def = {
  variants: ["tick", "tickHi", "tock", "thump", "impact"], level: -19, duckDb: 0,
  use: "under someone else's music: a small landing or a typed line (tick), a sparkle-sized touch (tickHi), a card or button (tock), a stage or block landing (thump), the one big lock-in (impact). No pitch, so no clash with the track's key",
  make(c, v) {
    const { sr, r } = c, p0 = (r() - 0.5) * 0.3;
    if (v === "tick" || v === "tickHi") {
      const hi = v === "tickHi", b = new Bus(sr, secs(sr, 0.05));
      b.add(burst(sr, r, hi ? 0.01 : 0.016, c.j(hi ? 0.0007 : 0.0013, 0.1), { hp: hi ? 3200 : 1800, lp: hi ? 14000 : 9000 }), 0, 1, p0);
      b.add(burst(sr, r, 0.004, 0.0004, { hp: hi ? 6000 : 4000 }), 0, 0.5, p0);
      punch(b, 0.3);
      return { bus: b, hit: 0 };
    }
    if (v === "tock") {
      const b = new Bus(sr, secs(sr, 0.08));
      b.add(burst(sr, r, 0.03, c.j(0.0045, 0.1), { hp: 450, lp: 5500 }), 0, 1, p0);
      b.add(burst(sr, r, 0.004, 0.0005, { hp: 2500 }), 0, 0.45, p0);
      punch(b, 0.35);
      return { bus: b, hit: 0 };
    }
    const big = v === "impact", n = secs(sr, big ? 1.8 : 0.16), b = new Bus(sr, n);
    // weight: a sweep that falls from about 110 to 45 Hz, under the 150 Hz line where a sound reads as a note
    const lo = c.j(big ? 42 : 48, 0.04), tau = big ? 0.42 : 0.045;
    b.add(chirp(sr, secs(sr, big ? 1.7 : 0.15), (t) => lo + 65 * Math.exp(-t / 0.018), ad(0.0015, tau)).map((x) => Math.tanh(x * 1.6) / Math.tanh(1.6)), 0, 1, 0);
    // body: low noise (lowpassed twice, as the approved kit was) and a dull contact so phones hear the hit
    const body = burst(sr, r, big ? 1.6 : 0.12, c.j(big ? 0.35 : 0.03, 0.1), { lp: big ? 500 : 160 }); filt(body, sr, { lp: big ? 500 : 160 });
    b.add(body, 0, big ? 1.6 : 1.2, p0 * 0.5);
    b.add(burst(sr, r, 0.006, 0.0009, { hp: 1200, lp: 6000 }), 0, big ? 0.22 : 0.3, p0);
    if (big) space(b, r, { rt60: 0.9, mix: 0.12, hp: 120, lp: 3000 });
    punch(b, 0.3);
    return { bus: b, hit: 0 };
  },
};

export const SFX = { tick, press, pop, ink, scratch, paper, whoosh, swish, riser, impact, chime, bubble, brick, thread, tap } as const;
/** Per-variant level (LUFS over the speaking window) where a kind's variants differ a lot in weight. */
const VARIANT_LEVEL: Partial<Record<string, number>> = { "tap:tickHi": -22, "tap:tock": -18, "tap:thump": -14, "tap:impact": -10 };
const VARIANT_DUCK: Partial<Record<string, number>> = { "tap:thump": 1.5, "tap:impact": 6 };
export type SfxKind = keyof typeof SFX;
export const SFX_KINDS = Object.keys(SFX) as SfxKind[];
/** kind -> its variants (the first is the default). */
export const sfxVariants = (k: SfxKind) => SFX[k].variants;
/** How far the score dips under one variant (dB): the kind's own, or the variant's where weights differ. */
export const sfxDuckDb = (k: SfxKind, variant?: string) => VARIANT_DUCK[`${k}:${variant ?? SFX[k].variants[0]}`] ?? SFX[k].duckDb;
export const sfxInfo = (k: SfxKind) => ({ variants: SFX[k].variants, levelLufs: SFX[k].level, duckDb: SFX[k].duckDb, use: SFX[k].use });

export const parseKey = (key: string) => {
  const m = /^([A-G](?:#|b)?)(m|min|minor)?$/.exec(key.trim());
  if (!m) throw new Error(`sfx: bad key "${key}" (use e.g. "C", "Eb", "F#m")`);
  return { pc: pcOf(m[1]), minor: !!m[2] };
};
const checkSeed = (seed: unknown) => { if (!Number.isSafeInteger(seed) || (seed as number) < 0 || (seed as number) > 0xffffffff) throw new Error(`sfx: seed must be an integer 0..4294967295, got ${String(seed)}`); };
const checkRange = (name: string, x: unknown, lo: number, hi: number) => { if (x !== undefined && (typeof x !== "number" || !Number.isFinite(x) || x < lo || x > hi)) throw new Error(`sfx: ${name} must be a number ${lo}..${hi}, got ${String(x)}`); };

export const validateSfx = (kind: string, o: SfxOpts = {}) => {
  if (!(kind in SFX)) throw new Error(`sfx: unknown kind "${kind}" (kinds: ${SFX_KINDS.join(", ")})`);
  const d = SFX[kind as SfxKind];
  if (o.variant !== undefined && !d.variants.includes(o.variant)) throw new Error(`sfx: ${kind} has no variant "${o.variant}" (variants: ${d.variants.join(", ")})`);
  if (o.seed !== undefined) checkSeed(o.seed);
  checkRange("pitch", o.pitch, -24, 24); checkRange("lengthS", o.lengthS, 0.05, 30); checkRange("beats", o.beats, 0.25, 64); checkRange("bpm", o.bpm, 20, 300); checkRange("gainDb", o.gainDb, -60, 24);
  if (o.dir !== undefined && o.dir !== 1 && o.dir !== -1) throw new Error(`sfx: dir must be 1 or -1, got ${String(o.dir)}`);
  if (o.key !== undefined) parseKey(o.key);
};

/**
 * What a sound needs from the film: a key (tuned kinds) and a bpm (tempo-synced kinds). Never
 * defaulted: an effect tuned to a key the score isn't in, or pulsing at a tempo it isn't at, is wrong.
 */
export const sfxNeeds = (kind: SfxKind, variant: string, o: SfxOpts = {}) => ({
  key: kind === "chime" || (kind === "riser" && variant !== "air") || (kind === "press" && variant === "confirm") || (kind === "impact" && variant === "bloom"),
  bpm: kind === "riser" && !(variant === "air" && o.lengthS !== undefined),
});
/**
 * Render one sound. Pure in (kind, opts, sr). The level is calibrated: the kind's target loudness
 * over its speaking window, +-1 dB of per-seed variation, + opts.gainDb; sample peak capped at -1 dBFS.
 */
export const renderSfx = (kind: SfxKind, o: SfxOpts = {}, sr = 48000): SfxSound => {
  validateSfx(kind, o);
  if (!Number.isSafeInteger(sr) || sr < 22050 || sr > 192000) throw new Error(`sfx: sample rate must be an integer 22050..192000, got ${sr}`);
  const d = SFX[kind], variant = o.variant ?? d.variants[0], seed = o.seed ?? 1, r = mkRng((seed ^ 0x5f3759df) >>> 0);
  const need = sfxNeeds(kind, variant, o);
  if (need.key && o.key === undefined) throw new Error(`sfx: ${kind}:${variant} is tuned and needs a key (opts.key, or in a plan: plan.key or plan.score = the film's piece); there is no default key`);
  if (need.bpm && o.bpm === undefined) throw new Error(`sfx: ${kind}:${variant} is tempo-synced and needs a bpm (opts.bpm, or in a plan: plan.bpm or plan.score); there is no default tempo`);
  const wobble = need.key ? 1 : 1 + (r() * 2 - 1) * 0.03; // +-3 % per trigger: a repeat never clones (never on a tuned sound)
  const c: Ctx = { sr, r, P: Math.pow(2, (o.pitch ?? 0) / 12) * wobble, o, dir: o.dir ?? 1, key: o.key === undefined ? null : parseKey(o.key), bpm: o.bpm ?? NaN, j: (x, amt) => x * (1 + (r() * 2 - 1) * amt) };
  const made = d.make(c, variant), [L, R] = finish(made.bus, made.hit);
  const kL = kWeight(L, sr), kR = kWeight(R, sr), window = speakingWindow(kL, kR, sr), now = winLufs(kL, kR, window[0], window[1]);
  let g = (VARIANT_LEVEL[`${kind}:${variant}`] ?? d.level) + (r() * 2 - 1) + (o.gainDb ?? 0) - now;
  let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  g = Math.min(g, -1 - 20 * Math.log10(Math.max(peak, 1e-9)));
  const G = db(g); for (let i = 0; i < L.length; i++) { L[i] *= G; R[i] *= G; }
  return { L, R, sr, kind, variant, seed, hit: Math.min(made.hit, L.length - 1), window, lufs: now + g };
};

export type { SfxStereo };
