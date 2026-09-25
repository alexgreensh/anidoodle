// A modal, physics-shaped piano (ADVISORY-PLAN 4.1). No samples: every sound below is a sum of
// decaying sinusoids and filtered seeded noise. What each piece models, and where the numbers
// come from, is written next to it; the numbers are starting points confirmed only by a listen.
//
//   strings      f_n = n f0 sqrt(1 + B n^2), B rising from bass to treble (Fletcher 1964 shape)
//   unisons      2-3 strings per key detuned 0.3-1.8 cents: a fast "prompt" decay (strings in
//                phase, coupled through the bridge) and a slow beating "aftersound" (Weinreich 1977)
//   hammer       velocity sets loudness AND the spectrum (a faster hammer = shorter contact =
//                brighter); the strike point near 1/8 of the string notches partial ~8
//   losses       every partial decays at its own rate, faster with frequency; sustain by register
//   attack       a keybed/hammer knock (low thump + short click) and a soundboard modal body
//   dampers      key-up or pedal-up engages the felt: fast decay plus a breath of felt noise;
//                the top keys (MIDI >= 89) have no dampers, as on a real grand
//   pedal        sustain pedal holds dampers off; undamped strings whose partials coincide with
//                the played notes ring sympathetically; a pedal "halo" feeds the room
//   stereo       bass left, treble right (player's seat)
import { type Rng, TAU, clamp, pan, onePoleCoef, SVF, gauss } from "./dsp";
import { rng as mkRng } from "../core";

export type PianoOpts = { inharmonic: boolean; multiString: boolean; twoStage: boolean; hammer: boolean; knock: boolean; body: boolean; sympathetic: boolean; damperNoise: boolean; stretch: boolean; pedal: boolean; width: number };
export const PIANO_REAL: PianoOpts = { inharmonic: true, multiString: true, twoStage: true, hammer: true, knock: true, body: true, sympathetic: true, damperNoise: true, stretch: true, pedal: true, width: 0.4 };
/** The contrast baseline: harmonic partials, one string, one-slope decay, fixed spectrum, no pedal. */
export const PIANO_FLAT: PianoOpts = { inharmonic: false, multiString: false, twoStage: false, hammer: false, knock: false, body: false, sympathetic: false, damperNoise: false, stretch: false, pedal: false, width: 0.4 };

/** A performed key press in seconds: onset t, key release `off`, MIDI p, velocity v 0..1. */
export type KeyPress = { t: number; off: number; p: number; v: number };
export type PedalSpan = [number, number];

const f0Of = (m: number, stretch: boolean) => 440 * Math.pow(2, (m - 69) / 12 + (stretch ? (m > 60 ? 0.012 * Math.pow(m - 60, 1.9) : -0.02 * Math.pow(60 - m, 1.6)) / 1200 : 0));
/** Inharmonicity coefficient by key: ~1e-4 in the wound bass, ~5e-4 at C4, ~4e-3 at C7. */
export const inharmonicityB = (m: number) => Math.pow(10, m <= 40 ? -3.8 + 0.015 * (40 - m) : -3.8 + 0.0245 * (m - 40));
/** Aftersound T60 of the fundamental by key (s): ~20 s at C4, ~6 s at C6; the prompt sound is 4x faster. */
const t60After = (m: number) => clamp(20 * Math.pow(2, (-0.9 * (m - 60)) / 12), 1.6, 40);
/** Register trim (dB) so a scale at one velocity reads roughly even; measured by the probe, see METERS.md. */
const regGain = (m: number) => Math.pow(10, (m > 60 ? 0.15 * (m - 60) : 0.03 * (60 - m)) / 20);
const strings = (m: number) => (m < 32 ? 1 : m < 44 ? 2 : 3);

export const renderPiano = (keys: KeyPress[], pedal: PedalSpan[], sr: number, n: number, o: PianoOpts, seed: number) => {
  const L = new Float32Array(n), R = new Float32Array(n), halo = new Float32Array(n), bodyIn = new Float32Array(n);
  const rnd: Rng = mkRng(seed * 31 + 7);
  const pedalAt = (t: number) => o.pedal && pedal.some(([a, b]) => t >= a && t < b);
  const pedalUpAfter = (t: number) => { for (const [a, b] of pedal) if (t >= a && t < b) return b; return t; };
  const sorted = keys.slice().sort((a, b) => a.t - b.t);
  const maxLen = Math.min(n, Math.ceil(32 * sr));
  const buf = new Float64Array(maxLen);

  sorted.forEach((k, idx) => {
    const m = k.p, v = clamp(k.v, 0.02, 1), i0 = Math.round(k.t * sr); if (i0 >= n) return;
    const keyR = mkRng(m * 7919 + seed); // per-KEY constants: the same key always has the same strings
    const f0 = f0Of(m, o.stretch), B = o.inharmonic ? inharmonicityB(m) : 0, S = o.multiString ? strings(m) : 1;
    const detune = Array.from({ length: S }, (_, s) => (S === 1 ? 0 : (s - (S - 1) / 2) * (0.35 + 1.4 * keyR()) / 1200 * Math.LN2));
    const beta = 0.118 + 0.012 * keyR() + (m > 72 ? -0.02 * (m - 72) / 36 : 0);
    // when does the felt land on the strings?
    let damp = o.pedal ? (pedalAt(k.off) ? pedalUpAfter(k.off) : k.off) : k.off;
    if (m >= 89) damp = Infinity;
    // a restrike of the same key stops this instance's strings
    for (let j = idx + 1; j < sorted.length; j++) if (sorted[j].p === m && sorted[j].t > k.t) { damp = Math.min(damp, sorted[j].t + 0.004); break; }
    const t60a = t60After(m), sigA0 = 6.91 / t60a, sigP0 = sigA0 * 4, sigSingle = sigA0 * 2.4;
    const sigD = 6.91 / (0.1 + 0.28 * clamp((60 - m) / 36, 0, 1));
    const dampI = damp === Infinity ? Infinity : Math.round((damp - k.t) * sr);
    const natural = Math.round(Math.min(t60a * 1.05, 32) * sr);
    const len = Math.min(maxLen, n - i0, dampI === Infinity ? natural : Math.min(natural, dampI + Math.round(0.9 * sr)));
    if (len <= 0) return;
    buf.fill(0, 0, len);
    // hammer: loudness and brightness from velocity; contact time shorter when harder
    // felt hardening: above mf a faster hammer mostly buys brightness, less level (exponent 1.55 -> 0.9)
    const loud = v < 0.6 ? Math.pow(v, 1.55) : Math.pow(0.6, 1.55) * Math.pow(v / 0.6, 0.9);
    const fc = o.hammer ? (330 + 3300 * v * v) * Math.pow(f0 / 262, 0.3) : 1300 * Math.pow(f0 / 262, 0.3);
    const nyq = Math.min(0.45 * sr, 15000);
    let a1 = 0;
    for (let p = 1; p <= 90; p++) {
      const fn = p * f0 * Math.sqrt(1 + B * p * p); if (fn > nyq) break;
      const comb = o.hammer ? 0.1 + 0.9 * Math.abs(Math.sin(Math.PI * p * beta)) : 1;
      const ham = 1 / Math.sqrt(1 + Math.pow(fn / fc, 6)) * (o.hammer ? 1 : 1 / Math.pow(p, 0.35));
      const rad = (fn * fn) / (fn * fn + 105 * 105) / Math.sqrt(1 + Math.pow(fn / 6500, 4));
      const A = (comb * ham * rad) / Math.pow(p, 0.9);
      if (p === 1) a1 = Math.max(A, 1e-6);
      if (A < a1 * 2e-4 && p > 3) continue;
      const fac = 1 + 0.8 * Math.pow(fn / 1500, 2) + fn / 4000;
      const ph = TAU * keyR(); // deterministic per key
      const comps: [number, number, number][] = []; // [freq, amp, sigma]
      if (o.twoStage) {
        const wa = 0.2 / (1 + 0.12 * (p - 1));
        comps.push([fn, A * (1 - wa), sigP0 * fac]);
        if (S > 1) { comps.push([fn * Math.exp(detune[0]), (A * wa) / 2, sigA0 * fac]); comps.push([fn * Math.exp(detune[S - 1]), (A * wa) / 2, sigA0 * fac * 1.07]); }
        else comps.push([fn, A * wa, sigA0 * fac]);
      } else {
        const sig = o.multiString ? sigSingle * fac : sigSingle * (1 + 0.5 * (p - 1));
        if (S > 1) for (let s = 0; s < S; s++) comps.push([fn * Math.exp(detune[s]), A / S, sig]);
        else comps.push([fn, A, sig]);
      }
      comps.forEach(([f, amp, sig], ci) => {
        const w = (TAU * f) / sr, cr = Math.cos(w), ci_ = Math.sin(w);
        let re = amp * Math.cos(ph + ci * 1.3), im = amp * Math.sin(ph + ci * 1.3);
        const dec = Math.exp(-sig / sr), decD = Math.exp(-(sig + sigD) / sr);
        const floor = a1 * 1e-5;
        // how long until this component is inaudible (undamped part)
        const lenC = Math.min(len, Math.ceil((Math.log(amp / floor) / sig) * sr) + 1);
        const dI = Math.min(lenC, dampI === Infinity ? lenC : Math.max(0, dampI));
        for (let i = 0; i < dI; i++) { buf[i] += re; const r2 = (re * cr - im * ci_) * dec; im = (re * ci_ + im * cr) * dec; re = r2; }
        if (dI < lenC) { const lenD = Math.min(lenC, dI + Math.ceil((Math.log(Math.max(Math.hypot(re, im), floor * 1.0001) / floor) / (sig + sigD)) * sr) + 1);
          for (let i = dI; i < lenD; i++) { buf[i] += re; const r2 = (re * cr - im * ci_) * decD; im = (re * ci_ + im * cr) * decD; re = r2; } }
      });
    }
    // hammer contact ramp: 2.2 ms (ff) to 4 ms (pp), raised cosine; this is also a gentle low-pass on the attack
    const ramp = Math.max(2, Math.round((o.hammer ? 4.2 - 2.0 * v : 1.5) / 1000 * sr));
    for (let i = 0; i < ramp && i < len; i++) buf[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / ramp);
    const REF = 0.37, norm = ((0.22 * loud) / REF) * regGain(m); // fixed scale: register balance comes from the physics, trimmed by regGain
    // knock: a low thump from the action and keybed plus a short click where the hammer lands
    if (o.knock) {
      const kl = Math.min(len, Math.round(0.06 * sr)), sv = new SVF(sr, 2400 + 1600 * v, 0.9);
      for (let i = 0; i < kl; i++) {
        const t = i / sr;
        buf[i] += (0.9 * Math.sin(TAU * 92 * t) * Math.exp(-t / 0.018) + 0.5 * Math.sin(TAU * 205 * t) * Math.exp(-t / 0.011)) * 0.10 * v * REF;
        buf[i] += sv.tick(gauss(rnd)) * Math.exp(-t / 0.0028) * 0.35 * v * v * REF;
      }
    }
    // felt landing on the strings: a breath of low noise at the damp point
    const [gl, gr] = pan(clamp((m - 62) / 34, -1, 1) * o.width);
    if (o.damperNoise && dampI !== Infinity && dampI < len) {
      const sv = new SVF(sr, 500, 0.7), dl = Math.min(len - dampI, Math.round(0.07 * sr));
      for (let i = 0; i < dl; i++) buf[dampI + i] += sv.tick(gauss(rnd)) * Math.sin((Math.PI * i) / dl) * 0.012 * v * REF;
    }
    const inPedal = pedalAt(k.t) || pedalAt(k.t + 0.25);
    for (let i = 0; i < len; i++) {
      const s = buf[i] * norm, j = i0 + i;
      L[j] += s * gl; R[j] += s * gr;
      if (o.body) bodyIn[j] += s * 0.05;
      if (inPedal) halo[j] += s;
    }
    // soundboard excitation: the hammer's force pulse
    if (o.body) { const pl = Math.round((0.0035 - 0.0025 * v) * sr); for (let i = 0; i < pl && i0 + i < n; i++) bodyIn[i0 + i] += Math.sin((Math.PI * i) / pl) * 0.45 * loud * 0.22; }
    // sympathetic strings: open strings whose partials coincide with this note's ring while the pedal is down
    if (o.sympathetic && inPedal) {
      const up = pedalUpAfter(Math.max(k.t, k.t + 0.25));
      const endI = Math.min(n - i0, Math.round((up - k.t) * sr) + Math.round(0.25 * sr), Math.round(10 * sr));
      for (const [off, harmOfGhost, harmOfNote, cpl] of [[-12, 2, 1, 0.07], [-19, 3, 1, 0.05], [-24, 4, 1, 0.035], [12, 1, 2, 0.05], [19, 1, 3, 0.03], [7, 2, 3, 0.03]] as const) {
        const gm = m + off; if (gm < 21 || gm > 108) continue;
        const gf0 = f0Of(gm, o.stretch), gB = o.inharmonic ? inharmonicityB(gm) : 0;
        const f = harmOfGhost * gf0 * Math.sqrt(1 + gB * harmOfGhost * harmOfGhost);
        const noteP = harmOfNote * f0 * Math.sqrt(1 + B * harmOfNote * harmOfNote);
        const mis = Math.abs(f - noteP) / noteP; if (mis > 0.004) continue;
        const sig = 6.91 / t60After(gm) * (1 + 0.8 * Math.pow(f / 1500, 2)), dec = Math.exp(-sig / sr);
        const [pl, pr] = pan(clamp((gm - 62) / 34, -1, 1) * o.width);
        const amp = 0.22 * loud * cpl * (harmOfNote === 1 ? 1 : 0.5), w = (TAU * f) / sr, rise = Math.exp(-1 / (0.18 * sr));
        let e = 1, env = 0; const dampStart = Math.round((up - k.t) * sr), decD = Math.exp(-(sig + 25) / sr);
        let g = 1, c = Math.cos(gm), sn = Math.sin(gm); const cw = Math.cos(w), sw = Math.sin(w);
        for (let i = 0; i < endI; i++) { env = 1 - (e *= rise); const sOut = sn * amp * env * g; L[i0 + i] += sOut * pl; R[i0 + i] += sOut * pr; halo[i0 + i] += sOut; g *= i < dampStart ? dec : decD; const c2 = c * cw - sn * sw; sn = c * sw + sn * cw; c = c2; }
      }
    }
  });
  // soundboard: a bank of ~40 fixed modes excited by the hammer pulses and a trace of the strings
  if (o.body) {
    const br = mkRng(seed * 13 + 101), out = new Float32Array(n);
    for (let k = 0; k < 40; k++) {
      const f = 70 * Math.pow(3600 / 70, (k + br()) / 40), q = 12 + 26 * br(), g = (0.5 + br()) / Math.sqrt(f / 70) * 0.9;
      const sv = new SVF(sr, f, q); for (let i = 0; i < n; i++) { sv.tick(bodyIn[i]); out[i] += sv.bp * g; }
    }
    const hp = onePoleCoef(sr, 60); let z = 0;
    for (let i = 0; i < n; i++) { z += hp * (out[i] - z); const s = (out[i] - z) * 0.16; L[i] += s * 0.95; R[i] += s * 0.85; }
  }
  return { L, R, halo };
};
