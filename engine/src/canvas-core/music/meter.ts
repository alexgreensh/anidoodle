// The deaf composer's instruments. Pure functions over float buffers:
//   loudness  ITU-R BS.1770-4 K-weighting, 400 ms blocks at 75 % overlap, -70 LUFS absolute and
//             -10 LU relative gates; LRA per EBU Tech 3342 (3 s short-term, -20 LU gate, P95 - P10)
//   truePeak  4x oversampled (windowed-sinc polyphase), dBTP
//   onsets    spectral flux with a max-filtered previous frame (SuperFlux-style), adaptive threshold
//   centroid  magnitude-weighted spectral centroid, averaged over non-silent frames
export const fft = (re: Float64Array, im: Float64Array) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const a = i + j, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
};

const kWeight = (x: Float32Array, sr: number) => {
  // stage 1: high shelf (+4 dB above ~1.7 kHz); stage 2: RLB high-pass ~38 Hz (pyloudnorm's closed form)
  const out = new Float64Array(x.length);
  { const G = 3.999843853973347, Q = 0.7071752369554196, fc = 1681.974450955533, K = Math.tan((Math.PI * fc) / sr), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K, b0 = (Vh + (Vb * K) / Q + K * K) / a0, b1 = (2 * (K * K - Vh)) / a0, b2 = (Vh - (Vb * K) / Q + K * K) / a0, a1 = (2 * (K * K - 1)) / a0, a2 = (1 - K / Q + K * K) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; out[i] = y; } }
  { const fc = 38.13547087602444, Q = 0.5003270373238773, K = Math.tan((Math.PI * fc) / sr), a0 = 1 + K / Q + K * K, a1 = (2 * (K * K - 1)) / a0, a2 = (1 - K / Q + K * K) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < out.length; i++) { const xi = out[i], y = xi - 2 * x1 + x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xi; y2 = y1; y1 = y; out[i] = y; } }
  return out;
};

export const loudness = (chans: Float32Array[], sr: number) => {
  const k = chans.map((c) => kWeight(c, sr)), n = chans[0].length;
  const ms = (a: number, len: number) => { let s = 0; for (const c of k) { let e = 0; for (let i = a; i < a + len && i < n; i++) e += c[i] * c[i]; s += e / len; } return s; };
  const lufs = (z: number) => -0.691 + 10 * Math.log10(Math.max(z, 1e-20));
  // integrated
  const bl = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), blocks: number[] = [];
  for (let a = 0; a + bl <= n; a += hop) blocks.push(ms(a, bl));
  const abs = blocks.filter((z) => lufs(z) > -70), rel = lufs(abs.reduce((a, b) => a + b, 0) / Math.max(1, abs.length)) - 10;
  const gated = abs.filter((z) => lufs(z) > rel), integrated = lufs(gated.reduce((a, b) => a + b, 0) / Math.max(1, gated.length));
  // short-term (3 s) for LRA and max short-term; momentary max
  const sl = Math.round(3 * sr), st: number[] = []; for (let a = 0; a + sl <= n; a += hop) st.push(ms(a, sl));
  const stAbs = st.filter((z) => lufs(z) > -70), stRel = lufs(stAbs.reduce((a, b) => a + b, 0) / Math.max(1, stAbs.length)) - 20;
  const stG = stAbs.map(lufs).filter((l) => l > stRel).sort((a, b) => a - b);
  const pct = (p: number) => (stG.length ? stG[Math.min(stG.length - 1, Math.max(0, Math.round((p / 100) * (stG.length - 1))))] : NaN);
  const shortTerm = st.map(lufs);
  return { integrated, lra: pct(95) - pct(10), shortMax: Math.max(...shortTerm), momentaryMax: Math.max(...blocks.map(lufs)), shortTerm, hopS: 0.1 };
};

export const truePeak = (chans: Float32Array[]) => {
  // 4x polyphase windowed sinc, 16 taps per phase
  const O = 4, T = 16, h: number[][] = [];
  for (let ph = 0; ph < O; ph++) { const row: number[] = []; for (let t = 0; t < T; t++) { const x = t - T / 2 + 1 - ph / O, w = 0.5 + 0.5 * Math.cos((Math.PI * x) / (T / 2)); row.push(x === 0 ? 1 : (Math.sin(Math.PI * x) / (Math.PI * x)) * w); } h.push(row); }
  let peak = 0, sample = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) {
    const a = Math.abs(c[i]); if (a > sample) sample = a;
    if (a < peak * 0.5) continue; // cheap skip: an inter-sample peak cannot exceed ~2x its neighbours here
    for (let ph = 1; ph < O; ph++) { let s = 0; for (let t = 0; t < T; t++) { const j = i + t - T / 2 + 1; if (j >= 0 && j < c.length) s += c[j] * h[ph][t]; } const v = Math.abs(s); if (v > peak) peak = v; }
    if (a > peak) peak = a;
  }
  return { dbtp: 20 * Math.log10(Math.max(peak, 1e-12)), samplePeakDb: 20 * Math.log10(Math.max(sample, 1e-12)) };
};

const hann = (N: number) => Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
/** STFT magnitudes of the mono mix. */
const stft = (mono: Float32Array, N: number, hop: number) => {
  const w = hann(N), frames: Float64Array[] = [];
  for (let a = 0; a + N <= mono.length; a += hop) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = mono[a + i] * w[i]; fft(re, im); const m = new Float64Array(N / 2 + 1); for (let k = 0; k <= N / 2; k++) m[k] = Math.hypot(re[k], im[k]); frames.push(m); }
  return frames;
};
export const mono = (chans: Float32Array[]) => { const n = chans[0].length, m = new Float32Array(n); for (const c of chans) for (let i = 0; i < n; i++) m[i] += c[i] / chans.length; return m; };

/** Onset strength of every accepted peak is returned too (`strength`, on a loudness-normalised scale). */
export const onsetsDetail = (chans: Float32Array[], sr: number, delta = 0.07, absFloor = ONSET_FLOOR) => {
  // loudness-normalise to -23 LUFS first, so the absolute floor means the same thing for every file
  const m = mono(chans), lu = loudness([m], sr).integrated, g = Number.isFinite(lu) ? Math.pow(10, (-23 - lu) / 20) : 1;
  for (let i = 0; i < m.length; i++) m[i] *= g;
  const hop = Math.round(sr / 100), N = sr >= 44100 ? 2048 : 1024, frames = stft(m, N, hop);
  // log-compressed bands on a ~24-per-octave filterbank above 30 Hz
  const bins = frames[0].length, edges: number[] = []; for (let f = 30; f < Math.min(16000, sr / 2); f *= Math.pow(2, 1 / 24)) edges.push(Math.round((f / sr) * N));
  const uniq = [...new Set(edges)].filter((b) => b < bins);
  const bands = frames.map((mm) => { const out = new Float64Array(uniq.length - 1); for (let b = 0; b < uniq.length - 1; b++) { let s = 0; for (let k = uniq[b]; k < Math.max(uniq[b] + 1, uniq[b + 1]); k++) s += mm[k]; out[b] = Math.log10(1 + 100 * s); } return out; });
  const raw = new Float64Array(bands.length);
  for (let t = 1; t < bands.length; t++) { let s = 0; const cur = bands[t], prev = bands[t - 1]; for (let b = 0; b < cur.length; b++) { const pm = Math.max(prev[b], b > 0 ? prev[b - 1] : 0, b + 1 < cur.length ? prev[b + 1] : 0); const d = cur[b] - pm; if (d > 0) s += d; } raw[t] = s; }
  let mx = 0; for (const f of raw) mx = Math.max(mx, f); const flux = raw.map((x) => x / (mx || 1));
  const times: number[] = [], strength: number[] = []; let last = -1e9;
  for (let t = 3; t < flux.length - 3; t++) {
    let isMax = true; for (let d = -3; d <= 3; d++) if (flux[t + d] > flux[t]) isMax = false; if (!isMax) continue;
    let mean = 0, c = 0; for (let d = -10; d <= 3; d++) { const j = t + d; if (j >= 0 && j < flux.length) { mean += flux[j]; c++; } } mean /= c;
    if (flux[t] >= mean + delta && raw[t] >= absFloor && (t - last) * hop / sr >= 0.05) { times.push((t * hop) / sr); strength.push(raw[t]); last = t; }
  }
  return { times, strength };
};
/** Absolute onset-strength floor (loudness-normalised flux). Calibrated in METERS.md: real note starts in the loved reference sit far above it, a detuned pad's beating sits below. */
export let ONSET_FLOOR = 4;
export const setOnsetFloor = (x: number) => { ONSET_FLOOR = x; };
export const onsets = (chans: Float32Array[], sr: number, delta = 0.07) => onsetsDetail(chans, sr, delta).times;

export const centroid = (chans: Float32Array[], sr: number) => {
  const N = 2048, frames = stft(mono(chans), N, 512); let emax = 0; const es = frames.map((m) => { let e = 0; for (const x of m) e += x * x; emax = Math.max(emax, e); return e; });
  let sum = 0, c = 0, wsum = 0, wtot = 0;
  frames.forEach((m, i) => { if (es[i] < emax * 1e-5) return; let num = 0, den = 0; for (let k = 1; k < m.length; k++) { num += ((k * sr) / N) * m[k]; den += m[k]; } if (den > 0) { sum += num / den; c++; wsum += (num / den) * es[i]; wtot += es[i]; } });
  return { mean: c ? sum / c : 0, energyWeighted: wtot ? wsum / wtot : 0 };
};

export type Meters = { durationS: number; lufs: number; lra: number; shortMax: number; dbtp: number; samplePeakDb: number; onsetsPerS: number; onsetCount: number; centroidHz: number; centroidEnergyHz: number; lastOnsetS: number; shortTerm: number[] };
export const measure = (chans: Float32Array[], sr: number): Meters => {
  const l = loudness(chans, sr), tp = truePeak(chans), on = onsets(chans, sr), c = centroid(chans, sr), dur = chans[0].length / sr;
  return { durationS: dur, lufs: l.integrated, lra: l.lra, shortMax: l.shortMax, dbtp: tp.dbtp, samplePeakDb: tp.samplePeakDb, onsetsPerS: on.length / dur, onsetCount: on.length, centroidHz: c.mean, centroidEnergyHz: c.energyWeighted, lastOnsetS: on.length ? on[on.length - 1] : 0, shortTerm: l.shortTerm };
};
