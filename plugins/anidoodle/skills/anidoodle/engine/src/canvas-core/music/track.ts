// EXTERNAL TRACKS. A supplied or generated piece of music (a Lyria take, a licensed track, a client's
// jingle) measured and cut to a film by numbers, so nobody does it by hand per version again.
//   analyzeTrack   tempo, beat phase, downbeats, the bar grid with each bar's level, sections, key, the
//                  real last-note time and any designed stops. A generative model ignores exact
//                  timestamps in its prompt, so the picture is fitted to what the track really does.
//   parseSegs      a cut list from text, robust to the shapes people write ("0 6\n8 36", "0:6, 8:36",
//                  no final newline: a brand launch film's mix silently lost its last segment to a shell
//                  `while read` loop on a file with no trailing newline).
//   planCut        checks a cut before it is rendered: joins on downbeats, the outro keeps the track's
//                  own ending, no silence after the last note, and the music never ends before the picture.
//   renderCut      the edit, with short centred crossfades so the length is exactly the sum of the segments.
//   trackGrid      the edit's downbeats as a grid that solves holds, so a picture event lands on a bar.
//   pitchSalience  how much a short sound carries a note. Under someone else's music, effects must be
//                  transients, never notes (a brand launch "disharmonious" note).
// Pure functions of sample arrays: no files, no clock. The command line is tools/track.mjs.
import { fft } from "./meter";

export type Stereo = [Float32Array, Float32Array];
export type Bar = { i: number; t: number; rmsDb: number };
export type Section = { fromBar: number; toBar: number; fromS: number; toS: number; level: "silent" | "quiet" | "mid" | "full"; rmsDb: number };
export type TrackAnalysis = {
  sr: number; durationS: number;
  bpm: number; beatS: number; beatsPerBar: number; barS: number;
  /** the strongest tempo peaks with their comb score relative to the winner (1 = the winner); empty when bpm was pinned */
  tempoCandidates: { bpm: number; rel: number }[];
  /** time of the first downbeat at or after 0 (s); earlier material is a pickup */
  downbeatS: number;
  bars: Bar[]; sections: Section[];
  key: { name: string; confidence: number; runnerUp: string };
  /** the median level of the bars that play (dB), the yardstick for everything below */
  bodyDb: number;
  /** when the last note has decayed into silence (s): the track's real end, whatever the file length says */
  lastSoundS: number;
  /** silence in the file after the last note (s) */
  tailS: number;
  /** stretches inside the track that drop out (a designed hard stop), at least 0.2 s long */
  stops: { atS: number; lenS: number }[];
};

const dB = (x: number) => 10 * Math.log10(x + 1e-20);
export const monoOf = (L: Float32Array, R: Float32Array = L) => { const m = new Float32Array(L.length); for (let i = 0; i < L.length; i++) m[i] = 0.5 * (L[i] + R[i]); return m; };

/** Mean power per block of `hop` samples, as dB. */
const levels = (x: Float32Array, hop: number) => {
  const n = Math.floor(x.length / hop), out = new Float64Array(n);
  for (let b = 0; b < n; b++) { let s = 0; for (let i = b * hop; i < (b + 1) * hop; i++) s += x[i] * x[i]; out[b] = dB(s / hop); }
  return out;
};
const median = (a: number[]) => { if (!a.length) return -Infinity; const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };

/** Onset strength at a 5 ms hop: the rise of log energy (full band) and of the low band (the kick), mean removed. */
const onsetCurves = (x: Float32Array, sr: number) => {
  const hop = Math.max(1, Math.round(sr * 0.005)), n = Math.floor(x.length / hop), full = new Float64Array(n), low = new Float64Array(n);
  const k = 1 - Math.exp((-2 * Math.PI * 120) / sr); let lp = 0;
  for (let b = 0; b < n; b++) {
    let s = 0, sl = 0;
    for (let i = b * hop; i < (b + 1) * hop; i++) { lp += k * (x[i] - lp); s += x[i] * x[i]; sl += lp * lp; }
    full[b] = Math.log(1e-9 + s / hop); low[b] = Math.log(1e-9 + sl / hop);
  }
  const flux = (e: Float64Array) => { const o = new Float64Array(n); for (let b = 1; b < n; b++) o[b] = Math.max(0, e[b] - e[b - 1]); let m = 0; for (const v of o) m += v; m /= n || 1; for (let b = 0; b < n; b++) o[b] -= m; return o; };
  return { hopS: hop / sr, full: flux(full), low: flux(low) };
};
/** Mean onset strength on a beat comb of period P hops starting at phase ph (fractional positions, linear read). */
const combAt = (O: Float64Array, P: number, ph: number) => {
  let s = 0, c = 0;
  for (let t = ph; t < O.length - 1; t += P) { const i = Math.floor(t), f = t - i; s += O[i] * (1 - f) + O[i + 1] * f; c++; }
  return c ? s / c : -Infinity;
};
const bestPhase = (O: Float64Array, P: number, step = 1) => { let best = -Infinity, ph = 0; for (let p = 0; p < P; p += step) { const v = combAt(O, P, p); if (v > best) { best = v; ph = p; } } return { ph, score: best }; };

// Krumhansl-Kessler key profiles (major, minor), index 0 = the tonic.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const corr = (a: number[], b: number[]) => { const ma = a.reduce((p, q) => p + q, 0) / a.length, mb = b.reduce((p, q) => p + q, 0) / b.length; let s = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return da && db ? s / Math.sqrt(da * db) : 0; };

/**
 * Pitch-class energy from 55 Hz to 2 kHz: frames of 16384 samples (3 Hz bins at 48 kHz, finer than a
 * semitone at 55 Hz), power of spectral PEAKS only, so a tone's window lobe does not leak into its
 * neighbours (a 4096 frame smeared A into G# and Bb). At most 200 frames, spread over the track.
 */
export const chroma = (x: Float32Array, sr: number) => {
  const N = 16384, out = new Array(12).fill(0), frames = Math.max(1, Math.floor((x.length - N) / (N / 2))), stride = Math.max(1, Math.floor(frames / 200));
  const re = new Float64Array(N), im = new Float64Array(N), win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)), pw = new Float64Array(N / 2);
  for (let f = 0; f < frames; f += stride) {
    const a = f * (N / 2); if (a + N > x.length) break;
    for (let i = 0; i < N; i++) { re[i] = x[a + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) pw[k] = re[k] * re[k] + im[k] * im[k];
    for (let k = Math.max(1, Math.ceil((55 * N) / sr)); k <= Math.floor((2000 * N) / sr); k++) {
      if (!(pw[k] > pw[k - 1] && pw[k] >= pw[k + 1])) continue;
      const d = (0.5 * (pw[k - 1] - pw[k + 1])) / (pw[k - 1] - 2 * pw[k] + pw[k + 1] || 1), hz = ((k + d) * sr) / N; // parabolic peak
      out[((Math.round(12 * Math.log2(hz / 440)) % 12) + 12 + 9) % 12] += Math.sqrt(pw[k]);
    }
  }
  return out as number[];
};
/** The best of the 24 major and minor keys for a chroma vector, with the margin over the runner-up as confidence. */
export const keyOf = (ch: number[]) => {
  const all: { name: string; r: number }[] = [];
  for (let t = 0; t < 12; t++) {
    const rot = (p: number[]) => ch.map((_, i) => p[(i - t + 12) % 12]);
    all.push({ name: NAMES[t], r: corr(ch, rot(KK_MAJOR)) }, { name: NAMES[t] + "m", r: corr(ch, rot(KK_MINOR)) });
  }
  all.sort((a, b) => b.r - a.r);
  return { name: all[0].name, confidence: +(all[0].r - all[1].r).toFixed(3), runnerUp: all[1].name };
};

/**
 * Measure a track. `bpm` pins the tempo when you know it (the prompt asked for 120 and the take obeyed);
 * otherwise it is found between bpmRange by a comb over the onset curve and refined to 0.01 bpm.
 * `downbeatS` pins the bar phase when the ear disagrees with the kick-drum guess.
 */
export const analyzeTrack = (L: Float32Array, R: Float32Array, sr: number, o: { bpm?: number; bpmRange?: [number, number]; beatsPerBar?: number; downbeatS?: number } = {}): TrackAnalysis => {
  if (!Number.isSafeInteger(sr) || sr < 4000) throw new Error(`analyzeTrack: sample rate must be an integer of at least 4000, got ${sr}`);
  if (L.length < sr * 2) throw new Error(`analyzeTrack: the track is ${(L.length / sr).toFixed(2)} s; at least 2 s are needed to find a tempo`);
  const x = monoOf(L, R), durationS = x.length / sr, beatsPerBar = o.beatsPerBar ?? 4, [lo, hi] = o.bpmRange ?? [70, 180];
  if (o.bpm !== undefined && !(o.bpm >= 20 && o.bpm <= 300)) throw new Error(`analyzeTrack: bpm must be 20..300, got ${o.bpm}`);
  const { hopS, full, low } = onsetCurves(x, sr);
  let bpm = o.bpm ?? 0; const coarse: [number, number][] = [];
  if (!bpm) {
    // coarse: every 0.5 bpm, the best phase per tempo; then fine: 0.01 bpm around the winner
    let best = -Infinity;
    for (let b = lo; b <= hi + 1e-9; b += 0.5) { const P = 60 / b / hopS, s = bestPhase(full, P, 2).score; coarse.push([b, s]); if (s > best) { best = s; bpm = b; } }
    let fineBest = -Infinity, fine = bpm;
    for (let b = bpm - 0.6; b <= bpm + 0.6 + 1e-9; b += 0.01) { const P = 60 / b / hopS, s = bestPhase(full, P, 1).score; if (s > fineBest) { fineBest = s; fine = b; } }
    bpm = Math.round(fine * 100) / 100;
  }
  const beatS = 60 / bpm, P = beatS / hopS, barS = beatS * beatsPerBar;
  const beatPh = bestPhase(full, P, 0.25).ph * hopS; // first beat time in [0, beatS)
  let downbeatS = o.downbeatS;
  if (downbeatS === undefined) {
    // the bar's phase: of the beatsPerBar candidate beats, the one where the low band (kick) rises hardest
    let best = -Infinity; downbeatS = beatPh;
    for (let k = 0; k < beatsPerBar; k++) { const t = beatPh + k * beatS, s = combAt(low, barS / hopS, t / hopS) + 0.5 * combAt(full, barS / hopS, t / hopS); if (s > best) { best = s; downbeatS = t; } }
  }
  downbeatS = ((downbeatS % barS) + barS) % barS;
  // bars and their levels
  const bars: Bar[] = [];
  for (let i = 0, t = downbeatS; t < durationS - 1e-6; i++, t = downbeatS + i * barS) {
    const a = Math.floor(t * sr), b = Math.min(x.length, Math.floor((t + barS) * sr)); let s = 0; for (let j = a; j < b; j++) s += x[j] * x[j];
    bars.push({ i, t: +t.toFixed(4), rmsDb: +dB(s / Math.max(1, b - a)).toFixed(1) });
  }
  const bodyDb = median(bars.filter((b) => b.rmsDb > -70).map((b) => b.rmsDb));
  const cls = (v: number): Section["level"] => (v < bodyDb - 30 ? "silent" : v < bodyDb - 9 ? "quiet" : v < bodyDb - 3 ? "mid" : "full");
  const sections: Section[] = [];
  for (const b of bars) {
    const c = cls(b.rmsDb), last = sections[sections.length - 1];
    if (last && last.level === c) { last.toBar = b.i + 1; last.toS = +Math.min(durationS, b.t + barS).toFixed(3); last.rmsDb = Math.max(last.rmsDb, b.rmsDb); }
    else sections.push({ fromBar: b.i, toBar: b.i + 1, fromS: b.t, toS: +Math.min(durationS, b.t + barS).toFixed(3), level: c, rmsDb: b.rmsDb });
  }
  // the real end and the stops, on 50 ms blocks against the body level
  const blk = Math.round(sr * 0.05), lv = levels(x, blk), body50 = median([...lv].filter((v) => v > -70));
  let last = lv.length - 1; while (last >= 0 && lv[last] < body50 - 40) last--;
  const lastSoundS = +(((last + 1) * blk) / sr).toFixed(3), stops: TrackAnalysis["stops"] = [];
  let first = 0; while (first < lv.length && lv[first] < body50 - 40) first++;
  for (let b = first; b <= last; ) { if (lv[b] >= body50 - 30) { b++; continue; } const a = b; while (b <= last && lv[b] < body50 - 30) b++; const len = ((b - a) * blk) / sr; if (len >= 0.2) stops.push({ atS: +((a * blk) / sr).toFixed(2), lenS: +len.toFixed(2) }); }
  const peaks = coarse.filter(([, v], i) => v > (coarse[i - 1]?.[1] ?? -Infinity) && v >= (coarse[i + 1]?.[1] ?? -Infinity)).sort((p, q) => q[1] - p[1]).slice(0, 4);
  const tempoCandidates = peaks.map(([b, v]) => ({ bpm: b, rel: +(v / (peaks[0][1] || 1)).toFixed(3) }));
  return { sr, durationS: +durationS.toFixed(3), bpm, tempoCandidates, beatS: +beatS.toFixed(5), beatsPerBar, barS: +barS.toFixed(5), downbeatS: +downbeatS.toFixed(4), bars, sections, key: keyOf(chroma(x, sr)), bodyDb: +bodyDb.toFixed(1), lastSoundS, tailS: +Math.max(0, durationS - lastSoundS).toFixed(3), stops };
};

// ------------------------------------------------------------------------------------------- cutting
export type Seg = { from: number; to: number };
/**
 * A cut list from text. Accepts one segment per line ("8 36"), comma lists ("0:6, 8:36", "0-6"),
 * comments after #, CRLF, and no final newline. Bars ("bars 0-2, 4-17": whole bars, end exclusive)
 * need the analysis. Anything else throws with the line it could not read.
 */
export const parseSegs = (text: string, a?: Pick<TrackAnalysis, "downbeatS" | "barS">): Seg[] => {
  const body = text.replace(/#.*$/gm, "").trim();
  if (!body) throw new Error("cut: the segment list is empty");
  const bars = /^bars\b/i.test(body), parts = body.replace(/^bars\b/i, "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  if (bars && !a) throw new Error("cut: a bar list needs the track's analysis (tempo and downbeat)");
  return parts.map((p) => {
    const m = /^(-?\d+(?:\.\d+)?)\s*(?:[\s:\-]|to)\s*(-?\d+(?:\.\d+)?)$/.exec(p.replace(/\s+/g, " "));
    if (!m) throw new Error(`cut: cannot read segment "${p}" (write "from to" in seconds, or "bars a-b")`);
    const x = Number(m[1]), y = Number(m[2]);
    return bars ? { from: +(a!.downbeatS + x * a!.barS).toFixed(4), to: +(a!.downbeatS + y * a!.barS).toFixed(4) } : { from: x, to: y };
  });
};

export type CutPlan = {
  segs: Seg[]; lengthS: number;
  /** each join: where it falls in the edit, and how far each side is from a downbeat (ms) */
  joins: { atS: number; fromOffMs: number; toOffMs: number }[];
  /** the edit's downbeats (s), for trackGrid */
  downbeats: number[];
  /** the track's designed stops as they fall in the edit (s): declared silences, so the shape check does not call them holes */
  quiet: { fromS: number; toS: number; reason: string }[];
  errors: string[]; warnings: string[];
};
const offBar = (a: Pick<TrackAnalysis, "downbeatS" | "barS">, t: number) => { const k = Math.round((t - a.downbeatS) / a.barS); return { ms: (t - (a.downbeatS + k * a.barS)) * 1000, bar: k, at: a.downbeatS + k * a.barS }; };
/**
 * Check a cut against the track before rendering it. Errors (refuse): a segment outside the file, a join
 * off a downbeat by more than `barTolMs`, an outro that stops before the track's last note (unless the
 * film fades it on purpose with `fadeOutS`), a segment that carries silence from after the last note,
 * and an edit shorter than the picture. Warnings: an edit that runs past the picture (the mux cuts it).
 */
export const planCut = (a: TrackAnalysis, segs: Seg[], o: { filmS?: number; barTolMs?: number; fadeOutS?: number; endTolS?: number } = {}): CutPlan => {
  const errors: string[] = [], warnings: string[] = [], tol = o.barTolMs ?? 30, endTol = o.endTolS ?? 0.5; // the same half second filmshape allows at the end; a shipped brand-launch v12 ended 0.72 s past the last note and fails it
  if (!segs.length) errors.push("the cut has no segments");
  segs.forEach((s, i) => {
    const where = `segment ${i + 1} (${s.from}-${s.to} s)`;
    if (!(Number.isFinite(s.from) && Number.isFinite(s.to)) || s.to <= s.from) errors.push(`${where} has no length`);
    if (s.from < 0 || s.to > a.durationS + 1e-6) errors.push(`${where} lies outside the track (0-${a.durationS} s)`);
    // the first segment may start at 0 (a pickup), the last may end at the track's own end; every join sits on a bar
    if (i > 0 || s.from > 0.05) { const b = offBar(a, s.from); if (Math.abs(b.ms) > tol) errors.push(`${where} starts ${b.ms.toFixed(0)} ms off a downbeat: start at bar ${b.bar} (${b.at.toFixed(3)} s)`); }
    if (i < segs.length - 1) { const b = offBar(a, s.to); if (Math.abs(b.ms) > tol) errors.push(`${where} ends ${b.ms.toFixed(0)} ms off a downbeat: end at bar ${b.bar} (${b.at.toFixed(3)} s)`); }
    if (s.to > a.lastSoundS + endTol) errors.push(`${where} runs ${(s.to - a.lastSoundS).toFixed(2)} s past the track's last note at ${a.lastSoundS} s, so the edit carries silence; end it at ${a.lastSoundS} s (a brand launch film went silent 4 s early this way)`);
  });
  const lastSeg = segs[segs.length - 1];
  if (lastSeg && lastSeg.to < a.lastSoundS - 0.05 && !(o.fadeOutS && o.fadeOutS > 0)) errors.push(`the outro stops at ${lastSeg.to} s, before the track's last note at ${a.lastSoundS} s: end the last segment on the track's own ending (cut whole bars earlier instead), or fade it on purpose with fadeOutS`);
  const lengthS = segs.reduce((p, s) => p + (s.to - s.from), 0);
  if (o.filmS !== undefined) {
    // where the music is last heard in the edit: the last segment's own end, or the track's last note if that comes first
    const soundEnd = lastSeg ? lengthS - (lastSeg.to - Math.min(lastSeg.to, Math.max(lastSeg.from, a.lastSoundS))) : 0;
    if (soundEnd < o.filmS - 0.5) errors.push(`the music is last heard at ${soundEnd.toFixed(2)} s of the edit and the picture runs to ${o.filmS.toFixed(2)} s: ${(o.filmS - soundEnd).toFixed(2)} s of silence at the end; add ${Math.ceil((o.filmS - soundEnd) / a.barS)} bar(s) before the outro, or end the picture with the music`);
    else if (soundEnd > o.filmS + 0.5) { const over = soundEnd - o.filmS, bars = Math.floor(over / a.barS); warnings.push(`the music plays ${over.toFixed(2)} s past the picture; the mux would cut its ending mid-note: ${bars ? `drop ${bars} bar(s) before the outro, or ` : ""}extend the last shot by ${over.toFixed(2)} s`); }
  }
  const joins: CutPlan["joins"] = [], downbeats: number[] = [], quiet: CutPlan["quiet"] = [];
  let at = 0;
  segs.forEach((s, i) => {
    if (i > 0) joins.push({ atS: +at.toFixed(4), fromOffMs: +offBar(a, segs[i - 1].to).ms.toFixed(1), toOffMs: +offBar(a, s.from).ms.toFixed(1) });
    for (const b of a.bars) if (b.t >= s.from - 1e-6 && b.t < s.to - 1e-6) downbeats.push(+(at + b.t - s.from).toFixed(4));
    for (const st of a.stops) { const x = Math.max(st.atS, s.from), y = Math.min(st.atS + st.lenS, s.to); if (y > x) quiet.push({ fromS: +Math.max(0, at + x - s.from - 0.1).toFixed(3), toS: +(at + y - s.from + 0.1).toFixed(3), reason: `the track's own stop at ${st.atS} s` }); }
    at += s.to - s.from;
  });
  return { segs, lengthS: +lengthS.toFixed(4), joins, downbeats, quiet, errors, warnings };
};

/**
 * Render a cut. Each join is a centred equal-power crossfade of `xfadeMs` (default 12): the outgoing
 * segment runs half a fade past its end and the incoming one starts half a fade early, so the edit is
 * exactly the sum of the segments and every bar stays where planCut said it is. `fadeOutS` fades the end.
 */
export const renderCut = (L: Float32Array, R: Float32Array, sr: number, segs: Seg[], o: { xfadeMs?: number; fadeOutS?: number } = {}): Stereo => {
  const h = Math.round(((o.xfadeMs ?? 12) / 1000) * sr / 2), total = segs.reduce((p, s) => p + Math.round(s.to * sr) - Math.round(s.from * sr), 0);
  const oL = new Float32Array(total), oR = new Float32Array(total);
  let at = 0;
  segs.forEach((s, i) => {
    const a = Math.round(s.from * sr), b = Math.round(s.to * sr), pre = i > 0 ? h : 0, post = i < segs.length - 1 ? h : 0;
    for (let j = -pre; j < b - a + post; j++) {
      const src = a + j, dst = at + j; if (src < 0 || src >= L.length || dst < 0 || dst >= total) continue;
      let g = 1;
      if (j < pre) g = Math.sin((Math.PI / 2) * ((j + pre) / (2 * pre || 1))); // fade in across the join
      if (j >= b - a - post) g *= Math.cos((Math.PI / 2) * ((j - (b - a - post)) / (2 * post || 1))); // fade out across the next join
      oL[dst] += L[src] * g; oR[dst] += R[src] * g;
    }
    at += b - a;
  });
  if (o.fadeOutS && o.fadeOutS > 0) { const n = Math.min(total, Math.round(o.fadeOutS * sr)); for (let i = 0; i < n; i++) { const g = Math.sin((Math.PI / 2) * (i / n)); oL[total - 1 - i] *= g; oR[total - 1 - i] *= g; } }
  return [oL, oR];
};

// ------------------------------------------------------------------------------------------- the grid
/**
 * The edit's bar grid, to fit flexible holds to the music (a brand launch film's holds were solved by hand
 * bisection per version). holdTo(startS, minS) is the shortest hold of at least minS whose end lands
 * on a downbeat; landOn(t) is the downbeat nearest t.
 */
export const trackGrid = (downbeats: number[], fps?: number) => {
  if (!downbeats.length) throw new Error("trackGrid: no downbeats (analyse the track, or plan the cut first)");
  const sorted = [...downbeats].sort((a, b) => a - b);
  const next = (t: number) => sorted.find((d) => d >= t - 1e-9);
  return {
    downbeats: sorted,
    landOn: (t: number) => sorted.reduce((p, d) => (Math.abs(d - t) < Math.abs(p - t) ? d : p), sorted[0]),
    holdTo: (startS: number, minS: number) => {
      const d = next(startS + minS);
      if (d === undefined) throw new Error(`trackGrid: no downbeat after ${(startS + minS).toFixed(2)} s; the music ends at bar ${sorted.length}`);
      return { holdS: +(d - startS).toFixed(4), landS: d, bar: sorted.indexOf(d), frame: fps ? Math.round(d * fps) : undefined };
    },
  };
};

// ------------------------------------------------------------------------------------------- pitch
/**
 * How much a short sound carries a note, 0..1: the normalised autocorrelation's highest peak between
 * 90 Hz and 2 kHz (past the first zero crossing, so the broad lobe of noise does not count), scaled by
 * how long the sound rings within 20 dB of its peak, against 60 ms. Calibrated on real sounds: the
 * a brand launch kit the director approved (strikes cut to 8-22 ms, a 174 ms boom) measures 0.07 to 0.45; full
 * notes from the sound pack (marimba, glockenspiel, harp, tubular bell, 150 ms and longer) measure 0.77
 * to 0.98. Below 90 Hz a boom reads as weight, not a note. Over 0.5 under someone else's music fails.
 */
export const pitchSalience = (x: Float32Array, sr: number, o: { fMin?: number; fMax?: number; ringMs?: number } = {}) => {
  let pk = 0, at = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > pk) { pk = Math.abs(x[i]); at = i; }
  if (pk < 1e-6) return { salience: 0, hz: NaN, ringMs: 0, raw: 0 };
  // ring: how long the 2 ms envelope stays within 20 dB of the peak, from the peak on
  const w = Math.max(1, Math.round(sr * 0.002)), floor = pk * 0.1; let end = at;
  for (let i = at; i < x.length; i += w) { let m = 0; for (let j = i; j < Math.min(x.length, i + w); j++) m = Math.max(m, Math.abs(x[j])); if (m >= floor) end = i + w; else break; }
  const ringMs = ((end - at) / sr) * 1000;
  // autocorrelation over the ringing part (at most 120 ms)
  const a = Math.max(0, at - Math.round(sr * 0.002)), b = Math.min(x.length, Math.max(end, a + Math.round(sr * 0.01)), a + Math.round(sr * 0.12)), n = b - a;
  const lagMin = Math.max(1, Math.floor(sr / (o.fMax ?? 2000))), lagMax = Math.min(n - 1, Math.ceil(sr / (o.fMin ?? 90)));
  let r0 = 0; for (let i = a; i < b; i++) r0 += x[i] * x[i];
  if (r0 <= 0 || lagMax <= lagMin) return { salience: 0, hz: NaN, ringMs, raw: 0 };
  const r = (lag: number) => { let s = 0; for (let i = a; i + lag < b; i++) s += x[i] * x[i + lag]; return s / r0; };
  let lag = 1; while (lag < lagMax && r(lag) > 0) lag++; // past the main lobe
  let raw = 0, best = NaN;
  for (let L = Math.max(lag, lagMin); L <= lagMax; L++) { const v = r(L); if (v > raw) { raw = v; best = L; } }
  const salience = raw * Math.min(1, ringMs / (o.ringMs ?? 60));
  return { salience: +salience.toFixed(3), hz: Number.isFinite(best) ? +(sr / best).toFixed(1) : NaN, ringMs: +ringMs.toFixed(1), raw: +raw.toFixed(3) };
};
export const PITCHED = 0.5;

/** When the music in a mix stops being audible (s), on 50 ms blocks against its own body level. */
export const lastSoundOf = (L: Float32Array, R: Float32Array, sr: number, belowBodyDb = 40) => {
  const blk = Math.round(sr * 0.05), lv = levels(monoOf(L, R), blk), body = median([...lv].filter((v) => v > -70));
  if (!Number.isFinite(body)) return 0;
  let last = lv.length - 1; while (last >= 0 && lv[last] < body - belowBodyDb) last--;
  return ((last + 1) * blk) / sr;
};

/**
 * Each effect in an effects stem (silent between cues) with its pitch salience: an effect starts where
 * the 2 ms peak envelope rises out of silence (2 % of the stem's peak) after at least 20 ms below it,
 * and is measured up to the next effect or 400 ms. For soundcheck --sfx on a film over an external track.
 */
export const stemCues = (L: Float32Array, R: Float32Array, sr: number) => {
  const x = monoOf(L, R), hop = Math.max(1, Math.round(sr * 0.002)), n = Math.floor(x.length / hop), env = new Float64Array(n);
  let peak = 0;
  for (let b = 0; b < n; b++) { let m = 0; for (let i = b * hop; i < (b + 1) * hop; i++) m = Math.max(m, Math.abs(x[i])); env[b] = m; peak = Math.max(peak, m); }
  const thr = peak * 0.02, on: number[] = []; let below = 10;
  for (let b = 0; b < n; b++) { if (env[b] <= thr) { below++; continue; } if (below >= 10) on.push(b); below = 0; }
  return on.map((b, k) => { const a = b * hop, e = Math.min(x.length, (on[k + 1] ?? n) * hop, a + Math.round(sr * 0.4)); return { atS: +(a / sr).toFixed(3), ...pitchSalience(x.subarray(a, e), sr) }; });
};
