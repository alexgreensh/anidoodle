// SOUND FOR THE OWL LESSON (social cut): a composed score plus pencil foley, mixed and mastered
// in code. No samples. Pure in (plan, sampleRate).
//
// THE SCORE. Style minimalist (interlocking ostinato + a hook), mood curious, G major, 4/4 at
// 100 bpm, so one beat is exactly 18 frames at 30 fps and every step of the drawing starts on a
// beat. All parts are on the grid (no rubato, no ritard): the picture is cut to this clock, so the
// clock may not breathe. Form, written by hand:
//   hook card  1 bar   marimba ostinato alone (the question before the drawing starts)
//   drawing    8-bar cycle, restated: G | Em | C | D (question, ends on A, off the tonic) |
//              G | Em | Am D | G (answer, lands on the tonic). Odd cycles the plucked "pizzicato"
//              (Karplus-Strong guitar, damped) carries the hook; even cycles the marimba does.
//              The bar before the reveal is a D7 run up to the leading tone.
//   steps      one celesta ping on each step's first beat, climbing the G major scale (G5 .. A6):
//              you hear the lesson progress
//   reveal     "da-DAH": [D5 F#5 A5] half a beat early, then a rolled G major chord on marimba and
//              pluck with a bell on top, on the beat the finished owl is shown
//   end card   one bar of rising G arpeggio, then a soft G chord to ring out
// FOLEY. Every mark in the schedule is a pencil stroke: band-passed noise (3.4 kHz graphite
// scratch, a grain modulation for the paper's tooth) gated by that mark's own start and end, a
// 6 ms attack and a 30 ms lift, panned by where the mark sits across the page. Construction lines
// are softer, hatching is scratchier, the kneaded eraser is a low 700 Hz rub. Mixed 15 dB under
// the music (loudness to loudness), so it is felt more than heard.
// MASTER: one static gain to -16 LUFS integrated; if the true peak is over -1 dBTP the gain comes
// down (gentle rule: loudness gives way, never a compressor).
import { rng } from "./core";
import { line, renderPiece, loudness, truePeak, type Note, type Part, type Piece, type Role } from "./music";
import { Biquad, db, gauss, onePoleCoef, pan } from "./music/dsp";

export type FoleyEvent = { t0: number; t1: number; kind: "guide" | "line" | "fill" | "correction" | "erase"; x: number };
export type OwlSoundPlan = { bpm: number; seconds: number; stepBeats: number[]; revealBeat: number; endBeat: number; foley: FoleyEvent[] };

const bar = (t: number, src: string, role: Role, v: number, roll?: number) => line(t, src, { role, v, bpb: 4, roll });
const eighths = (names: string) => names.split(" ").map((n) => `${n}:.5`).join(" ");
type Bar = { ost: string; mel: string; bass: string };
const G: Bar = { ost: "G3 D4 G4 B4 D4 G4 B4 D4", mel: "r:.5 D5:.5 G5:.5 A5:.5 B5:1 G5:1", bass: "G2:2 D3:2" };
const CYCLE: Bar[] = [
  G,
  { ost: "E3 B3 E4 G4 B3 E4 G4 B3", mel: "E5:.5 G5:.5 B5:1 A5:.5 G5:.5 E5:1", bass: "E2:2 B2:2" },
  { ost: "C3 G3 C4 E4 G3 C4 E4 G3", mel: "C5:.5 E5:.5 G5:.5 E5:.5 A5:1 G5:1", bass: "C3:2 G2:2" },
  { ost: "D3 A3 D4 F#4 A3 D4 F#4 A3", mel: "F#5:.5 E5:.5 D5:1 A4:1 r:1", bass: "D3:2 A2:2" },
  { ...G, mel: "r:.5 D5:.5 G5:.5 A5:.5 B5:1 D6:1" },
  { ost: "E3 B3 E4 G4 B3 E4 G4 B3", mel: "C6:.5 B5:.5 G5:1 E5:.5 G5:.5 B5:1", bass: "E2:2 B2:2" },
  { ost: "A2 E3 A3 C4 D3 A3 D4 F#4", mel: "A5:.5 C6:.5 B5:.5 A5:.5 F#5:1 A5:1", bass: "A2:2 D3:2" },
  { ...G, mel: "G5:2 r:2" },
];
const D7: Bar = { ost: "D3 A3 C4 F#4 A3 C4 F#4 A4", mel: "F#5:.5 G5:.5 A5:.5 B5:.5 C6:.5 B5:.5 A5:.5 F#5:.5", bass: "D3:2 A2:2" };
const PINGS = ["G5", "A5", "B5", "C6", "D6", "E6", "F#6", "G6", "A6"];

export const owlPiece = (sp: OwlSoundPlan): Piece => {
  const R = sp.revealBeat, cut = R - 0.5, ost: Note[] = [], bass: Note[] = [], pl: Note[] = [], mar: Note[] = [], ping: Note[] = [], bell: Note[] = [];
  const keep = (ns: Note[]) => ns.filter((n) => n.t < cut - 1e-6);
  // hook card: the ostinato alone
  ost.push(...bar(0, eighths(G.ost), "accomp", 0.5)); bass.push(...bar(0, "G2:4", "bass", 0.55));
  // the drawing: the cycle restated, alternating the hook's instrument; D7 into the reveal
  const lastBar = Math.floor((cut - 1e-6) / 4) * 4;
  for (let b = 4, k = 0; b < cut; b += 4, k++) {
    const B = b === lastBar ? D7 : CYCLE[k % 8], cyc = Math.floor(k / 8);
    ost.push(...keep(bar(b, eighths(B.ost), "accomp", 0.55)));
    bass.push(...keep(bar(b, B.bass, "bass", 0.62)));
    (cyc % 2 === 0 ? pl : mar).push(...keep(bar(b, B.mel, "melody", 0.8)));
  }
  sp.stepBeats.forEach((b, i) => ping.push(...bar(b, `${PINGS[Math.min(i, PINGS.length - 1)]}:1`, "color", 0.62)));
  // da-DAH
  pl.push(...bar(cut, "[D5 F#5 A5]:.5", "melody", 0.75));
  // peaks are a composing problem: the chord is rolled upward (a strum, not a slab), the bass lands an
  // eighth late and the bell a sixteenth late, so no two loud attacks share a sample
  mar.push(...bar(R, "[G3 D4 B4]:4", "melody", 0.64, 0.03)); pl.push(...bar(R, "[G4 D5 G5]:2 r:2", "melody", 0.78, 0.036)); // no doubled notes between the two
  bass.push(...bar(R, "r:.5 G2:3.5", "bass", 0.72)); bell.push(...bar(R, "r:.25 G6:3.75", "color", 0.66));
  // end card: a rising arpeggio, then the chord rings out
  const E = sp.endBeat;
  ost.push(...bar(E, eighths("G3 B3 D4 G4 B4 D5 G5 B5"), "accomp", 0.5));
  mar.push(...bar(E + 4, "[G3 D4 G4 B4]:3", "melody", 0.55)); pl.push(...bar(E + 4, "G5:3", "melody", 0.5)); bass.push(...bar(E + 4, "G2:3", "bass", 0.5));
  const grid = { grid: true };
  const parts: Part[] = [
    { id: "ostinato", inst: "marimba", role: "accomp", notes: ost, gainDb: -6, opts: grid },
    { id: "bass", inst: "marimba", role: "bass", notes: bass, gainDb: -3, opts: grid },
    { id: "pizz", inst: "guitar", role: "melody", notes: pl, gainDb: 1, opts: grid, pan: -0.15 },
    { id: "hook", inst: "marimba", role: "melody", notes: mar, gainDb: -1, opts: grid, pan: 0.15 },
    { id: "steps", inst: "celesta", role: "color", notes: ping, gainDb: -5, opts: grid, pan: 0.25 },
    { id: "tada", inst: "bell", role: "color", notes: bell, gainDb: -7, opts: grid },
  ];
  const bars = Math.ceil((E + 7) / 4);
  return {
    title: "How to draw an owl (social cut)", seed: 1109, tail: 1.5, harmony: [],
    plan: { style: "minimalist", tempo: sp.bpm, meter: "4/4", rubato: 0, ritard: 1, sections: [{ id: "all", bars, mood: "curious", key: "G", mode: "major", melody: ["ostinato", "hook"], dyn: [0.62, 0.7], ending: "button" }] },
    parts,
  };
};

// ---------------------------------------------------------------- foley
const foley = (sp: OwlSoundPlan, sr: number): [Float32Array, Float32Array] => {
  const n = Math.round(sp.seconds * sr), env = new Float32Array(n), envE = new Float32Array(n), px = new Float32Array(n).fill(0.5);
  const att = Math.round(0.006 * sr), rel = 0.03 * sr, AMP = { guide: 0.5, line: 0.85, fill: 1, correction: 0.85, erase: 0 } as const;
  for (const ev of sp.foley) {
    const i0 = Math.round(ev.t0 * sr), i1 = Math.max(i0 + att, Math.round(ev.t1 * sr)), a = ev.kind === "erase" ? 0.8 : AMP[ev.kind], tgt = ev.kind === "erase" ? envE : env;
    for (let i = Math.max(0, i0); i < Math.min(n, i1 + Math.round(rel * 5)); i++) { const g = i < i0 + att ? (i - i0) / att : i <= i1 ? 1 : Math.exp(-(i - i1) / rel); const v = a * g; if (v > tgt[i]) { tgt[i] = v; px[i] = ev.x; } }
  }
  const r = rng(4242), L = new Float32Array(n), Rr = new Float32Array(n);
  const bp = Biquad.make(sr, "bp", 3400, 0.7), hp = Biquad.make(sr, "hp", 1200, 0.7), rub = Biquad.make(sr, "bp", 700, 0.6), gc = onePoleCoef(sr, 45);
  let grain = 0;
  for (let i = 0; i < n; i++) {
    const w = gauss(r), w2 = gauss(r); grain += gc * (Math.abs(w2) - grain); // the tooth: a slow random flutter under the scratch
    const s = hp.tick(bp.tick(w)) * env[i] * (0.35 + 1.1 * grain) + rub.tick(w2) * envE[i] * 0.6;
    const [gl, gr] = pan((px[i] - 0.5) * 0.8); L[i] = s * gl; Rr[i] = s * gr;
  }
  return [L, Rr];
};

export const owlSocialAudio = (sp: OwlSoundPlan) => (sr: number): [Float32Array, Float32Array] => {
  const m = renderPiece(owlPiece(sp), sr, { seconds: sp.seconds, tempo: sp.bpm, master: "none" }), [fL, fR] = foley(sp, sr), n = m.L.length;
  const lm = loudness([m.L, m.R], sr).integrated, lf = loudness([fL, fR], sr).integrated, fg = db(lm - 15 - lf);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = m.L[i] + fL[i] * fg; R[i] = m.R[i] + fR[i] * fg; }
  let g = db(-16 - loudness([L, R], sr).integrated); for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  const tp = truePeak([L, R]).dbtp; if (tp > -1) { g = db(-1.05 - tp); for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; } }
  return [L, R];
};
