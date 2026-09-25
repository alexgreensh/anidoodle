// First-use samplers for the families that rendered but had no demo, plus the drive/electronic and
// folk/acoustic styles. 8 seconds each (the spec-08 human-listen budget), each a complete musical
// thought with a cadence, each carrying ONE named emotion. Every note written by hand.
import { line, type Piece, type Role } from "../plan";

const L = (t: number, s: string, role: Role, bpb: number, v = 0.7, extra: { roll?: number; kind?: string; pickup?: number } = {}) => line(t, s, { role, v, bpb, ...extra });
const H = (xs: [number, string][]) => xs.map(([t, name]) => ({ t, name }));
const rep = (cell: string, n: number) => Array.from({ length: n }, () => cell).join(" ");

/** Marimba, CURIOUS. D dorian (the B natural is the colour), minimalist: an eighth-note ostinato under a questioning hook. 4/4 at 108. */
export const marimbaCurious = (): Piece => {
  const B = 4;
  const ost = L(0, ["D4:.5 A4:.5 E5:.5 F5:.5 A4:.5 E5:.5 D5:.5 A4:.5", "D4:.5 B4:.5 E5:.5 G5:.5 B4:.5 E5:.5 D5:.5 B4:.5",
    "D4:.5 A4:.5 E5:.5 F5:.5 A4:.5 E5:.5 D5:.5 A4:.5", "[D4 A4]:1"].join(" | "), "accomp", B, 0.55);
  // the hook asks (up to D6, then B natural), answers stepwise down to the tonic
  const hook = L(0, "r:1 A5:.5 C6:.5 D6:1 C6:.5 A5:.5 | B5:1.5 G5:.5 A5:1 r:1 | F5:.5 E5:.5 D5:.5 E5:.5 F5:1 E5:1 | D5:1", "melody", B, 0.8);
  const low = L(0, "D3:2 A2:2 | G2:2 D3:2 | D3:2 A2:2 | D3:1", "bass", B, 0.7);
  return {
    title: "Marimba, curious (D dorian)", seed: 404, tail: 1.2, harmony: H([[0, "Dm"], [4, "G/D"], [8, "Dm"], [12, "Dm"]]),
    plan: { style: "minimalist", tempo: 108, meter: "4/4", ritard: 0.9, sections: [{ id: "a", bars: 4, mood: "curious", key: "D", mode: "dorian", melody: ["ostinato", "hook"], dyn: [0.65, 0.72], ending: "button", repeatable: true }] },
    parts: [
      { id: "ostinato", inst: "marimba", role: "accomp", notes: ost, gainDb: -3 },
      { id: "hook", inst: "marimba", role: "melody", notes: hook, gainDb: 1 },
      { id: "low", inst: "marimba", role: "bass", notes: low, gainDb: -1 },
      { id: "halo", inst: "vibes", role: "color", notes: L(0, "[F4 A4 E5]:4 | [G4 B4 E5]:4 | [F4 A4 E5]:4 | [F4 A4 D5]:1", "color", B, 0.35), gainDb: -12, opts: { trem: 4.5 } },
    ],
  };
};

/** Harp, TENDER. E-flat major lullaby in 6/8 at 66: rolling arpeggios, a rocking melody, I-IV-V7-I. */
export const harpTender = (): Piece => {
  const B = 2, e = (a: string) => a.split(" ").map((n) => `${n}:1/3`).join(" ");
  const arp = L(0, [e("Eb3 Bb3 Eb4 G4 Bb4 G4"), e("Eb3 C4 Ab4 C5 Ab4 Eb4"), e("D3 Bb3 F4 Ab4 F4 Bb3"), e("Eb3 Bb3 Eb4 G4 Bb4 Eb5")].join(" | "), "accomp", B, 0.55);
  const mel = L(0, "G5:1 Bb5:1/3 Ab5:1/3 G5:1/3 | F5:2/3 Eb5:1/3 F5:1/3 Ab5:2/3 | G5:1 F5:1/3 Eb5:1/3 D5:1/3 | Eb5:2", "melody", B, 0.75);
  return {
    title: "Harp, tender (E-flat lullaby)", seed: 55, tail: 1.2, harmony: H([[0, "Eb"], [2, "Ab/Eb"], [4, "Bb7/D"], [6, "Eb"]]),
    plan: { style: "lullaby", tempo: 66, meter: "6/8", sections: [{ id: "a", bars: 4, mood: "tender", key: "Eb", mode: "major", melody: ["arpeggio", "stepwise"], dyn: [0.55, 0.5], ending: "tail", repeatable: true }] },
    parts: [{ id: "arp", inst: "harp", role: "accomp", notes: arp, gainDb: -8 }, { id: "melody", inst: "harp", role: "melody", notes: mel, gainDb: 2 }],
  };
};

/** Guitar (Karplus-Strong), WISTFUL. E dorian fingerpicking, Em - A (the dorian IV) - Em, 4/4 at 84. */
export const guitarWistful = (): Piece => {
  const B = 4;
  const pick = L(0, "E2:.5 G3:.5 B3:.5 E4:.5 B2:.5 G3:.5 B3:.5 E4:.5 | A2:.5 E3:.5 C#4:.5 E4:.5 E2:.5 E3:.5 A3:.5 C#4:.5 | [E2 B2 E3 G3 B3 F#4]:1", "accomp", B, 0.55, { roll: 0.022 });
  const mel = L(0, "B4:1.5 A4:.5 G4:1 F#4:1 | E4:1 C#5:1.5 B4:.5 A4:1 | B4:1", "melody", B, 0.8);
  return {
    title: "Guitar, wistful (E dorian)", seed: 77, tail: 2.0, harmony: H([[0, "Em"], [4, "A"], [8, "Em9"]]),
    plan: { style: "folk", tempo: 84, meter: "4/4", ritard: 0.8, sections: [{ id: "a", bars: 3, mood: "wistful", key: "E", mode: "dorian", melody: ["stepwise"], dyn: [0.6, 0.55], ending: "tail", repeatable: true }] },
    parts: [{ id: "pick", inst: "guitar", role: "accomp", notes: pick, gainDb: -7 }, { id: "melody", inst: "guitar", role: "melody", notes: mel, gainDb: 3 }],
  };
};

/** Celesta, WONDER (curious + awe). F lydian: the B natural of the G/F chord is the magic. 3/4 at 72. */
export const celestaWonder = (): Piece => {
  const B = 3;
  const acc = L(0, "F3:1 [A4 C5]:1 [A4 C5]:1 | F3:1 [G4 B4 D5]:1 [G4 B4 D5]:1 | [F3 C4 A4]:3", "accomp", B, 0.5, { roll: 0.02 });
  const mel = L(0, "C6:.5 A5:.5 F5:.5 A5:.5 C6:.5 E6:.5 | D6:1 B5:1 A5:.5 G5:.5 | A5:3", "melody", B, 0.8);
  return {
    title: "Celesta, wonder (F lydian)", seed: 9, tail: 2.4, harmony: H([[0, "F"], [3, "G/F"], [6, "F"]]),
    plan: { style: "lullaby", tempo: 72, meter: "3/4", sections: [{ id: "a", bars: 3, mood: ["curious", "awe", 0.5], key: "F", mode: "lydian", melody: ["hook", "arpeggio"], dyn: [0.6, 0.55], ending: "tail", repeatable: true }] },
    parts: [{ id: "acc", inst: "celesta", role: "accomp", notes: acc, gainDb: -4 }, { id: "melody", inst: "celesta", role: "melody", notes: mel, gainDb: 1 }],
  };
};

/** FM bell over FM e-piano, HOPEFUL. C major IV-V-vi-V/3 -> I, the bell line climbing in sequence A5 B5 C6 D6 -> E6. 4/4 at 100. */
export const bellsHopeful = (): Piece => {
  const B = 4;
  const bell = L(0, "C5:.5 F5:.5 A5:1 D5:.5 G5:.5 B5:1 | E5:.5 A5:.5 C6:1 D5:.5 G5:.5 D6:1 | E6:2", "melody", B, 0.75);
  const keys = L(0, "[F3 A3 C4 E4]:2 [G3 B3 D4]:2 | [A3 C4 E4]:2 [B2 D4 G4]:2 | [C3 G3 C4 E4]:2", "accomp", B, 0.6, { roll: 0.02 });
  return {
    title: "Bells and e-piano, hopeful (C major)", seed: 31, tail: 2.6, harmony: H([[0, "Fmaj7"], [2, "G"], [4, "Am"], [6, "G/B"], [8, "C"]]),
    plan: { style: "cinematic", tempo: 100, meter: "4/4", ritard: 0.85, sections: [{ id: "a", bars: 3, mood: "hopeful", key: "C", mode: "major", melody: ["sequence"], dyn: [0.5, 0.8], ending: "tail", repeatable: true }] },
    parts: [{ id: "bell", inst: "fmBell", role: "melody", notes: bell, gainDb: 0 }, { id: "keys", inst: "ePiano", role: "accomp", notes: keys, gainDb: -2, opts: { trem: 3.5 } }],
  };
};

/** Drive / electronic, DRIVE. A minor i-VI-III-VII at 128: pluck arps and 8th bass from bar 1, the lead hook drops in at bar 3, a stab button. */
export const driveElectronic = (): Piece => {
  const B = 4, a16 = (x: string) => rep(x.split(" ").map((n) => `${n}:.25`).join(" "), 4);
  const pluckL = L(0, [a16("A4 C5 E5 A5"), a16("F4 A4 C5 F5"), a16("E4 G4 C5 E5"), a16("D4 G4 B4 D5"), "[A4 C5 E5]:.5"].join(" | "), "accomp", B, 0.6);
  const bassL = L(0, [rep("A1:.5 A2:.5", 4), rep("F1:.5 F2:.5", 4), rep("C2:.5 C3:.5", 4), rep("G1:.5 G2:.5", 4), "A1:.5"].join(" | "), "bass", B, 0.85);
  const lead = L(8, "E5:.75 D5:.25 C5:.5 E5:.5 G5:1.5 E5:.5 | D5:.75 C5:.25 B4:.5 D5:.5 G5:1 B4:1 | A5:.5", "melody", B, 0.8);
  const pad = L(0, "[A3 C4 E4]:4 | [F3 A3 C4]:4 | [G3 C4 E4]:4 | [G3 B3 D4]:4", "color", B, 0.45);
  const kick = L(0, [rep("C4:1", 4), rep("C4:1", 4), rep("C4:1", 4), rep("C4:1", 4), "C4:.5"].join(" | "), "drum", B, 0.9);
  const clap = L(0, "r:1 C4:1 r:1 C4:1 | r:1 C4:1 r:1 C4:1 | r:1 C4:1 r:1 C4:1 | r:1 C4:1 r:1 C4:.5 C4:.5", "drum", B, 0.7);
  const hats = L(0, [1, 2, 3, 4].map(() => rep("r:.5 C4:.5", 4)).join(" | "), "drum", B, 0.7, { kind: "o" });
  return {
    title: "Drive / electronic (A minor)", seed: 128, tail: 0.5, harmony: H([[0, "Am"], [4, "F"], [8, "C"], [12, "G"], [16, "Am"]]),
    plan: { style: "drive", tempo: 128, meter: "4/4", ritard: 1, sections: [{ id: "a", bars: 5, mood: "drive", key: "A", mode: "aeolian", melody: ["hook", "arpeggio", "ostinato"], dyn: [0.8, 0.9], ending: "button", repeatable: true }] },
    parts: [
      { id: "pluck", inst: "strings", role: "accomp", notes: pluckL, gainDb: -6, opts: { attack: 0.004, release: 0.09, bright: 1.5, width: 0.9, grid: true } },
      { id: "bass", inst: "bass", role: "bass", notes: bassL, gainDb: -2, opts: { drive: 2.4, grid: true } },
      { id: "lead", inst: "strings", role: "melody", notes: lead, gainDb: 0, opts: { attack: 0.012, release: 0.15, bright: 1.8, width: 0.4, grid: true } },
      { id: "pad", inst: "strings", role: "color", notes: pad, gainDb: -10, opts: { attack: 0.35, release: 0.4, grid: true } },
      { id: "kick", inst: "kick", role: "drum", notes: kick, gainDb: 0, send: 0, opts: { soft: 0.3, grid: true } },
      { id: "clap", inst: "snare", role: "drum", notes: clap, gainDb: -5, send: 0.5, opts: { grid: true } },
      { id: "hat", inst: "hat", role: "drum", notes: hats, gainDb: -9, send: 0.2, opts: { grid: true } },
    ],
  };
};

/** Folk / acoustic, CALM. G mixolydian (F natural on the bVII) in 6/8 at 88: fingerpicked guitar, harp melody, a brushed shaker. */
export const folkCalm = (): Piece => {
  const B = 2, e = (a: string) => a.split(" ").map((n) => `${n}:1/3`).join(" ");
  const pick = L(0, [e("G2 D3 G3 B3 G3 D3"), e("F2 C3 F3 A3 F3 C3"), e("C3 G3 C4 E4 C4 G3"), e("G2 D3 G3 B3 G3 D3"), "[G2 D3 G3 B3 D4 G4]:2"].join(" | "), "accomp", B, 0.55, { roll: 0.02 });
  const mel = L(0, "G4:1/3 B4:1/3 D5:1/3 G5:1 | F5:2/3 E5:1/3 D5:2/3 C5:1/3 | E5:1 C5:1/3 D5:1/3 E5:1/3 | D5:2/3 B4:1/3 A4:2/3 B4:1/3 | G4:2", "melody", B, 0.75);
  const shaker = L(0, [1, 2, 3, 4].map(() => "C4:1/3@1 C4:1/3@.5 C4:1/3@.6 C4:1/3@.9 C4:1/3@.5 C4:1/3@.6").join(" | "), "drum", B, 0.5);
  return {
    title: "Folk, calm (G mixolydian)", seed: 1971, tail: 1.3, harmony: H([[0, "G"], [2, "F"], [4, "C"], [6, "G"], [8, "G"]]),
    plan: { style: "folk", tempo: 88, meter: "6/8", ritard: 0.8, sections: [{ id: "a", bars: 5, mood: "calm", key: "G", mode: "mixolydian", melody: ["stepwise"], dyn: [0.6, 0.55], ending: "tail", repeatable: true }] },
    parts: [
      { id: "pick", inst: "guitar", role: "accomp", notes: pick, gainDb: -5 },
      { id: "melody", inst: "harp", role: "melody", notes: mel, gainDb: 2 },
      { id: "shaker", inst: "hat", role: "drum", notes: shaker, gainDb: -14, send: 0.3 },
    ],
  };
};
