// "Window Light", a nocturne in A-flat major with F-minor colour. Composed note by note.
//
// THE HOOK is a rising sixth that falls back by step: Eb4 -> C5, Bb4, Ab4. It opens the theme,
// returns a step higher over IV, climbs an octave in bar 5, becomes the climax in bar 10 (Eb5 ->
// C6, the same sixth an octave up) and is said once more, pianissimo, in bar 12.
//
//   bar 0       intro        Ab                         the left hand alone, p
//   bars 1-4    theme (Q)    Ab  Eb/G  Db/F  Eb         bass walks down Ab G F Eb; half cadence
//   bars 5-8    theme (A)    Ab/C  Fm  Db Eb7  Ab       the line climbs to F5 then falls home
//   bars 9-10   build        Fm Db | Eb                 F-minor colour, melody in octaves, f.
//                                                      The octave basses are STAGGERED: they answer
//                                                      an eighth after the melody's downbeat, so the
//                                                      climax C6 strikes alone (the peak stays musical)
//   bar 11      HUSH         Fm                         deceptive: V goes to vi, pp, sudden (~2/3)
//   bars 12-15  coda         Db  Dbm  Bbm7 Eb7  Ab      the hook once more, high and quiet; the Fb
//                                                      of the borrowed iv is the ache; ii-V-I home
//
// The loved reference (Kevin Ngo's Claude piano, NOTES.md) builds ~12 dB to about 2/3 and drops to
// a quiet close; this piece is built on that SHAPE, in its key, with its own tune.
//
// Fitting: the intro is optional (the climax never is), theme+build repeat as a group (variations: the theme
// comes back doubled in octaves, then an octave higher), and under ~25 s the plan falls back to
// its short form, the 8-second phrase, which itself repeats.
import { line, type Piece } from "../plan";

const BPB = 3;
const mel = (t: number, s: string, v = 0.7, pickup?: number) => line(t, s, { role: "melody", v, bpb: BPB, pickup });
const inner = (t: number, s: string, v = 0.7) => line(t, s, { role: "inner", v, bpb: BPB });
const bass = (t: number, s: string, v = 0.7, pickup?: number) => line(t, s, { role: "bass", v, bpb: BPB, roll: 0.03, pickup });
const lh = (t: number, s: string, v = 0.7) => line(t, s, { role: "accomp", v, bpb: BPB, roll: 0.035 });
const H = (xs: [number, string][]) => xs.map(([t, name]) => ({ t, name }));

export const nocturne = (): Piece => {
  const melody = [
    ...mel(2, "Eb4:1", 0.66, 1), // the pickup, in the intro bar
    ...mel(3, [
      "C5:2 Bb4:.5 Ab4:.5", //         1 Ab
      "Bb4:2 Eb4:1", //                2 Eb/G   (Eb4 = the hook's pickup again)
      "Db5:2 C5:.5 Bb4:.5", //         3 Db/F   (the hook a step higher)
      "G4:.5 Ab4:.5 Bb4:1 Eb4:1", //   4 Eb     half cadence on 2 over V
      "Eb5:2 Db5:.5 C5:.5", //         5 Ab/C   (the hook an octave wide)
      "Ab4:1 C5:1 F5:1", //            6 Fm     climbing to the phrase's high point
      "Eb5:1.5 Db5:.5 C5:.5 Bb4:.5", // 7 Db | Eb7  falling home
      "Ab4:2 C5:1", //                 8 Ab     cadence; C5 is the pickup into the build
      "Ab5:1.5 G5:.5 F5:.5 Eb5:.5", // 9 Fm | Db  (octaves below); Eb5 lifts into the climax
      "C6:1.5@0.86 Bb5:.5 Ab5:.5 G5:.5", // 10 Eb   CLIMAX: the hook's sixth, Eb5 -> C6 (a full rolled chord, below)
      "Ab5:2 r:.5 Eb5:.5", //          11 Fm    HUSH (deceptive); Eb5 picks up the hook
      "C6:2 Bb5:.5 Ab5:.5", //         12 Db    the hook, pianissimo, over Db maj7 colour
      "Ab5:1 Fb5:1 Eb5:1", //          13 Dbm   borrowed iv: Fb, the F-minor ache
      "Db5:1.5 C5:.5 Bb4:1", //        14 Bbm7 | Eb7
      "Ab4:3", //                      15 Ab    home
    ].join(" | ")),
  ];
  // octave doubling in the build, softer (an inner voice); the climax C6 itself is NOT doubled
  const octaves = inner(27, "r:1.5 G4:.5 F4:.5 r:.5 | r:1.5 Bb4:.5 Ab4:.5 G4:.5", 0.8); // joins after each downbeat, never on it
  // the climax is a CHORD, not one hammer: C6 on top of a rolled Eb5-Ab5 (C6 over Eb is the sweet 13th).
  // Spreading the climax's energy over three staggered keys keeps its loudness and lowers its peak.
  const climaxChord = line(30, "[Eb5 Ab5]:1.5", { role: "inner", v: 0.62, bpb: BPB, roll: 0.045, pickup: 1.5 });
  const rhInner = [...climaxChord, ...inner(15, "Ab4:2 r:1 | r:3 | F4:1.5 G4:1.5 | Eb4:2 r:1", 0.62), ...inner(45, "[C4 Eb4]:3", 0.55)];
  const bassLine = [
    ...bass(0, [
      "Ab2:3", "Ab2:3", "G2:3", "F2:3", "Eb2:3", //   0-4 (keys held, the pedal sustains)
      "C3:3", "F2:3", "Db2:1.5 Eb2:1.5", "Ab2:3", //  5-8
      "r:.5 [F1 F2]:1@0.78 [Db2 Db3]:1.5@0.74", // 9  the bass ANSWERS: an eighth after the melody's downbeat
      "r:.5 [Eb1 Eb2]:2.5@0.8", //                  10  C6 strikes alone; the Eb octave answers it
      "[F2 C3 Ab3]:3", "[Db2 Ab2 F3]:3", "[Db2 Ab2 Fb3]:3", "[Bb1 F2]:1.5 [Eb2 Bb2]:1.5", "[Ab1 Eb2 Ab2 Eb3 Ab3]:3", // 11-15 rolled
    ].join(" | "), 0.7),
  ];
  const accomp = lh(0, [
    "r:1 Eb3:1 C4:1", "r:1 Eb3:1 C4:1", "r:1 Eb3:1 Bb3:1", "r:1 Db3:1 Ab3:1", "r:1 Bb2:1 G3:1", //   0-4
    "r:.5 Eb3:.5 Ab3:.5 C4:.5 Ab3:.5 Eb3:.5", //  5 Ab/C  eighths: the pulse quickens with the answer
    "r:.5 C3:.5 Ab3:.5 C4:.5 Ab3:.5 C3:.5", //    6 Fm
    "r:.5 Ab2:.5 F3:.5 r:.5 Db3:.5 G3:.5", //     7 Db | Eb7
    "r:.5 Eb3:.5 Ab3:.5 C4:.5 Ab3:.5 Eb3:.5", //  8 Ab
    "r:.5 C3:.5 Ab3:.5 r:.5 Ab2:.5 F3:.5", //     9 Fm | Db
    "r:.5 Bb2:.5 G3:.5 Bb3:.5 G3:.5 Db4:.5", //   10 Eb(7)
    "r:2 C4:1", "r:2 Ab3:1", "r:2 Ab3:1", //       11-13: the hush, single notes
    "r:.5 Db3:.5 Ab3:.5 r:.5 Db3:.5 G3:.5", //    14 Bbm7 | Eb7
    "r:3",
  ].join(" | "), 0.7);
  const harmony = H([[0, "Ab"], [3, "Ab"], [6, "Eb/G"], [9, "Db/F"], [12, "Eb"], [15, "Ab/C"], [18, "Fm"], [21, "Db"], [22.5, "Eb7"], [24, "Ab"],
    [27, "Fm"], [28.5, "Db"], [30, "Eb"], [31.5, "Eb"], [33, "Fm"], [36, "Db"], [39, "Dbm"], [42, "Bbm7"], [43.5, "Eb7"], [45, "Ab"]]);
  return {
    title: "Window Light (nocturne in A-flat)", seed: 1618, tail: 1.6, harmony, shortForm: pianoPhrase8,
    plan: {
      style: "nocturne", tempo: 68, meter: "3/4", phraseBars: 4,
      sections: [
        { id: "intro", bars: 1, mood: "tender", key: "Ab", mode: "major", melody: ["stepwise"], dyn: [0.36, 0.38], optional: true },
        { id: "theme", bars: 8, mood: "tender", key: "Ab", mode: "major", melody: ["hook", "stepwise"], dyn: [0.4, 0.64], repeatable: true, pickup: 1, variations: ["octaveDouble", "octaveUp"] },
        { id: "build", bars: 2, mood: ["tender", "romantic", 0.5], key: "Ab", mode: "major", melody: ["hook", "sequence"], dyn: [0.68, 0.9], repeatable: true, pickup: 1 },
        { id: "coda", bars: 5, mood: ["tender", "melancholy", 0.4], key: "Ab", mode: "major", melody: ["themeTransformation"], dyn: [0.36, 0.28], ending: "tail" },
      ],
    },
    parts: [
      { id: "rh", inst: "piano", role: "melody", notes: [...melody, ...octaves, ...rhInner] },
      { id: "lh", inst: "piano", role: "accomp", notes: [...bassLine, ...accomp] },
    ],
  };
};

/** (a) 8 seconds: the hook and a full cadence, pickup + 2 bars + the final chord. 3/4, 66 bpm. Also the nocturne's short form. */
export const pianoPhrase8 = (): Piece => {
  const m = [...line(-1, "Eb4:1 | C5:2 Bb4:.5 Ab4:.5 | Eb5:1.5 Db5:.5 C5:.5 Bb4:.5 | Ab4:3", { role: "melody", v: 0.72, bpb: 3, pickup: 1 }),
    ...line(6, "[C4 Eb4]:3", { role: "inner", v: 0.55, bpb: 3, roll: 0.02 })];
  const l = [...line(0, "Ab2:3 | Db2:1.5 Eb2:1.5 | [Ab1 Eb2 Ab2 Eb3]:3", { role: "bass", v: 0.7, bpb: 3, roll: 0.03 }),
    ...line(0, "r:1 Eb3:1 C4:1 | r:.5 Ab2:.5 F3:.5 r:.5 Db3:.5 G3:.5 | r:3", { role: "accomp", v: 0.7, bpb: 3 })];
  return {
    title: "Window Light, the phrase", seed: 1618, tail: 1.3,
    harmony: H([[0, "Ab"], [3, "Db"], [4.5, "Eb7"], [6, "Ab"]]),
    plan: { style: "nocturne", tempo: 66, meter: "3/4", pickupBeats: 1, phraseBars: 3, ritard: 0.72, sections: [{ id: "phrase", bars: 3, mood: "tender", key: "Ab", mode: "major", melody: ["hook", "stepwise"], dyn: [0.42, 0.5], ending: "tail", repeatable: true, variations: ["octaveDouble", "octaveUp", "same"] }] },
    parts: [{ id: "rh", inst: "piano", role: "melody", notes: m }, { id: "lh", inst: "piano", role: "accomp", notes: l }],
  };
};
