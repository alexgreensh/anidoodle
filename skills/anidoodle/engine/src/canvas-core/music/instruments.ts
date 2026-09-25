// The non-piano kit. Each instrument: (keys, sr, n, opts, rng) -> [L, R]. Keys are performed
// presses in seconds. Presets are numbers in one place (the constants at the top of each voice).
import { type Rng, TAU, clamp, pan, SVF, Biquad, blep, onePoleCoef, gauss } from "./dsp";
import type { Played } from "./perform";

type Out = { L: Float32Array; R: Float32Array };
type Opts = Record<string, number | boolean | string>;
const num = (o: Opts, k: string, d: number) => (typeof o[k] === "number" ? (o[k] as number) : d);
const f0 = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const pitchPan = (m: number, w: number) => clamp((m - 64) / 30, -1, 1) * w;

/** Sum of decaying sinusoids, the modal core shared by music box, celesta, mallets and bells. */
const modal = (out: Out, i0: number, modes: [number, number, number][], p: number, sr: number, maxS: number, rel?: { at: number; sigma: number }, atkMs = 2) => {
  const atk = Math.max(1, Math.round((atkMs / 1000) * sr));
  const [gl, gr] = pan(p), n = out.L.length;
  for (const [f, a, tau] of modes) {
    if (f > sr * 0.45 || a <= 0) continue;
    const w = (TAU * f) / sr, cw = Math.cos(w), sw = Math.sin(w), dec = Math.exp(-1 / (tau * sr));
    const decR = rel ? Math.exp(-(1 / tau + rel.sigma) / sr) : dec;
    const len = Math.min(n - i0, Math.ceil(Math.min(maxS, tau * 11) * sr)), relI = rel ? Math.round(rel.at * sr) : Infinity;
    let c = a, s = 0;
    for (let i = 0; i < len; i++) { const y = i < atk ? (s * i) / atk : s; const j = i0 + i; if (j >= 0) { out.L[j] += y * gl; out.R[j] += y * gr; } const d = i < relI ? dec : decR; const c2 = (c * cw - s * sw) * d; s = (c * sw + s * cw) * d; c = c2; }
  }
};

export const musicBox = (keys: Played[], sr: number, n: number, o: Opts): Out => {
  // the recipe numbers, verbatim: partials 1, 2, 3 at 1.0/0.35/0.12, a 5.4f ping dying in 60 ms,
  // 2 ms attack, tau = 0.45 sqrt(440/f)
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, w = num(o, "width", 0.5);
  for (const k of keys) {
    const f = f0(k.p), tau = 0.45 * Math.sqrt(440 / f), i0 = Math.round(k.t * sr), g = k.v * 0.3;
    modal(out, i0, [[f, g, tau], [2 * f, 0.35 * g, tau * 0.8], [3 * f, 0.12 * g, tau * 0.6], [5.4 * f, 0.08 * g, 0.06 / 4]], pitchPan(k.p, w), sr, 8);
  }
  return out;
};
/** The recipe's DING: partials 1, 2, 3, 4.2, tau 1.2 s, doubled an octave down. */
export const bell = (keys: Played[], sr: number, n: number, o: Opts): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, w = num(o, "width", 0.3);
  for (const k of keys) { const i0 = Math.round(k.t * sr), g = k.v * 0.25;
    for (const f of [f0(k.p), f0(k.p) / 2]) modal(out, i0, [[f, g, 1.2], [2 * f, 0.5 * g, 0.75], [3 * f, 0.3 * g, 0.5], [4.2 * f, 0.16 * g, 0.3]], pitchPan(k.p, w), sr, 9, undefined, 1.5); }
  return out;
};
export const celesta = (keys: Played[], sr: number, n: number, o: Opts): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, w = num(o, "width", 0.5);
  for (const k of keys) {
    const f = f0(k.p), tau = 0.8 * Math.sqrt(440 / f), i0 = Math.round(k.t * sr), g = Math.pow(k.v, 1.3) * 0.3, h = 0.4 + 0.6 * k.v;
    modal(out, i0, [[f, g, tau], [2 * f, 0.18 * g * h, tau * 0.5], [4.02 * f, 0.07 * g * h, tau * 0.25], [6.9 * f, 0.03 * g * h, 0.03]], pitchPan(k.p, w), sr, 8, { at: k.off - k.t, sigma: 9 });
  }
  return out;
};
/** Marimba / vibraphone: a tuned bar's modes (1 : 3.9 : 9.2 for rosewood, 1 : 4 : 10 for aluminium). */
export const mallets = (keys: Played[], sr: number, n: number, o: Opts, vibes = false): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, w = num(o, "width", 0.6);
  for (const k of keys) {
    const f = f0(k.p), i0 = Math.round(k.t * sr), g = Math.pow(k.v, 1.4) * 0.32, h = 0.25 + 0.75 * k.v; // h = mallet hardness
    const t1 = vibes ? 3.2 * Math.pow(440 / f, 0.35) : clamp(0.9 * Math.pow(262 / f, 0.8), 0.18, 2.2);
    const modes: [number, number, number][] = vibes ? [[f, g, t1], [4 * f, 0.22 * g * h, t1 * 0.2], [10 * f, 0.06 * g * h, 0.05]] : [[f, g * 1.15, t1], [3.9 * f, 0.3 * g * h, t1 * 0.22], [9.2 * f, 0.1 * g * h * h, t1 * 0.07]];
    modal(out, i0, modes, pitchPan(k.p, w), sr, 8, vibes ? { at: k.off - k.t, sigma: 6 } : undefined);
  }
  if (vibes) { const r = num(o, "trem", 5.2); for (let i = 0; i < n; i++) { const m = 1 - 0.22 * (0.5 + 0.5 * Math.sin((TAU * r * i) / sr)); out.L[i] *= m; out.R[i] *= m; } }
  return out;
};

/**
 * Extended Karplus-Strong (Jaffe & Smith 1983): a delay line one period long, a two-point loss
 * filter for brightness, an allpass for fine tuning, a pick-position comb on the excitation and a
 * velocity low-pass (a softer pluck is darker). Harp rings long and bright; guitar gets a body.
 */
export const pluck = (keys: Played[], sr: number, n: number, o: Opts, r: Rng, kind: "harp" | "guitar"): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, w = num(o, "width", 0.6);
  for (const k of keys) {
    const f = f0(k.p), i0 = Math.round(k.t * sr), P = sr / f, N = Math.floor(P - 0.5), frac = P - N - 0.5;
    const ap = (1 - frac) / (1 + frac); // first-order allpass fractional delay
    const T60 = kind === "harp" ? clamp(4.2 * Math.pow(262 / f, 0.45), 0.8, 8) : clamp(3.2 * Math.pow(262 / f, 0.5), 0.6, 6);
    const S = kind === "harp" ? 0.18 : 0.32; // loss-filter weight (higher = darker)
    const rho = Math.pow(10, -3 / (T60 * f));
    const line = new Float64Array(N + 2);
    // excitation: noise shaped by velocity low-pass and a pick-position comb
    const lp = new SVF(sr, 900 + 6000 * k.v * k.v, 0.6), beta = kind === "harp" ? 0.5 : 0.18, pk = Math.max(1, Math.round(beta * N));
    const exc = new Float64Array(N); for (let i = 0; i < N; i++) exc[i] = lp.tick(gauss(r)); let mean = 0; for (let i = 0; i < N; i++) mean += exc[i] / N;
    for (let i = 0; i < N; i++) line[i] = (exc[i] - mean) - (i >= pk ? exc[i - pk] - mean : 0) * 0.9;
    let peak = 1e-9; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(line[i]));
    const g = (Math.pow(k.v, 1.3) * 0.35) / peak, [gl, gr] = pan(pitchPan(k.p, w));
    const relI = Math.round((k.off - k.t) * sr), len = Math.min(n - i0, Math.ceil(T60 * 1.1 * sr));
    let idx = 0, prev = 0, apx = 0, apy = 0, damp = 1;
    for (let i = 0; i < len; i++) {
      const x = line[idx], nxt = line[(idx + 1) % N];
      const y = ((1 - S) * x + S * nxt) * rho;
      const a = ap * y + apx - ap * apy; apx = y; apy = a; // allpass
      prev = a; line[idx] = a * damp; idx = (idx + 1) % N;
      if (kind === "guitar" && i > relI) damp = 0.985; // finger damping after release
      const j = i0 + i; if (j < n) { const v = x * g * Math.min(1, i / 24); out.L[j] += v * gl; out.R[j] += v * gr; }
    }
    void prev;
  }
  if (kind === "guitar") for (const [f, q, gdb] of [[110, 2.5, 5], [220, 3, 3], [420, 2, 2], [2800, 1, -3]] as const) { Biquad.make(sr, "peak", f, q, gdb).run(out.L); Biquad.make(sr, "peak", f, q, gdb).run(out.R); }
  return out;
};

/** Soft string ensemble: 5 detuned PolyBLEP saws per note, slow bow attack, delayed vibrato, low-pass, high-pass 150 Hz. */
export const strings = (keys: Played[], sr: number, n: number, o: Opts, r: Rng): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, atk = num(o, "attack", 0.45), rel = num(o, "release", 0.9), w = num(o, "width", 0.8), bright = num(o, "bright", 1);
  const hpL = new SVF(sr, 150, 0.7), hpR = new SVF(sr, 150, 0.7);
  for (const k of keys) {
    const f = f0(k.p), i0 = Math.round(k.t * sr), dur = k.off - k.t, len = Math.min(n - i0, Math.ceil((dur + rel * 1.5) * sr));
    const V = 5, dets = [-9, -4.5, 0, 4.2, 8.8], phs = dets.map(() => r()), pans = dets.map((_, i) => pan(((i / (V - 1)) * 2 - 1) * w)), incs = dets.map((d) => (f * Math.pow(2, d / 1200)) / sr);
    const lp = [new SVF(sr, 1000, 0.6), new SVF(sr, 1000, 0.6)], g = Math.pow(k.v, 1.2) * 0.11;
    const vr = 4.8 + r() * 0.8, vph = r() * TAU;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = t < dur ? 1 - Math.exp(-t / (atk / 3)) : (1 - Math.exp(-dur / (atk / 3))) * Math.exp(-(t - dur) / (rel / 3));
      const vib = 1 + (0.0006 + 0.0022 * clamp((t - 0.35) / 0.6, 0, 1)) * Math.sin(TAU * vr * t + vph);
      let sl = 0, sr_ = 0;
      for (let v = 0; v < V; v++) {
        const inc = incs[v] * vib; let ph = phs[v] + inc; if (ph >= 1) ph -= 1; phs[v] = ph;
        const s = 2 * ph - 1 - blep(ph, inc), pv = pans[v]; sl += s * pv[0]; sr_ += s * pv[1];
      }
      const cut = clamp((500 + 2600 * k.v * bright) * (0.55 + 0.45 * env), 200, 9000);
      if ((i & 31) === 0) { lp[0].set(cut, 0.6); lp[1].set(cut, 0.6); }
      const j = i0 + i; out.L[j] += lp[0].tick(sl) * env * g; out.R[j] += lp[1].tick(sr_) * env * g;
    }
  }
  const bassRole = o.bass === true;
  if (!bassRole) for (let i = 0; i < n; i++) { hpL.tick(out.L[i]); hpR.tick(out.R[i]); out.L[i] = hpL.hp; out.R[i] = hpR.hp; }
  return out;
};

/** Two-operator FM bell (modulator 3.5x) plus the 2.4x "tierce"; index decays faster than loudness. */
export const fmBell = (keys: Played[], sr: number, n: number, o: Opts): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, w = num(o, "width", 0.5), ratio = num(o, "ratio", 3.5);
  for (const k of keys) {
    const f = f0(k.p), i0 = Math.round(k.t * sr), ta = clamp(2.2 * Math.pow(440 / f, 0.4), 0.5, 6), ti = ta * 0.25, I0 = 1.2 + 2.4 * k.v, g = Math.pow(k.v, 1.3) * 0.2;
    const len = Math.min(n - i0, Math.ceil(ta * 7 * sr)), [gl, gr] = pan(pitchPan(k.p, w));
    for (let i = 0; i < len; i++) { const t = i / sr, a = Math.exp(-t / ta) * Math.min(1, t * 1500), I = I0 * Math.exp(-t / ti);
      const y = (Math.sin(TAU * f * t + I * Math.sin(TAU * f * ratio * t)) + 0.3 * Math.sin(TAU * f * 2.4 * t) * Math.exp(-t / (ta * 0.5))) * a * g; out.L[i0 + i] += y * gl; out.R[i0 + i] += y * gr; }
  }
  return out;
};
/** FM electric piano: 1:1 body with a decaying index, a 14:1 tine "bark" on the attack, tremolo, a little drive. */
export const ePiano = (keys: Played[], sr: number, n: number, o: Opts): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, w = num(o, "width", 0.35), trem = num(o, "trem", 4.6);
  for (const k of keys) {
    const f = f0(k.p) * (1 + (num(o, "detune", 4) / 1200) * (k.p % 2 ? 1 : -1)), i0 = Math.round(k.t * sr), td = clamp(1.9 * Math.pow(262 / f, 0.5), 0.5, 5), dur = k.off - k.t;
    const I0 = 0.6 + 2.2 * k.v, g = Math.pow(k.v, 1.2) * 0.2, len = Math.min(n - i0, Math.ceil((dur + 0.4) * sr)), [gl, gr] = pan(pitchPan(k.p, w));
    for (let i = 0; i < len; i++) {
      const t = i / sr, rel = t < dur ? 1 : Math.exp(-(t - dur) / 0.07), a = Math.exp(-t / td) * rel * Math.min(1, t * 700);
      const I = I0 * Math.exp(-t / 0.4), bark = 0.9 * k.v * Math.exp(-t / 0.012);
      const y = Math.tanh(1.3 * Math.sin(TAU * f * t + I * Math.sin(TAU * f * t) + bark * Math.sin(TAU * f * 14 * t))) * a * g;
      out.L[i0 + i] += y * gl; out.R[i0 + i] += y * gr;
    }
  }
  for (let i = 0; i < n; i++) { const m = 0.25 * Math.sin((TAU * trem * i) / sr); out.L[i] *= 1 - m; out.R[i] *= 1 + m; }
  return out;
};

// ---------------------------------------------------------------- chiptune
/** Band-limited pulse, duty 0.125/0.25/0.5, NES-like 4-bit stepped volume, delayed vibrato on long notes. */
export const pulse = (keys: Played[], sr: number, n: number, o: Opts): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, duty = num(o, "duty", 0.25), [gl, gr] = pan(num(o, "pan", 0));
  for (const k of keys) {
    const f = f0(k.p), i0 = Math.round(k.t * sr), dur = k.off - k.t, len = Math.min(n - i0, Math.ceil((dur + 0.03) * sr)); let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr, env = t < dur ? 0.62 + 0.38 * Math.exp(-t / 0.09) : Math.max(0, 0.62 * (1 - (t - dur) / 0.03)), vol = Math.round(env * 15) / 15;
      const vib = 1 + (t > 0.25 ? 0.004 * Math.sin(TAU * 6 * (t - 0.25)) : 0), inc = (f * vib) / sr;
      ph += inc; if (ph >= 1) ph -= 1;
      let s = ph < duty ? 1 : -1; s += blep(ph, inc); let q = ph - duty; if (q < 0) q += 1; s -= blep(q, inc);
      const y = (s - (2 * duty - 1)) * vol * k.v * 0.16; out.L[i0 + i] += y * gl; out.R[i0 + i] += y * gr;
    }
  }
  return out;
};
/** NES triangle: a 32-step staircase, no volume control, so it is either on or off. */
export const triangle = (keys: Played[], sr: number, n: number): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const k of keys) {
    const f = f0(k.p), i0 = Math.round(k.t * sr), len = Math.min(n - i0, Math.ceil((k.off - k.t) * sr)); let ph = 0; const lp = new SVF(sr, 7000, 0.7);
    for (let i = 0; i < len; i++) { ph += f / sr; if (ph >= 1) ph -= 1; const st = Math.floor(ph * 32), tri = st < 16 ? st / 7.5 - 1 : (31 - st) / 7.5 - 1; const e = Math.min(1, i / 48, (len - i) / 48); const y = lp.tick(tri) * 0.2 * e; out.L[i0 + i] += y; out.R[i0 + i] += y; }
  }
  return out;
};
/** NES noise channel: a 15-bit LFSR (long mode for snare/kick, short 93-step mode for hats). */
export const noiseDrum = (keys: Played[], sr: number, n: number): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const k of keys) {
    const kind = k.kind ?? "s", i0 = Math.round(k.t * sr); let reg = 1, acc = 0;
    const rate = kind === "h" ? 32000 : kind === "k" ? 3500 : 11000, dec = kind === "h" ? 0.028 : kind === "k" ? 0.07 : 0.11, short = kind === "h";
    const len = Math.min(n - i0, Math.ceil(dec * 6 * sr)); let out1 = 1;
    for (let i = 0; i < len; i++) {
      acc += rate / sr; while (acc >= 1) { acc -= 1; const bit = (reg ^ (reg >> (short ? 6 : 1))) & 1; reg = (reg >> 1) | (bit << 14); out1 = reg & 1 ? 1 : -1; }
      const t = i / sr, e = Math.round(Math.exp(-t / dec) * 15) / 15;
      let y = out1 * e * k.v * (kind === "h" ? 0.07 : 0.14);
      if (kind === "k") { const fq = 55 + 110 * Math.exp(-t / 0.03); y += Math.sin(TAU * fq * t) * Math.exp(-t / 0.09) * k.v * 0.4; }
      out.L[i0 + i] += y; out.R[i0 + i] += y;
    }
  }
  return out;
};

// ---------------------------------------------------------------- drums and bass (soft kit)
export const kick = (keys: Played[], sr: number, n: number, o: Opts): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, soft = num(o, "soft", 1);
  for (const k of keys) { const i0 = Math.round(k.t * sr), len = Math.min(n - i0, Math.ceil(0.5 * sr)); let ph = 0;
    for (let i = 0; i < len; i++) { const t = i / sr, fq = 48 + (110 + 40 * (1 - soft)) * Math.exp(-t / 0.035); ph += fq / sr;
      const y = Math.tanh(1.6 * Math.sin(TAU * ph) * Math.exp(-t / (0.22 * (0.7 + 0.3 * soft)))) * k.v * 0.5 + Math.sin(TAU * 1300 * t) * Math.exp(-t / 0.004) * 0.04 * k.v; out.L[i0 + i] += y; out.R[i0 + i] += y; } }
  return out;
};
export const snare = (keys: Played[], sr: number, n: number, o: Opts, r: Rng): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, rim = o.rim === true;
  for (const k of keys) { const i0 = Math.round(k.t * sr), len = Math.min(n - i0, Math.ceil(0.35 * sr)), bp = new SVF(sr, rim ? 1800 : 3200, rim ? 3 : 0.8);
    for (let i = 0; i < len; i++) { const t = i / sr, body = (Math.sin(TAU * 185 * t) + 0.5 * Math.sin(TAU * 330 * t)) * Math.exp(-t / 0.045) * (rim ? 0.25 : 0.5);
      bp.tick(gauss(r)); const nz = bp.bp * Math.exp(-t / (rim ? 0.02 : 0.1)) * (rim ? 1.2 : 0.6); const y = (body + nz) * k.v * 0.32; out.L[i0 + i] += y * 0.95; out.R[i0 + i] += y; } }
  return out;
};
export const hat = (keys: Played[], sr: number, n: number, o: Opts, r: Rng): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, [gl, gr] = pan(num(o, "pan", 0.3));
  for (const k of keys) { const i0 = Math.round(k.t * sr), dec = k.kind === "o" ? 0.2 : 0.03, len = Math.min(n - i0, Math.ceil(dec * 6 * sr)), hp = new SVF(sr, 7200, 0.7);
    for (let i = 0; i < len; i++) { const t = i / sr; hp.tick(gauss(r)); const y = hp.hp * Math.exp(-t / dec) * k.v * 0.09; out.L[i0 + i] += y * gl; out.R[i0 + i] += y * gr; } }
  return out;
};
/** Warm bass: sine + harmonics, a pluck envelope, and a little saturation so phones hear the line (phone rule). */
export const bass = (keys: Played[], sr: number, n: number, o: Opts): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, drive = num(o, "drive", 1.6);
  for (const k of keys) { const f = f0(k.p), i0 = Math.round(k.t * sr), dur = k.off - k.t, len = Math.min(n - i0, Math.ceil((dur + 0.1) * sr));
    for (let i = 0; i < len; i++) { const t = i / sr, e = Math.min(1, t * 300) * (0.55 + 0.45 * Math.exp(-t / 0.25)) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.03));
      const y = Math.tanh(drive * (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t) + 0.12 * Math.sin(TAU * 3 * f * t))) / Math.tanh(drive) * e * k.v * 0.3; out.L[i0 + i] += y; out.R[i0 + i] += y; } }
  return out;
};
/** Vinyl: sparse crackle impulses and a low hiss floor. One key spans the texture. */
export const vinyl = (keys: Played[], sr: number, n: number, _o: Opts, r: Rng): Out => {
  const out = { L: new Float32Array(n), R: new Float32Array(n) }, lp = onePoleCoef(sr, 4000);
  for (const k of keys) { const i0 = Math.round(k.t * sr), len = Math.min(n - i0, Math.ceil((k.off - k.t) * sr)); let zl = 0, zr = 0;
    for (let i = 0; i < len; i++) { const pop = r() < 7 / sr ? (r() - 0.5) * 0.5 * k.v : 0; const hiss = gauss(r) * 0.004 * k.v; zl += lp * (hiss + pop - zl); zr += lp * (hiss * 0.8 + pop - zr); out.L[i0 + i] += zl; out.R[i0 + i] += zr; } }
  return out;
};
