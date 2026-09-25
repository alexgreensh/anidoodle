// Piece -> performance -> one stem per part -> room -> master. Pure in (piece, sampleRate, opts).
// Gentle styles: one static gain to -16 LUFS, true peak <= -1 dBTP, never a compressor (if the
// ceiling can't be met by gain alone the loudness goes down, spec 08 section 9). Dense styles:
// -14 LUFS through a look-ahead true-peak limiter.
import { type Piece, type Part, resequence, beatsPerBar } from "./plan";
import { perform, type Performance, type Played } from "./perform";
import { renderPiano, PIANO_REAL, type PianoOpts } from "./piano";
import * as I from "./instruments";
import { room, Biquad, db } from "./dsp";
import { loudness, truePeak } from "./meter";
import { STYLES } from "./tables";
import { rng as mkRng } from "../core";

export type RenderOpts = { expressive?: boolean; piano?: PianoOpts; flatVelocity?: number; seconds?: number; tempo?: number; master?: "auto" | "gentle" | "dense" | "none"; stems?: boolean; only?: (p: Part) => boolean };
/** dry = the pre-room mix; wet = the room's late tail (for music-box: its single reflection). Kept so the guards can measure reverb-to-dry per bar. */
export type Rendered = { L: Float32Array; R: Float32Array; perf: Performance; tempo: number; gainDb: number; masterMode: string; stems: Record<string, [Float32Array, Float32Array]>; piece: Piece; dry: [Float32Array, Float32Array]; wet: [Float32Array, Float32Array] };

const voice = (pt: Part, keys: Played[], sr: number, n: number, seed: number) => {
  const o = pt.opts ?? {}, r = mkRng(seed);
  switch (pt.inst) {
    case "musicBox": return I.musicBox(keys, sr, n, o);
    case "bell": return I.bell(keys, sr, n, o);
    case "celesta": return I.celesta(keys, sr, n, o);
    case "marimba": return I.mallets(keys, sr, n, o);
    case "vibes": return I.mallets(keys, sr, n, o, true);
    case "harp": return I.pluck(keys, sr, n, o, r, "harp");
    case "guitar": return I.pluck(keys, sr, n, o, r, "guitar");
    case "strings": return I.strings(keys, sr, n, o, r);
    case "fmBell": return I.fmBell(keys, sr, n, o);
    case "ePiano": return I.ePiano(keys, sr, n, o);
    case "pulse": return I.pulse(keys, sr, n, o);
    case "triangle": return I.triangle(keys, sr, n);
    case "noiseDrum": return I.noiseDrum(keys, sr, n);
    case "kick": return I.kick(keys, sr, n, o);
    case "snare": return I.snare(keys, sr, n, o, r);
    case "hat": return I.hat(keys, sr, n, o, r);
    case "bass": return I.bass(keys, sr, n, o);
    case "vinyl": return I.vinyl(keys, sr, n, o, r);
    default: throw new Error(`no instrument ${pt.inst}`);
  }
};

export const renderPiece = (piece: Piece, sr: number, o: RenderOpts = {}): Rendered => {
  const expressive = o.expressive ?? true, tempo = o.tempo ?? piece.plan.tempo, style = STYLES[piece.plan.style];
  const perf = perform(piece, tempo, { expressive, flatVelocity: o.flatVelocity });
  const n = o.seconds ? Math.round(o.seconds * sr) : Math.ceil((perf.lastOnset + piece.tail) * sr);
  const L = new Float32Array(n), R = new Float32Array(n), haloL = new Float32Array(n), stems: Record<string, [Float32Array, Float32Array]> = {};
  const sends: [Float32Array, Float32Array, number][] = [];
  piece.parts.forEach((pt, pi) => {
    if (o.only && !o.only(pt)) return;
    const keys = perf.parts[pi].keys; if (!keys.length) return;
    let sL: Float32Array, sR: Float32Array;
    if (pt.inst === "piano") { const r = renderPiano(keys, perf.pedal, sr, n, o.piano ?? PIANO_REAL, piece.seed + pi); sL = r.L; sR = r.R; if ((o.piano ?? PIANO_REAL).pedal) for (let i = 0; i < n; i++) haloL[i] += r.halo[i] * db(pt.gainDb ?? 0); }
    else { const r = voice(pt, keys, sr, n, piece.seed * 101 + pi); sL = r.L; sR = r.R; }
    const g = db(pt.gainDb ?? 0);
    if (pt.pan) { const a = Math.max(0, pt.pan), b = Math.max(0, -pt.pan); for (let i = 0; i < n; i++) { sL[i] *= 1 - a * 0.6; sR[i] *= 1 - b * 0.6; } }
    for (let i = 0; i < n; i++) { sL[i] *= g; sR[i] *= g; L[i] += sL[i]; R[i] += sR[i]; }
    if (o.stems) stems[pt.id] = [sL, sR];
    sends.push([sL, sR, pt.send ?? 1]);
  });
  // ---- space
  const rng = mkRng(piece.seed * 7 + 5), dry: [Float32Array, Float32Array] = [Float32Array.from(L), Float32Array.from(R)];
  let wet: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  const sp = piece.plan.space;
  if (style.id === "musicBox" && !sp) { // the recipe: ONE early reflection, 30 ms late, 14 dB down, no tail
    const d = Math.round(0.03 * sr), g = db(-14); for (let i = d; i < n; i++) { wet[0][i] = dry[0][i - d] * g; wet[1][i] = dry[1][i - d] * g * 0.9; L[i] += wet[0][i]; R[i] += wet[1][i]; }
  } else if (style.reverb !== "none" || sp) {
    const sL = new Float32Array(n), sR = new Float32Array(n);
    for (const [a, b, s] of sends) for (let i = 0; i < n; i++) { sL[i] += a[i] * s; sR[i] += b[i] * s; }
    const hall = style.reverb === "hall";
    for (let i = 0; i < n; i++) { sL[i] += haloL[i] * 0.35; sR[i] += haloL[i] * 0.35; } // pedal halo: undamped strings ring into the room
    const [wL, wR, tL, tR] = room(sL, sR, sr, { er: sp?.er ?? (hall ? 0.35 : 0.45), late: sp?.late ?? (hall ? 0.3 : 0.2), rt60: sp?.rt60 ?? (hall ? 2.3 : 1.5), predelay: hall ? 0.035 : 0.022, hp: sp?.hp ?? 300, lp: hall ? 7000 : 6000, seed: piece.seed, rng });
    for (let i = 0; i < n; i++) { L[i] += wL[i]; R[i] += wR[i]; }
    wet = [tL, tR]; // the guards measure the late tail: early reflections (< 40 ms) fuse with the direct sound (precedence effect)
  }
  // ---- master: DC/rumble high-pass (4th-order Butterworth at 30 Hz), lo-fi tone, end fade
  for (const q of [0.5412, 1.3066]) { Biquad.make(sr, "hp", 30, q).run(L); Biquad.make(sr, "hp", 30, q).run(R); }
  if (style.id === "lofi") { for (const c of [L, R]) { Biquad.make(sr, "lp", 8500, 0.6).run(c); Biquad.make(sr, "highshelf", 5000, 0.7, -3).run(c); for (let i = 0; i < n; i++) c[i] = Math.tanh(c[i] * 1.2) / 1.2; } }
  const fade = Math.min(n, Math.round(0.25 * sr)); for (let i = 0; i < fade; i++) { const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / fade); L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  let gainDb = 0, masterMode = o.master ?? "auto";
  if (masterMode === "auto") masterMode = style.master;
  if (masterMode !== "none") {
    const target = masterMode === "dense" ? -14 : -16;
    gainDb = target - loudness([L, R], sr).integrated;
    for (let i = 0; i < n; i++) { L[i] *= db(gainDb); R[i] *= db(gainDb); }
    const tp = truePeak([L, R]).dbtp;
    if (tp > -1) {
      if (masterMode === "gentle") { const cut = tp + 1.05; gainDb -= cut; for (let i = 0; i < n; i++) { L[i] *= db(-cut); R[i] *= db(-cut); } }
      else { limiter(L, R, sr, db(-1.3)); const again = target - loudness([L, R], sr).integrated; if (again > 0) { const g = db(Math.min(again, 1)); for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; } limiter(L, R, sr, db(-1.3)); } }
    }
  }
  return { L, R, perf, tempo, gainDb, masterMode, stems, piece, dry, wet };
};

/** Look-ahead peak limiter (1.5 ms look-ahead, 120 ms release), used by dense styles only. */
const limiter = (L: Float32Array, R: Float32Array, sr: number, ceil: number) => {
  const n = L.length, la = Math.round(0.0015 * sr), rel = Math.exp(-1 / (0.12 * sr)), need = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])) * 1.12; need[i] = a > ceil ? ceil / a : 1; } // 1.12: inter-sample margin
  const g = new Float32Array(n); let cur = 1;
  for (let i = n - 1; i >= 0; i--) { let m = 1; for (let j = i; j < Math.min(n, i + la); j++) m = Math.min(m, need[j]); g[i] = m; }
  for (let i = 0; i < n; i++) { cur = g[i] < cur ? g[i] : 1 - (1 - cur) * rel; if (cur > g[i]) cur = g[i]; L[i] *= cur; R[i] *= cur; }
};

/**
 * Fit a piece to ANY duration. Candidate forms = every subset of `optional` sections dropped x the
 * `repeatable` group (contiguous repeatable sections, with their variations) repeated 0..n times.
 * For each, the tempo that lands the last onset at (seconds - tail) is solved; the form whose tempo
 * sits inside the style's range and closest to the written tempo wins. If no full form fits and the
 * piece has a `shortForm`, that is fitted instead. The tail absorbs the rest. Nothing in a piece
 * hard-codes the film's length.
 */
export const fitToDuration = (piece: Piece, seconds: number): { piece: Piece; tempo: number; order: number[]; form: string } => {
  const st = STYLES[piece.plan.style], T0 = piece.plan.tempo, lo = Math.max(st.tempo[0] * 0.9, T0 * 0.82), hi = Math.min(st.tempo[1] * 1.1, T0 * 1.18);
  const secs = piece.plan.sections, want = seconds - piece.tail;
  const solve = (p: Piece) => { let tempo = T0; for (let k = 0; k < 5; k++) tempo *= perform(p, tempo, { expressive: true }).lastOnset / want; return tempo; };
  const opt = secs.map((s, i) => (s.optional ? i : -1)).filter((i) => i >= 0);
  const grp = secs.map((s, i) => (s.repeatable ? i : -1)).filter((i) => i >= 0);
  let best: { p: Piece; tempo: number; order: number[]; cost: number } | null = null, anyTooShort = false;
  for (let mask = 0; mask < 1 << opt.length; mask++) {
    const dropped = opt.filter((_, j) => mask & (1 << j));
    // ra = extra statements of the first repeatable section in place (A A B), rg = repeats of the whole group (A B A B)
    for (let ra = 0; ra <= (grp.length > 1 ? 2 : 0); ra++) for (let rg = 0; rg <= (grp.length ? 64 : 0); rg++) {
      let order = secs.map((_, i) => i);
      for (let k = 0; k < rg; k++) { const at = order.lastIndexOf(grp[grp.length - 1]); order = [...order.slice(0, at + 1), ...grp, ...order.slice(at + 1)]; }
      for (let k = 0; k < ra; k++) { const at = order.indexOf(grp[0]); order = [...order.slice(0, at + 1), grp[0], ...order.slice(at + 1)]; }
      order = order.filter((i) => !dropped.includes(i));
      if (!order.length) break;
      const p = mask === 0 && ra === 0 && rg === 0 ? piece : resequence(piece, order), tempo = solve(p);
      if (tempo > hi) break; // more repeats only make it longer
      if (tempo < lo) { anyTooShort = true; continue; }
      // dropping music costs more than a tempo nudge; back-to-back restatements cost a little
      const cost = Math.abs(Math.log(tempo / T0)) + 0.06 * dropped.length + 0.01 * rg + 0.025 * ra;
      if (!best || cost < best.cost) best = { p, tempo, order, cost };
    }
  }
  if (best) return { piece: { ...best.p, plan: { ...best.p.plan, tempo: best.tempo } }, tempo: best.tempo, order: best.order, form: "full" };
  if (!anyTooShort && piece.shortForm) { const f = fitToDuration(piece.shortForm(), seconds); return { ...f, form: `short form (${f.form})` }; }
  const tempo = anyTooShort ? lo : hi;
  return { piece: { ...piece, plan: { ...piece.plan, tempo } }, tempo, order: secs.map((_, i) => i), form: anyTooShort ? "full, tail extended" : "full, tail cut" };
};

/** What a Film's `audio(sampleRate)` returns: [L, R] at exactly the film's length. */
export const filmAudio = (piece: Piece, seconds: number) => (sr: number): [Float32Array, Float32Array] => {
  const fit = fitToDuration(piece, seconds), r = renderPiece(fit.piece, sr, { seconds, tempo: fit.tempo });
  return [r.L, r.R];
};
