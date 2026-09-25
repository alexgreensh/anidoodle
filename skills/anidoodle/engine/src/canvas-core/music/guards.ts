// Guards that replace the old bans (spec 08 section 7). Sad music is allowed; formless music is not.
//
//   ghost     formlessness measured by STRUCTURE, never by darkness. Per window (4 bars, or 8 s when
//             the tempo is unknown): onset density, sustained-energy share, reverb-to-dry, cadences.
//             A window fails only when ALL four point at "formless". Works on bare audio (a reference
//             file): unknown reverb or cadence count AGAINST the file, so a reference can only pass on
//             what is measured.
//   masking   while the melody sounds, its 500 Hz-4 kHz band beats every other layer there by >= 3 dB
//             (per bar, on per-role stems)
//   reverb    reverb return >= 10 dB under the dry mix, per bar
// Thresholds are calibrated so the loved reference (Kevin Ngo piano) PASSES and the ghost fixture
// (slow pad, long tail, no rhythm, no cadence) FAILS; see tools/music.mjs `guards`.
import { onsets, mono, loudness } from "./meter";
import { renderPiece, type Rendered } from "./render";
import { pcOf } from "./theory";
import type { Piece, Role } from "./plan";

export const GHOST = { maxOnsetsPerBeat: 1.0, minSustainedShare: 0.6, reverbWithinDb: -12, windowBars: 4, fallbackWindowS: 8 };

/** Share of energy that is "sustained": 50 ms frames that are not decaying like a struck note (fall < 1.5 dB over 250 ms, i.e. slower than 6 dB/s) and not just after an onset. */
const sustainedShare = (m: Float32Array, sr: number, a: number, b: number, ons: number[]) => {
  const hop = Math.round(0.05 * sr), lag = Math.round(0.25 / 0.05);
  const lv: number[] = [], en: number[] = [];
  for (let i = a; i + hop <= b; i += hop) { let e = 0; for (let j = i; j < i + hop; j++) e += m[j] * m[j]; e /= hop; en.push(e); lv.push(10 * Math.log10(e + 1e-12)); }
  const top = Math.max(...lv); let sus = 0, tot = 0;
  for (let k = lag; k < lv.length; k++) {
    if (lv[k] < top - 45) continue;
    const t = (a + k * hop) / sr, recent = ons.some((o) => t - o >= 0 && t - o < 0.15);
    tot += en[k]; if (!recent && lv[k] - lv[k - lag] > -1.5) sus += en[k]; // held or swelling, not decaying like a struck note
  }
  return tot > 0 ? sus / tot : 0;
};

export type GhostWindow = { from: number; to: number; onsetsPerBeat: number; sustainedShare: number; reverbDb: number | null; cadence: boolean | null; fail: boolean };
export const ghostCheck = (chans: Float32Array[], sr: number, o: { bpm?: number; beatsPerBar?: number; wet?: Float32Array[]; dry?: Float32Array[]; cadences?: number[]; breaths?: [number, number][] } = {}) => {
  const m = mono(chans), dur = m.length / sr, ons = onsets(chans, sr);
  const beat = o.bpm ? 60 / o.bpm : 1, win = o.bpm ? GHOST.windowBars * (o.beatsPerBar ?? 4) * beat : GHOST.fallbackWindowS;
  const windows: GhostWindow[] = [];
  for (let t0 = 0; t0 + Math.min(win, dur) <= dur + 1e-9; t0 += win / 2) {
    const t1 = Math.min(dur, t0 + win), a = Math.round(t0 * sr), b = Math.round(t1 * sr);
    const n = ons.filter((x) => x >= t0 && x < t1).length, opb = n / ((t1 - t0) / beat);
    const ss = sustainedShare(m, sr, a, b, ons);
    let rv: number | null = null;
    if (o.wet && o.dry) { let ew = 0, ed = 0; for (let c = 0; c < o.wet.length; c++) for (let i = a; i < b; i++) { ew += o.wet[c][i] ** 2; ed += o.dry[c][i] ** 2; } rv = 10 * Math.log10((ew + 1e-12) / (ed + 1e-12)); }
    const cad = o.cadences ? o.cadences.some((c) => c >= t0 && c < t1) : null;
    const breath = (o.breaths ?? []).some(([x, y]) => x <= t0 && y >= t1);
    const fail = !breath && opb < GHOST.maxOnsetsPerBeat && ss > GHOST.minSustainedShare && (rv === null || rv > GHOST.reverbWithinDb) && cad !== true;
    windows.push({ from: t0, to: t1, onsetsPerBeat: opb, sustainedShare: ss, reverbDb: rv, cadence: cad, fail });
    if (t1 >= dur) break;
  }
  return { pass: !windows.some((w) => w.fail), failures: windows.filter((w) => w.fail).length, windows };
};

/** Cadence arrivals (seconds): the harmony lands on the section tonic from a chord a fifth above (V-I) or a fourth above (IV-I, plagal). */
export const cadenceTimes = (r: Rendered) => {
  const root = (nm: string) => { const m = /^([A-G](?:b|#)?)/.exec(nm); return m ? pcOf(m[1]) : -1; };
  const key = pcOf(r.piece.plan.sections[0].key.replace(/m$/, "")), ch = r.piece.harmony.slice().sort((a, b) => a.t - b.t), out: number[] = [];
  for (let i = 1; i < ch.length; i++) { const a = root(ch[i - 1].name), b = root(ch[i].name); if (b === key && (a === (key + 7) % 12 || a === (key + 5) % 12 || a === (key + 11) % 12)) out.push(r.perf.sec(ch[i].t)); }
  return out;
};

/** Reverb-to-dry per bar (dB). Pass: every sounding bar >= 10 dB under. */
export const reverbCheck = (r: Rendered, sr: number) => {
  const bpb = r.piece.plan.meter === "3/4" ? 3 : r.piece.plan.meter === "6/8" ? 2 : 4, total = r.piece.plan.sections.reduce((a, s) => a + s.bars * bpb, 0), bars: number[] = [];
  for (let b = 0; b < total; b += bpb) {
    const a = Math.round(r.perf.sec(b) * sr), e = Math.min(r.L.length, Math.round(r.perf.sec(b + bpb) * sr)); let ew = 0, ed = 0;
    for (let c = 0; c < 2; c++) for (let i = a; i < e; i++) { ew += r.wet[c][i] ** 2; ed += r.dry[c][i] ** 2; }
    if (ed > 1e-9) bars.push(10 * Math.log10((ew + 1e-12) / ed));
  }
  const worst = Math.max(...bars);
  return { pass: worst <= -10, worstDb: worst, meanDb: bars.reduce((a, b) => a + b, 0) / Math.max(1, bars.length), bars };
};

/** Band energy (dB) of 500 Hz-4 kHz per span, via a 2-pole band-pass pair. */
const bandDb = (L: Float32Array, R: Float32Array, sr: number, spans: [number, number][]) => {
  const x = mono([L, R]), y = new Float32Array(x.length);
  // 2nd-order Butterworth HP at 500 then LP at 4000 (bilinear, simple)
  const biq = (inp: Float32Array, out: Float32Array, type: "hp" | "lp", f: number) => { const w = (2 * Math.PI * f) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Math.SQRT1_2); const b0 = type === "lp" ? (1 - c) / 2 : (1 + c) / 2, b1 = type === "lp" ? 1 - c : -(1 + c), a0 = 1 + al, a1 = -2 * c, a2 = 1 - al; let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < inp.length; i++) { const v = (b0 * inp[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = inp[i]; y2 = y1; y1 = v; out[i] = v; } };
  biq(x, y, "hp", 500); const z = new Float32Array(x.length); biq(y, z, "lp", 4000);
  return spans.map(([a, b]) => { let e = 0; for (let i = Math.round(a * sr); i < Math.min(z.length, Math.round(b * sr)); i++) e += z[i] * z[i]; return 10 * Math.log10(e / Math.max(1, (b - a) * sr) + 1e-15); });
};

/** Masking: per bar where the melody sounds, melody band energy minus the loudest other role's (dB). Pass: >= 3 dB in >= 80 % of those bars. */
export const maskingCheck = (piece: Piece, sr: number, o: { seconds?: number; tempo?: number } = {}) => {
  const roles = [...new Set(piece.parts.flatMap((p) => p.notes.map((n) => n.role)))] as Role[];
  if (!roles.includes("melody")) return null;
  const only = (r: Role) => ({ ...piece, parts: piece.parts.map((p) => ({ ...p, notes: p.notes.filter((n) => n.role === r) })) });
  const base = { seconds: o.seconds, tempo: o.tempo, master: "none" as const };
  const mel = renderPiece(only("melody"), sr, base);
  const bpb = piece.plan.meter === "3/4" ? 3 : piece.plan.meter === "6/8" ? 2 : 4, total = piece.plan.sections.reduce((a, s) => a + s.bars * bpb, 0);
  const spans: [number, number][] = []; for (let b = 0; b < total; b += bpb) spans.push([mel.perf.sec(b), mel.perf.sec(b + bpb)]);
  const melNotes = piece.parts.flatMap((p) => p.notes.filter((n) => n.role === "melody"));
  const sounding = spans.map((_, i) => melNotes.some((n) => n.t < (i + 1) * bpb && n.t + n.d > i * bpb));
  const m = bandDb(mel.L, mel.R, sr, spans);
  const others = roles.filter((r) => r !== "melody").map((r) => { const x = renderPiece(only(r), sr, base); return { role: r, db: bandDb(x.L, x.R, sr, spans) }; });
  const margins = spans.map((_, i) => (sounding[i] ? m[i] - Math.max(...others.map((x) => x.db[i]), -300) : NaN)).filter((x) => Number.isFinite(x));
  const ok = margins.filter((x) => x >= 3).length / Math.max(1, margins.length);
  return { pass: ok >= 0.8, shareOfBarsClear: ok, worstMarginDb: Math.min(...margins), meanMarginDb: margins.reduce((a, b) => a + b, 0) / Math.max(1, margins.length) };
};

/** Everything at once for a rendered piece. */
export const guardReport = (r: Rendered, sr: number, seconds: number, o: { masking?: boolean } = {}) => {
  const bpb = r.piece.plan.meter === "3/4" ? 3 : r.piece.plan.meter === "6/8" ? 2 : 4;
  const ghost = ghostCheck([r.L, r.R], sr, { bpm: r.tempo, beatsPerBar: bpb, wet: r.wet, dry: r.dry, cadences: cadenceTimes(r) });
  return { ghost: { pass: ghost.pass, failures: ghost.failures, windows: ghost.windows.length, minOnsetsPerBeat: Math.min(...ghost.windows.map((w) => w.onsetsPerBeat)), maxSustainedShare: Math.max(...ghost.windows.map((w) => w.sustainedShare)) }, reverb: reverbCheck(r, sr), masking: o.masking === false ? null : maskingCheck(r.piece, sr, { seconds, tempo: r.tempo }), lufs: loudness([r.L, r.R], sr).integrated };
};
