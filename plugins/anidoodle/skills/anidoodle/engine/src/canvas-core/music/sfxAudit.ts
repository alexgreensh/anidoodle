// Sample-level checks for a raw take. Run before any fade or trimming can hide a cut.
export type SfxAudit = { ok: boolean; failures: string[]; peak: number };
export const rerollTake = <T>(seed: number, render: (seed: number) => T, audit: (take: T) => SfxAudit): T => {
  let failures: string[] = [];
  for (let attempt = 0; attempt <= 3; attempt++) {
    const take = render((seed + 1000 * attempt) >>> 0), result = audit(take);
    if (result.ok) return take;
    failures = result.failures;
  }
  throw new Error(`sfx: failed audit after 4 takes: ${failures.join(", ")}`);
};

/** Detect coherent rising tones over 50 ms; noisy air does not have a stable period. */
export const hasRisingGlide = (samples: ArrayLike<number>, sr: number): boolean => {
  const hop = Math.max(1, Math.round(sr * 0.01)), size = Math.max(2, Math.round(sr * 0.02)), freqs: number[] = [];
  for (let start = 0; start + size <= samples.length; start += hop) {
    let best = 0, lagBest = 0, previous = -1, previousLag = 0, rising = false;
    for (let lag = Math.max(2, Math.floor(sr / 3500)); lag <= Math.min(Math.floor(sr / 100), size >> 1); lag++) {
      let ab = 0, aa = 0, bb = 0;
      for (let i = 0; i < size - lag; i += 2) { const a = samples[start + i], b = samples[start + i + lag]; ab += a * b; aa += a * a; bb += b * b; }
      const corr = ab / Math.sqrt(Math.max(aa * bb, 1e-30));
      if (rising && corr < previous && previous > 0.8) { best = previous; lagBest = previousLag; break; }
      rising = corr > previous; previous = corr; previousLag = lag;
    }
    freqs.push(best > 0.8 ? sr / lagBest : 0);
  }
  for (let i = 0; i + 5 < freqs.length; i++) {
    const part = freqs.slice(i, i + 6);
    if (part.every((f, j) => f > 0 && (!j || f >= part[j - 1] * 0.98)) && part[5] / part[0] > Math.pow(2, 4 / 12)) return true;
  }
  return false;
};

export const auditSfx = (channels: readonly ArrayLike<number>[], sr: number, whip = false): SfxAudit => {
  if (!Number.isFinite(sr) || sr <= 0 || !channels.length || !channels[0].length || channels.some(c => c.length !== channels[0].length))
    throw new Error("sfx audit: expected equal, nonempty channels and a positive sample rate");
  const n = channels[0].length, failures: string[] = [];
  let peak = 0, invalid = false;
  for (const c of channels) for (let i = 0; i < n; i++) {
    if (!Number.isFinite(c[i])) invalid = true;
    else peak = Math.max(peak, Math.abs(c[i]));
  }
  if (invalid) failures.push("non-finite samples");
  if (whip && hasRisingGlide(channels[0], sr)) failures.push("rising glide");
  if (peak < 0.001) failures.push("silence"); // -60 dBFS
  if (!peak) return { ok: false, failures, peak };
  const edgeLimit = peak * 0.01; // -40 dB relative to peak
  if (channels.some(c => Math.abs(c[0]) > edgeLimit || Math.abs(c[n - 1]) > edgeLimit)) failures.push("edge");
  if (channels.some(c => { let sum = 0; for (let i = 0; i < n; i++) sum += c[i]; return Math.abs(sum / n) > edgeLimit; })) failures.push("dc");
  // Compare each second difference to its local 10 ms RMS, excluding the sample under test.
  // This catches an isolated discontinuity without treating a high-frequency tone as a click.
  const radius = Math.max(2, Math.round(sr * 0.005));
  let click = false;
  for (const c of channels) {
    const prefix = new Float64Array(n + 1);
    for (let i = 1; i < n - 1; i++) { const d = c[i + 1] - 2 * c[i] + c[i - 1]; prefix[i + 1] = d * d; }
    for (let i = 1; i <= n; i++) prefix[i] += prefix[i - 1];
    for (let i = 1; i < n - 1 && !click; i++) {
      const d = c[i + 1] - 2 * c[i] + c[i - 1], a = Math.max(1, i - radius), b = Math.min(n - 1, i + radius + 1);
      const rms = Math.sqrt(Math.max(0, prefix[b] - prefix[a] - d * d) / Math.max(1, b - a - 1));
      // Very brief physical contacts have a legitimate broadband onset. Require a
      // large sample excursion as well as an unusual second derivative.
      if (Math.abs(c[i]) > peak * 0.5 && Math.abs(d) > peak * 0.5 && Math.abs(d) > rms * Math.pow(10, 18 / 20)) click = true;
    }
  }
  if (click) failures.push("second-difference click");
  const tail = Math.max(1, Math.round(sr * 0.005));
  let tailPeak = 0;
  for (const c of channels) for (let i = Math.max(0, n - tail); i < n; i++) tailPeak = Math.max(tailPeak, Math.abs(c[i]));
  if (tailPeak > peak * Math.pow(10, -45 / 20)) failures.push("truncated tail");
  let first = n, last = -1;
  for (let i = 0; i < n; i++) if (channels.some(c => c[i] !== 0)) { first = Math.min(first, i); last = i; }
  let gap = 0; const gapLimit = Math.max(1, Math.ceil(sr * 0.002));
  for (let i = first; i <= last; i++) {
    gap = channels.every(c => c[i] === 0) ? gap + 1 : 0;
    if (gap >= gapLimit) { failures.push("digital silence gap"); break; }
  }
  return { ok: failures.length === 0, failures, peak };
};
