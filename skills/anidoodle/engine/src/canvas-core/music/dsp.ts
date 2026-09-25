// DSP building blocks. Everything is a pure function of its inputs plus an rng() handed in by
// the caller; stateful filters are legal because a whole buffer renders in one call.
export type Rng = () => number;
export const TAU = Math.PI * 2;
export const db = (x: number) => Math.pow(10, x / 20);
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
/** Equal-power pan, p in -1..1 -> [gL, gR]. */
export const pan = (p: number): [number, number] => { const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4; return [Math.cos(a), Math.sin(a)]; };
/** Gaussian from a seeded uniform source. */
export const gauss = (r: Rng) => { let u = r(); if (u < 1e-12) u = 1e-12; return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); };

/** Zavalishin TPT state-variable filter; set() may be called per sample for sweeps. */
export class SVF {
  private ic1 = 0; private ic2 = 0; private g = 0; private k = 0; private a1 = 0; private a2 = 0; private a3 = 0;
  lp = 0; bp = 0; hp = 0;
  constructor(private sr: number, f = 1000, q = 0.707) { this.set(f, q); }
  set(f: number, q: number) { this.g = Math.tan((Math.PI * clamp(f, 5, this.sr * 0.49)) / this.sr); this.k = 1 / q; this.a1 = 1 / (1 + this.g * (this.g + this.k)); this.a2 = this.g * this.a1; this.a3 = this.g * this.a2; }
  tick(x: number) { const v3 = x - this.ic2, v1 = this.a1 * this.ic1 + this.a2 * v3, v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3; this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2; this.lp = v2; this.bp = v1; this.hp = x - this.k * v1 - v2; return v2; }
}
/** RBJ biquad (direct form I). */
export class Biquad {
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0; b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  static make(sr: number, type: "lp" | "hp" | "bp" | "peak" | "lowshelf" | "highshelf", f: number, q: number, gainDb = 0) {
    const bq = new Biquad(), w = (TAU * f) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, gainDb / 40);
    let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === "bp") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === "peak") { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    else { const sq = 2 * Math.sqrt(A) * al, sh = type === "lowshelf" ? 1 : -1;
      b0 = A * ((A + 1) - sh * (A - 1) * c + sq); b1 = sh * 2 * A * ((A - 1) - sh * (A + 1) * c); b2 = A * ((A + 1) - sh * (A - 1) * c - sq);
      a0 = (A + 1) + sh * (A - 1) * c + sq; a1 = -sh * 2 * ((A - 1) + sh * (A + 1) * c); a2 = (A + 1) + sh * (A - 1) * c - sq; }
    bq.b0 = b0 / a0; bq.b1 = b1 / a0; bq.b2 = b2 / a0; bq.a1 = a1 / a0; bq.a2 = a2 / a0; return bq;
  }
  tick(x: number) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
  run(buf: Float32Array) { for (let i = 0; i < buf.length; i++) buf[i] = this.tick(buf[i]); return buf; }
}
export const onePoleCoef = (sr: number, f: number) => 1 - Math.exp((-TAU * f) / sr);

/** PolyBLEP residual for band-limited saw/pulse. */
export const blep = (t: number, dt: number) => { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; };

/** Add a mono signal into a stereo pair with gains. */
export const addPan = (L: Float32Array, R: Float32Array, i0: number, sig: Float32Array | Float64Array, len: number, p: number, g: number) => {
  const [gl, gr] = pan(p); const n = Math.min(len, L.length - i0);
  for (let i = Math.max(0, -i0); i < n; i++) { const v = sig[i] * g; L[i0 + i] += v * gl; R[i0 + i] += v * gr; }
};

/**
 * A small room: early reflections (decorrelated taps per side, each darker than the last) plus a
 * short 8-line feedback delay network for the diffuse tail. Returns the WET signal only.
 * size ~ room scale, rt60 in seconds, damp = high-frequency loss in the tail (0..1).
 */
export const room = (L: Float32Array, R: Float32Array, sr: number, o: { er: number; late: number; rt60: number; predelay: number; hp: number; lp: number; seed: number; rng: Rng }) => {
  const n = L.length, wL = new Float32Array(n), wR = new Float32Array(n), tL = new Float32Array(n), tR = new Float32Array(n), r = o.rng;
  // send filter: high-passed (no mud) and low-passed
  const inL = Float32Array.from(L), inR = Float32Array.from(R);
  Biquad.make(sr, "hp", o.hp, 0.7).run(inL); Biquad.make(sr, "hp", o.hp, 0.7).run(inR);
  Biquad.make(sr, "lp", o.lp, 0.7).run(inL); Biquad.make(sr, "lp", o.lp, 0.7).run(inR);
  // early reflections: 7 taps per side, 6-38 ms, alternating polarity, decreasing gain
  for (const [src, dst, side] of [[inL, wL, 0], [inR, wR, 1], [inR, wL, 2], [inL, wR, 3]] as const) {
    let acc = 0; const k = onePoleCoef(sr, 5200);
    for (let t = 0; t < 7; t++) {
      const ms = 6 + t * 4.6 + r() * 3 + side * 0.7, d = Math.round((ms / 1000) * sr), g = (o.er * (side < 2 ? 1 : 0.55) * Math.pow(0.8, t) * (t % 2 ? -1 : 1)) / 2.2;
      acc = 0; for (let i = d; i < n; i++) { acc += k * (src[i - d] - acc); dst[i] += acc * g; }
    }
  }
  if (o.late > 0) {
    const N = 8, lens = [1123, 1289, 1447, 1597, 1777, 1913, 2053, 2239].map((x) => Math.round((x * sr) / 48000 * (0.7 + 0.3 * r())));
    const bufs = lens.map((l) => new Float32Array(l)), idx = new Array(N).fill(0), lp = new Array(N).fill(0);
    const gains = lens.map((l) => Math.pow(10, (-3 * l) / (sr * o.rt60))), dampK = onePoleCoef(sr, 3200);
    const pd = Math.round(o.predelay * sr), out = new Float64Array(N), h = new Float64Array(N);
    for (let i = 0; i < n; i++) {
      const xl = i >= pd ? inL[i - pd] : 0, xr = i >= pd ? inR[i - pd] : 0;
      for (let j = 0; j < N; j++) out[j] = bufs[j][idx[j]];
      // Hadamard-ish mix (fast Walsh on 8)
      h.set(out);
      for (let s = 1; s < N; s <<= 1) for (let j = 0; j < N; j += s << 1) for (let q = j; q < j + s; q++) { const a = h[q], b = h[q + s]; h[q] = a + b; h[q + s] = a - b; }
      for (let j = 0; j < N; j++) {
        let v = (h[j] / Math.sqrt(N)) * gains[j];
        lp[j] += dampK * (v - lp[j]); v = lp[j];
        bufs[j][idx[j]] = v + (j % 2 ? xr : xl) * 0.5; idx[j] = (idx[j] + 1) % lens[j];
      }
      tL[i] = (out[0] - out[2] + out[4] - out[6]) * o.late * 0.5; tR[i] = (out[1] - out[3] + out[5] - out[7]) * o.late * 0.5; wL[i] += tL[i]; wR[i] += tR[i];
    }
  }
  return [wL, wR, tL, tR] as const; // full wet, and the late tail alone
};
