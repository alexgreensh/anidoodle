// Pitch maths and the MODES table (spec 08 section 3). Pure data and pure functions.
export type ModeId =
  | "major" | "aeolian" | "harmonicMinor" | "melodicMinor" | "dorian" | "phrygian" | "lydian"
  | "mixolydian" | "majorPentatonic" | "minorPentatonic" | "blues" | "wholeTone" | "locrian";

export type Mode = { id: ModeId; intervals: number[]; color: string; use: string; guard: string };

// Intervals are semitones above the tonic. `color` is the degree that makes the mode read as itself.
export const MODES: Record<ModeId, Mode> = {
  major: { id: "major", intervals: [0, 2, 4, 5, 7, 9, 11], color: "3, 7", use: "joy, arrival, sunlight; the music-box default", guard: "section 7 only" },
  aeolian: { id: "aeolian", intervals: [0, 2, 3, 5, 7, 8, 10], color: "b3, b6", use: "sadness, longing, gravity, night", guard: "tonic clarity" },
  harmonicMinor: { id: "harmonicMinor", intervals: [0, 2, 3, 5, 7, 8, 11], color: "raised 7 over V", use: "drama, fate, cadences inside minor", guard: "augmented step b6-7 only as a passing figure, max 2 per phrase" },
  melodicMinor: { id: "melodicMinor", intervals: [0, 2, 3, 5, 7, 9, 11], color: "raised 6 and 7", use: "hopeful minor, yearning lines that climb", guard: "rising lines only; falling lines revert to aeolian" },
  dorian: { id: "dorian", intervals: [0, 2, 3, 5, 7, 9, 10], color: "natural 6", use: "bittersweet, sad but moving forward, folk", guard: "natural 6 in the first 4 bars" },
  phrygian: { id: "phrygian", intervals: [0, 1, 3, 5, 7, 8, 10], color: "b2", use: "menace, heat, the villain's shadow", guard: "b2 resolves to 1 within 2 beats; max 8 bars unless dread" },
  lydian: { id: "lydian", intervals: [0, 2, 4, 6, 7, 9, 11], color: "#4", use: "wonder, flight, magic", guard: "#4 in the first 4 bars; never rest on #4" },
  mixolydian: { id: "mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10], color: "b7", use: "pastoral, easygoing, sunny rock", guard: "b7 in the first 4 bars" },
  majorPentatonic: { id: "majorPentatonic", intervals: [0, 2, 4, 7, 9], color: "no half steps", use: "innocence, lullaby, chiptune melodies", guard: "one non-pentatonic harmony change per 16 bars" },
  minorPentatonic: { id: "minorPentatonic", intervals: [0, 3, 5, 7, 10], color: "b3, b7", use: "cool, soulful, sad without pain", guard: "same 16-bar rule" },
  blues: { id: "blues", intervals: [0, 3, 5, 6, 7, 10], color: "b5", use: "swagger, comedy, jazz and lo-fi colour", guard: "b5 passing only, <= 1/8 note" },
  wholeTone: { id: "wholeTone", intervals: [0, 2, 4, 6, 8, 10], color: "no tonic pull", use: "dream, confusion, magic transition", guard: "max 4 bars, then a real tonic" },
  locrian: { id: "locrian", intervals: [0, 1, 3, 5, 6, 8, 10], color: "b5 over the tonic", use: "never a section mode", guard: "one-bar colour only" },
};

export type PitchClass = "C" | "C#" | "Db" | "D" | "D#" | "Eb" | "E" | "F" | "F#" | "Gb" | "G" | "G#" | "Ab" | "A" | "A#" | "Bb" | "B" | "Cb" | "Fb" | "E#" | "B#";
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "Ab4" -> 68, "C#6" -> 85, "Fb3" -> 52 (spelling kept for readable scores, value is what sounds). */
export const midi = (name: string): number => {
  const m = /^([A-G])(bb|b|#|x)?(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`bad note name "${name}"`);
  const acc = m[2] === "b" ? -1 : m[2] === "bb" ? -2 : m[2] === "#" ? 1 : m[2] === "x" ? 2 : 0;
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + acc;
};
export const pcOf = (name: string): number => { const m = /^([A-G])(bb|b|#|x)?$/.exec(name); if (!m) throw new Error(`bad pitch class "${name}"`); return (PC[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : m[2] === "bb" ? -2 : m[2] === "x" ? 2 : 0) + 12) % 12; };
export const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const nameOf = (m: number, sharp = false) => `${(sharp ? SHARPS : NAMES)[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
/** Spell with sharps in sharp keys, and the raised leading tone of a minor key as a sharp. */
export const spellerFor = (key: string, mode: ModeId) => {
  const t = pcOf(key.replace(/m$/, "")), sharpMajor = [7, 2, 9, 4, 11, 6, 1].includes(t), minor = mode === "aeolian" || mode === "harmonicMinor" || mode === "melodicMinor" || mode === "dorian";
  const sharpKey = minor ? [4, 11, 6, 1, 8].includes(t) : mode === "lydian" ? [0, 7, 2, 9, 4].includes(t) : sharpMajor;
  return (m: number) => nameOf(m, sharpKey || (minor && ((m - t + 12) % 12 === 11)));
};

/** Scale degree (1-based, may exceed the mode length: wraps into higher octaves) to MIDI. */
export const degree = (tonicMidi: number, mode: ModeId, deg: number): number => {
  const iv = MODES[mode].intervals, k = deg - 1, oct = Math.floor(k / iv.length), i = ((k % iv.length) + iv.length) % iv.length;
  return tonicMidi + 12 * oct + iv[i];
};

/** Detect the best-matching key and mode from a duration-weighted pitch-class histogram (spec 08 section 10). */
export const detectMode = (notes: { p: number; d: number }[], modes: ModeId[] = ["major", "aeolian", "dorian", "mixolydian", "lydian", "phrygian"]) => {
  const h = new Array(12).fill(0); for (const n of notes) h[((n.p % 12) + 12) % 12] += n.d;
  const tot = h.reduce((a, b) => a + b, 0) || 1;
  const res: { tonic: string; mode: ModeId; score: number }[] = [];
  for (let t = 0; t < 12; t++) for (const md of modes) {
    const iv = new Set(MODES[md].intervals.map((x) => (x + t) % 12));
    let inS = 0; for (let k = 0; k < 12; k++) if (iv.has(k)) inS += h[k];
    // in-scale share, plus a tonic and fifth weight so relative modes separate
    res.push({ tonic: NAMES[t], mode: md, score: inS / tot + 0.35 * (h[t] / tot) + 0.12 * (h[(t + 7) % 12] / tot) });
  }
  return res.sort((a, b) => b.score - a.score).slice(0, 3);
};
