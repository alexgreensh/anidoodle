// Four short-form, optional electronic score starting points; sounds are still composed note by note.
// The base styles provide mastering/space; named grooves and instruments make each arrangement distinct.
import { line, type Piece, type Part, type Note, type Role } from "../plan";
const n = (t: number, pitch: number, d: number, role: Role, v = 0.7): Note => ({ t, p: pitch, d, v, role });
const bar = (at: number, src: string, role: Role, v = 0.7) => line(at, src, { role, v, bpb: 4 });
const drums = (bars: number, pattern: "four" | "shuffle" | "half", swing = 0.5): Part[] => {
  const kick: Note[] = [], snare: Note[] = [], hat: Note[] = [];
  for (let b = 0; b < bars; b++) {
    const t = b * 4;
    const k = pattern === "four" ? [0, 1, 2, 3] : pattern === "shuffle" ? [0, 1.5, 2.75, 3.5] : [0, 2.5];
    k.forEach((beat, i) => kick.push(n(t + beat, 36, 0.1, "drum", i ? 0.62 : 0.85)));
    (pattern === "half" ? [2] : [1, 3]).forEach((beat) => snare.push(n(t + beat, 38, 0.1, "drum", 0.7)));
    if (pattern === "shuffle") snare.push(n(t + 2.5, 38, 0.06, "drum", 0.18));
    for (let i = 0; i < 8; i++) hat.push(n(t + i * 0.5, 42, 0.08, "drum", i % 2 ? 0.28 : 0.5));
  }
  return [
    { id: "kick", role: "drum", inst: "kick", notes: kick, gainDb: -5, send: 0, opts: { grid: true } },
    { id: "snare", role: "drum", inst: "snare", notes: snare, gainDb: -6, send: 0.2, opts: { rim: pattern === "half", grid: true, swing } },
    { id: "hat", role: "drum", inst: "hat", notes: hat, gainDb: -11, send: 0.1, opts: { grid: true, swing } },
  ];
};

/** Warm 9th chords and a half-time beat; per-track swing keeps bass and downbeats steady. */
export const lofiBeat = (): Piece => ({
  title: "Warm lo-fi beat", seed: 97, tail: 1.2,
  harmony: [{ t: 0, name: "Fmaj9" }, { t: 4, name: "Dm9" }, { t: 8, name: "Bbmaj9" }, { t: 12, name: "C9sus" }],
  plan: { style: "lofi", tempo: 84, meter: "4/4", sections: [
    { id: "question", bars: 2, mood: "nostalgic", key: "F", mode: "major", melody: ["hook"], dyn: [0.5, 0.62] },
    { id: "answer", bars: 2, mood: "hopeful", key: "F", mode: "major", melody: ["themeTransformation"], dyn: [0.68, 0.48], ending: "tail", repeatable: true, variations: ["thin", "octaveUp"] },
  ] },
  parts: [
    { id: "keys", inst: "ePiano", role: "accomp", gainDb: -6, opts: { swing: 0.58, detune: 5 }, notes: [
      ...bar(0, "[A3 C4 E4 G4]:2 r:.5 [A3 C4 E4 G4]:1.5 | [A3 C4 E4 F4]:2 r:.5 [A3 D4 F4]:1.5", "accomp", 0.55),
      ...bar(8, "[A3 C4 D4 F4]:2 r:.5 [Bb3 D4 F4 A4]:1.5 | [G3 Bb3 D4 F4]:2 r:.5 [G3 Bb3 D4 E4]:1.5", "accomp", 0.53),
    ] },
    { id: "hook", inst: "ePiano", role: "melody", gainDb: 1, notes: [
      ...bar(0, "r:.5 C5:.5 E5:1 D5:.5 C5:.5 A4:1 | r:.5 C5:.5 D5:1 E5:1 r:1", "melody"),
      ...bar(8, "r:.5 D5:.5 F5:1 E5:.5 D5:.5 C5:1 | r:1 G4:.5 A4:.5 C5:2", "melody"),
    ] },
    { id: "bass", inst: "bass", role: "bass", gainDb: -4, notes: [n(0, 41, 1.5, "bass"), n(4, 38, 1.5, "bass"), n(8, 34, 1.5, "bass"), n(12, 36, 1.5, "bass")] },
    { id: "texture", inst: "vinyl", role: "color", gainDb: -11, send: 0, notes: [n(0, 60, 16, "color", 0.5)] },
    ...drums(4, "half", 0.59),
  ],
});

/** Bright four-on-floor groove; the hook and bass answer a two-bar question. */
export const synthPopHouse = (): Piece => ({
  title: "Synth-pop lift", seed: 122, tail: 0.6,
  harmony: [{ t: 0, name: "C" }, { t: 4, name: "G/B" }, { t: 8, name: "Am" }, { t: 12, name: "Fadd9" }],
  plan: { style: "drive", tempo: 124, meter: "4/4", ritard: 1, sections: [
    { id: "build", bars: 2, mood: "hopeful", key: "C", mode: "major", melody: ["hook"], dyn: [0.45, 0.75] },
    { id: "lift", bars: 2, mood: "triumph", key: "C", mode: "major", melody: ["hook", "sequence"], dyn: [0.85, 0.72], ending: "button", repeatable: true, variations: ["octaveDouble", "thin"] },
  ] },
  parts: [
    { id: "pad", inst: "strings", role: "color", gainDb: -13, opts: { attack: 0.16, release: 0.28, width: 0.7 }, notes: [
      ...bar(0, "[C4 E4 G4]:4 | [B3 D4 G4]:4 | [A3 C4 E4]:4 | [F3 A3 C4 G4]:4", "color", 0.4),
    ] },
    { id: "hook", inst: "strings", role: "melody", gainDb: 1, opts: { attack: 0.008, release: 0.11, bright: 1.6 }, notes: [
      ...bar(0, "G4:.5 C5:.5 E5:1 D5:.5 C5:.5 r:1 | G4:.5 B4:.5 D5:1 B4:1 r:1", "melody"),
      ...bar(8, "E5:.5 A5:.5 C6:1 B5:.5 A5:.5 r:1 | A5:.5 G5:.5 F5:1 E5:2", "melody"),
    ] },
    { id: "bass", inst: "bass", role: "bass", gainDb: -3, opts: { grid: true }, notes: [0, 4, 8, 12].flatMap((t, i) => [0, 1.5, 2.5, 3.5].map((d) => n(t + d, [36, 35, 33, 29][i], 0.35, "bass", 0.73))) },
    ...drums(4, "four"),
  ],
});

/** Sparse displaced drums and minor stabs; no accidental straight four-on-floor. */
export const brokenBeat = (): Piece => ({
  title: "Broken-beat motion", seed: 134, tail: 0.8,
  harmony: [{ t: 0, name: "Dm9" }, { t: 4, name: "G/D" }, { t: 8, name: "Dm9" }, { t: 12, name: "Dm9" }],
  plan: { style: "drive", tempo: 132, meter: "4/4", ritard: 1, sections: [
    { id: "call", bars: 2, mood: "curious", key: "D", mode: "dorian", melody: ["hook"], dyn: [0.54, 0.68] },
    { id: "answer", bars: 2, mood: "drive", key: "D", mode: "dorian", melody: ["themeTransformation"], dyn: [0.7, 0.63], ending: "button", repeatable: true, variations: ["thin", "octaveUp"] },
  ] },
  parts: [
    { id: "stab", inst: "ePiano", role: "accomp", gainDb: -5, opts: { swing: 0.61 }, notes: [
      ...bar(0, "r:.5 [F4 A4 C5 E5]:.5 r:1 [F4 A4 C5 E5]:.5 r:1.5 | r:.5 [G4 B4 D5]:.5 r:1 [G4 B4 D5]:.5 r:1.5", "accomp", 0.52),
      ...bar(8, "r:.5 [F4 A4 C5 E5]:.5 r:1 [F4 A4 C5 E5]:.5 r:1.5 | r:.5 [F4 A4 C5 E5]:.5 r:1 [F4 A4 C5 E5]:.5 r:1.5", "accomp", 0.52),
    ] },
    { id: "hook", inst: "fmBell", role: "melody", gainDb: -2, notes: [
      ...bar(0, "r:1 A4:.5 C5:.5 D5:1 r:1 | r:.5 B4:.5 A4:1 G4:1 r:1", "melody", 0.63),
      ...bar(8, "r:1 C5:.5 D5:.5 F5:1 r:1 | r:.5 E5:.5 D5:1 D5:2", "melody", 0.63),
    ] },
    { id: "bass", inst: "bass", role: "bass", gainDb: -2, notes: [0, 4, 8, 12].flatMap((t, i) => [n(t, [38, 38, 38, 38][i], 0.8, "bass"), n(t + 2.75, [45, 45, 45, 45][i], 0.3, "bass", 0.58)]) },
    ...drums(4, "shuffle", 0.6),
  ],
});

/** Modal pad, sparse pulse and a held breath before the final reveal. */
export const ambientElectronic = (): Piece => ({
  title: "Ambient electronic reveal", seed: 69, tail: 1.4,
  harmony: [{ t: 0, name: "Fmaj9" }, { t: 4, name: "G/F" }, { t: 8, name: "Fmaj9" }, { t: 12, name: "C/F" }],
  plan: { style: "cinematic", tempo: 88, meter: "4/4", sections: [
    { id: "open", bars: 2, mood: "awe", key: "F", mode: "lydian", melody: ["drone", "hook"], dyn: [0.4, 0.65] },
    { id: "arrival", bars: 2, mood: "hopeful", key: "F", mode: "lydian", melody: ["themeTransformation"], dyn: [0.72, 0.48], ending: "tail", repeatable: true, variations: ["thin", "octaveDouble"] },
  ] },
  parts: [
    { id: "pad", inst: "strings", role: "accomp", gainDb: -12, send: 0.6, opts: { attack: 0.55, release: 1.1, width: 0.9 }, notes: [
      ...bar(0, "[F3 A3 C4 E4]:4 | [F3 B3 D4 G4]:4 | [F3 A3 C4 E4]:4 | [F3 G3 C4 E4]:4", "accomp", 0.43),
    ] },
    { id: "theme", inst: "ePiano", role: "melody", gainDb: 1, notes: [
      ...bar(0, "r:1 C5:1 E5:1 r:1 | B4:1 A4:1 r:2", "melody", 0.64),
      ...bar(8, "r:1 E5:1 G5:1 r:1 | B4:1 A4:1 F4:2", "melody", 0.64),
    ] },
    { id: "pedal", inst: "bass", role: "bass", gainDb: -7, notes: [n(0, 41, 3.6, "bass", 0.5), n(4, 41, 3.6, "bass", 0.5), n(8, 41, 3.6, "bass", 0.5), n(12, 41, 3.6, "bass", 0.5)] },
  ],
});
