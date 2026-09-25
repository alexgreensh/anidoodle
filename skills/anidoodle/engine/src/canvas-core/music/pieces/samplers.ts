// Five 8-second first-use samplers (spec 08 section 11): one per style x mood, each a complete
// musical thought with a cadence, not a sound-design loop. Every note written by hand.
import { line, type Piece, type Role } from "../plan";

const L = (t: number, s: string, role: Role, bpb: number, v = 0.7, extra: { roll?: number; kind?: string; pickup?: number } = {}) => line(t, s, { role, v, bpb, ...extra });
const H = (xs: [number, string][]) => xs.map(([t, name]) => ({ t, name }));

/** Music box, JOY. D major, 12/8 at 120 (the recipe's own grid), I-IV-V-I, pentatonic hook, bell on the last downbeat. */
export const musicBoxJoy = (): Piece => {
  const B = 4;
  // melody: the hook is a long-short-short skip (F#-A-B-A); bar 2 repeats its rhythm a fourth up, bar 3 answers on the dominant
  const melody = L(0, "F#5:1 A5:2/3 B5:1/3 A5:1 F#5:1 | B5:1 D6:2/3 B5:1/3 G5:2 | A5:1 B5:2/3 A5:1/3 E5:1 C#6:1 | D6:1", "melody", B, 0.75);
  // rolling 1-5-3-5 arpeggio on the triplets (4-note cell over 3-note groups: a gentle hemiola)
  const arpBar = (r: string, f: string, t: string) => Array.from({ length: 12 }, (_, i) => `${[r, f, t, f][i % 4]}:1/3`).join(" ");
  const arp = L(0, [arpBar("D5", "A5", "F#5"), arpBar("D5", "G5", "B5"), arpBar("C#5", "A5", "E5"), "D5:1/3 A5:1/3 F#5:1/3"].join(" | "), "accomp", B, 0.5); // up an octave: brightness
  const bassL = L(0, "D3:2 F#3:2 | G3:2 D3:2 | E3:2 C#3:2 | D3:1", "bass", B, 0.62); // the recipe's bass register, C3-G3
  const sparkle = L(8, "A6:1 B6:2/3 A6:1/3 E6:1 C#7:1 | D7:1", "color", B, 0.3);
  const bell = L(12, "D6:1", "color", B, 0.8);
  return {
    title: "Music box, joy", seed: 7, tail: 2,
    harmony: H([[0, "D"], [4, "G"], [8, "A"], [12, "D"]]),
    plan: { style: "musicBox", tempo: 120, meter: "12/8", ritard: 0.8, sections: [{ id: "a", bars: 4, mood: "joy", key: "D", mode: "major", melody: ["hook", "arpeggio"], dyn: [0.75, 0.85], ending: "button", repeatable: true }] },
    parts: [
      { id: "melody", inst: "musicBox", role: "melody", notes: melody, opts: { grid: true } },
      { id: "arp", inst: "musicBox", role: "accomp", notes: arp, gainDb: -11, opts: { grid: true } },
      { id: "bass", inst: "musicBox", role: "bass", notes: bassL, gainDb: -8, opts: { grid: true } },
      { id: "sparkle", inst: "musicBox", role: "color", notes: sparkle, gainDb: -6, opts: { grid: true } },
      { id: "bell", inst: "bell", role: "color", notes: bell },
    ],
  };
};

/** Piano, MELANCHOLY. D minor, 3/4 at 63. i - iv6 - V7 (harmonic-minor C#) - i. A stepwise line that rises to G5 and sighs home. */
export const minorPianoMelancholy = (): Piece => {
  // the high point G5 (bar 2) strikes alone: its bass Bb2 is anticipated an eighth early and held
  const melody = [...L(0, "D5:1.5 E5:.5 F5:1 | G5:1 F5:.5 E5:.5 C#5:1 | D5:3", "melody", 3, 0.72),
    ...L(0, "r:1 A4:2 | Bb4:2 A4:1 | F4:3", "inner", 3, 0.55)];
  const lh = [...L(0, "D2:2.5 r:.5 | r:2 A2:1 | D2:3", "bass", 3, 0.7), ...L(2.5, "Bb2:2.5", "bass", 3, 0.66, { pickup: 2.5 }),
    ...L(0, "r:.5 A2:.5 F3:.5 A3:.5 D4:.5 r:.5 | r:.5 D3:.5 G3:.5 D3:.5 E3:.5 [G3 C#4]:.5 | r:.5 A2:.5 F3:.5 A3:.5 D4:1", "accomp", 3, 0.7, { roll: 0.02 })];
  return {
    title: "Piano, melancholy (D minor)", seed: 29, tail: 1.8,
    harmony: H([[0, "Dm"], [3, "Gm/Bb"], [5, "A7"], [6, "Dm"]]),
    plan: { style: "nocturne", tempo: 63, meter: "3/4", phraseBars: 3, sections: [{ id: "a", bars: 3, mood: "melancholy", key: "D", mode: "aeolian", melody: ["stepwise"], dyn: [0.4, 0.36], ending: "tail" }] },
    parts: [{ id: "rh", inst: "piano", role: "melody", notes: melody }, { id: "lh", inst: "piano", role: "accomp", notes: lh }],
  };
};

/** Cinematic strings + piano, AWE. C with a lydian II (D/C: the #4 F#) then a chromatic-mediant arrival on E major. 4/4 at 72. */
export const cinematicAwe = (): Piece => {
  const B = 4;
  // strings: Cadd9 -> D/C (the lydian #4, F#, in the top voice) -> E major held through the arrival
  const hi = [...L(0, "[C4 G4 D5 E5]:4 | [D4 A4 F#5]:2", "accomp", B, 0.7), ...L(6, "[E4 B4 E5 G#5]:4", "accomp", B, 0.7)];
  const low = [...L(0, "[C2 C3]:4 | [C2 C3]:2", "bass", B, 0.7), ...L(6, "[E2 E3]:4", "bass", B, 0.7)];
  // harp shimmer: rising eighths over the swell; the piano rolls the arrival chord wide
  const shimmer = L(0, "C5:.5 G5:.5 D6:.5 E6:.5 G6:.5 E6:.5 D6:.5 G5:.5 | D5:.5 A5:.5 E6:.5 F#6:.5 B6:.5 G#6:.5 E6:.5 B5:.5", "color", B, 0.55);
  const arrival = L(6, "[E1 E2 B2 G#3 E4]:2", "bass", B, 0.85, { roll: 0.05 });
  const bell = L(6, "[E6 B6]:2", "color", B, 0.5);
  return {
    title: "Cinematic, awe", seed: 88, tail: 2.6,
    harmony: H([[0, "Cadd9"], [4, "D/C"], [6, "E"]]),
    plan: { style: "cinematic", tempo: 72, meter: "4/4", ritard: 0.85, sections: [{ id: "a", bars: 2, mood: "awe", key: "C", mode: "lydian", melody: ["arpeggio", "drone"], dyn: [0.3, 0.95], ending: "tail" }] },
    parts: [
      { id: "strings", inst: "strings", role: "accomp", notes: hi, opts: { attack: 1.1, release: 1.6, bright: 0.9 }, gainDb: -4 },
      { id: "cellos", inst: "strings", role: "bass", notes: low, opts: { attack: 0.9, release: 1.6, bass: true, bright: 0.6 }, gainDb: -3 },
      { id: "harp", inst: "harp", role: "color", notes: shimmer, gainDb: 2 }, // the shimmer is the rhythm layer (2 onsets a beat): it must be heard
      { id: "piano", inst: "piano", role: "bass", notes: arrival, gainDb: 0 },
      { id: "bell", inst: "fmBell", role: "color", notes: bell, gainDb: -8 },
    ],
  };
};

/** Chiptune, PLAYFUL. C major, 4/4 at 140. Call (bar 1, high) and response (bar 2, low); 16th arps fake the chords; 4 voices. */
export const chiptunePlayful = (): Piece => {
  const B = 4;
  const lead = L(0, "E5:.5 G5:.5 C6:.75 B5:.25 C6:.5 G5:.5 E5:1 | A4:.5 C5:.5 E5:.5 A5:.5 G5:1 E5:1 | F5:.5 A5:.5 C6:.75 B5:.25 A5:.5 F5:.5 D5:1 | G5:.5 B5:.5 D6:.5 B5:.5 G5:.5 A5:.25 B5:.25 r:1 | C6:1.5", "melody", B, 0.85);
  const arp16 = (a: string, b: string, c: string, d: string) => Array.from({ length: 16 }, (_, i) => `${[a, b, c, d][i % 4]}:.25`).join(" ");
  const arps = L(0, [arp16("C4", "E4", "G4", "C5"), arp16("A3", "C4", "E4", "A4"), arp16("F3", "A3", "C4", "F4"), arp16("G3", "B3", "D4", "G4"), "C4:.25 E4:.25 G4:.25 C5:.25"].join(" | "), "accomp", B, 0.55);
  const oct = (a: string, b: string) => Array.from({ length: 8 }, (_, i) => `${i % 2 ? b : a}:.5`).join(" ");
  const tri = L(0, [oct("C2", "C3"), oct("A1", "A2"), oct("F2", "F3"), oct("G2", "G3"), "C2:1.5"].join(" | "), "bass", B, 1);
  const kick = L(0, "C4:1 r:1 C4:.5 C4:.5 r:1 | C4:1 r:1 C4:1 r:1 | C4:1 r:1 C4:.5 C4:.5 r:1 | C4:1 r:1 C4:1 r:1 | C4:1", "drum", B, 0.9, { kind: "k" });
  const snare = L(0, "r:1 C4:1 r:1 C4:1 | r:1 C4:1 r:1 C4:1 | r:1 C4:1 r:1 C4:1 | r:1 C4:1 r:1 C4:.25 C4:.25 C4:.25 C4:.25 | C4:1.5", "drum", B, 0.75, { kind: "s" });
  const hats = L(0, [..."1234"].map(() => Array.from({ length: 8 }, () => "C4:.5").join(" ")).join(" | "), "drum", B, 0.6, { kind: "h" });
  return {
    title: "Chiptune, playful", seed: 1985, tail: 1.1,
    harmony: H([[0, "C"], [4, "Am"], [8, "F"], [12, "G"], [16, "C"]]),
    plan: { style: "chiptune", tempo: 140, meter: "4/4", ritard: 1, sections: [{ id: "a", bars: 5, mood: "playful", key: "C", mode: "major", melody: ["hook", "callResponse"], dyn: [0.8, 0.9], ending: "button", repeatable: true }] },
    parts: [
      { id: "lead", inst: "pulse", role: "melody", notes: lead, opts: { duty: 0.25, pan: -0.15, grid: true } },
      { id: "arp", inst: "pulse", role: "accomp", notes: arps, opts: { duty: 0.125, pan: 0.25, grid: true }, gainDb: -5 },
      { id: "tri", inst: "triangle", role: "bass", notes: tri, gainDb: 1, opts: { grid: true } },
      { id: "noise", inst: "noiseDrum", role: "drum", notes: [...kick, ...snare, ...hats], gainDb: -2, opts: { grid: true } },
    ],
  };
};

/** Lo-fi e-piano, NOSTALGIC. F major, 4/4 at 80, swing 58 %. Fmaj9 - Dm9 | Bbmaj7 - C9sus | Fmaj9. */
export const lofiNostalgic = (): Piece => {
  const B = 4;
  const chords = L(0, "[A3 C4 E4 G4]:1.5 [A3 C4 E4 G4]:.5 [F3 A3 C4 E4]:2 | [A3 D4 F4]:1.5 [A3 D4 F4]:.5 [Bb3 D4 E4 G4]:2 | [A3 C4 E4 G4]:3", "accomp", B, 0.62, { roll: 0.018 });
  const melody = L(0, "r:.5 C5:.5 E5:1 D5:.5 C5:.5 A4:1 | r:.5 F5:.5 D5:1 E5:.5 D5:.5 C5:1 | A4:3", "melody", B, 0.72);
  const bassL = L(0, "F2:1.5 F2:.5 D2:2 | Bb1:1.5 Bb1:.5 C2:2 | F2:3", "bass", B, 0.8);
  const kick = L(0, "C4:1 r:1.5 C4:1 r:.5 | C4:1 r:1.5 C4:1 r:.5 | C4:1", "drum", B, 0.8);
  const rim = L(0, "r:1 C4:1 r:1 C4:1 | r:1 C4:1 r:1 C4:1 | r:1", "drum", B, 0.6);
  const hats = L(0, "C4:.5@1 C4:.5@.6 C4:.5@1 C4:.5@.6 C4:.5@1 C4:.5@.6 C4:.5@1 C4:.5@.6 | C4:.5@1 C4:.5@.6 C4:.5@1 C4:.5@.6 C4:.5@1 C4:.5@.6 C4:.5@1 C4:.5@.7 | C4:.5", "drum", B, 0.55);
  const crackle = L(0, "C4:4 | C4:4 | C4:3", "color", B, 1);
  return {
    title: "Lo-fi, nostalgic", seed: 1978, tail: 2.2,
    harmony: H([[0, "Fmaj9"], [2, "Dm9"], [4, "Bbmaj7"], [6, "C9sus"], [8, "Fmaj9"]]),
    plan: { style: "lofi", tempo: 80, meter: "4/4", swing: 0.58, ritard: 0.85, sections: [{ id: "a", bars: 3, mood: "nostalgic", key: "F", mode: "major", melody: ["stepwise", "hook"], dyn: [0.6, 0.6], ending: "tail", repeatable: true }] },
    parts: [
      { id: "keys", inst: "ePiano", role: "accomp", notes: chords, gainDb: -5, opts: { detune: 5 } },
      { id: "lead", inst: "ePiano", role: "melody", notes: melody, gainDb: 4, opts: { detune: 6, width: 0.2 } },
      { id: "bass", inst: "bass", role: "bass", notes: bassL, gainDb: -2 },
      { id: "kick", inst: "kick", role: "drum", notes: kick, gainDb: -4, send: 0.2 },
      { id: "rim", inst: "snare", role: "drum", notes: rim, opts: { rim: true }, gainDb: -6, send: 0.5 },
      { id: "hat", inst: "hat", role: "drum", notes: hats, gainDb: -8, send: 0.2 },
      { id: "vinyl", inst: "vinyl", role: "color", notes: crackle, gainDb: -2, send: 0 },
    ],
  };
};
