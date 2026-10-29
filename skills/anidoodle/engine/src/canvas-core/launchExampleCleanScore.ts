// THE EXAMPLE'S SCORE. Composed for the clean launch example's made-up product (a calm, confident
// bookkeeping app) the way a user composes one for their own brief (references/music/compose.md). It is
// a worked example of the format, never a score to reuse: your film's music is written for YOUR brief.
//
// The brief as numbers: a 21 s launch film at 90 bpm in 4/4 (a bar is 2.67 s), cut on the template's
// beat grid. Picture beats: the ask typed from frame 0, the word page at 4.0 s, the books screen at
// 6.7 s, the reports screen on bar 4 (10.7 s), the end card on bar 6 (16.0 s, claimBar 6).
// The arc: a quiet start under the typing, the groove as the screens work, a breath on bar 5, the
// home chord and the motif's last word on the end card, then a short ring. Loudness stays even (a
// product film is watched with the sound low), so the energy moves by layers more than by level.
// The motif: an upbeat start, a third up, then steps home; answered a step lower, sequenced up,
// lifted to its peak on the reports screen, fragmented in the breath, augmented at the end.
import type { Material } from "./music";

export const tallyScore = (): Material => ({
  style: "lofiElectronic", title: "Tally, balanced", seed: 41, mood: "hopeful",
  bpm: 90, key: "A", mode: "major", meter: "4/4",
  moodControls: { energy: 0.45, warmth: 0.55, brightness: 0.7, tension: 0.35, space: 0.85 },
  swing: 0.53, dyn: [0.6, 0.64], tail: 0, // no ring bar: the held home chord is the ring, released inside the film
  // the warm bass, not the round sub: a bed under a voice-free film needs body, not rumble
  voices: { bass: "warm", lead: "bell" },
  levels: { lead: 2, counter: -6, chords: -3, kick: -2 }, // the answering line sits under the tune, never over it
  chords: {
    A: { voicing: "[G#3 B3 C#4 E4]", bass: "A2:1.5 E3:.5 A2:1 C#3:1" },
    Fsm: { voicing: "[E3 A3 C#4 G#4]", bass: "F#2:1.5 C#3:.5 F#2:.5 r:.5 A2:1" },
    D: { voicing: "[F#3 A3 C#4 E4]", bass: "D3:1.5 A2:.5 D3:1 E3:1" },
    E: { voicing: "[E3 A3 B3 D4]", bass: "E3:1.5 B2:.5 E3:1 r:1" },
    Bm: { voicing: "[E3 A3 C#4 D4]", bass: "B2:1.5 F#3:.5 B2:2" },
    Esus: { voicing: "[E3 A3 B3 D4]", bass: "E3:4" },
    Home: { voicing: "[E3 G#3 C#4 E4]", bass: "A2:4" },
  },
  motifs: {
    state: "r:.5 C#5:.5 E5:1 D5:.5 C#5:.5 B4:1",
    answer: "r:.5 B4:.5 D5:1 C#5:.5 B4:.5 A4:1",
    rise: "r:.5 D5:.5 F#5:1 E5:.5 D5:.5 C#5:1",
    peak: "r:.5 E5:.5 A5:1.5 G#5:.5 E5:1",
    lean: "r:.5 C#5:.5 E5:.5 F#5:.5 E5:2",
    breath: "r:.5 C#5:.5 E5:1 r:.5 D5:.5 B4:1",
    last: "C#5:1 E5:1 A4:2",
    rest: "r:4",
  },
  grooves: { main: { family: "bounce", density: 0.35, variation: 0.3 }, half: { family: "halfTime", density: 0.3 } },
  sections: [
    { kind: "intro", bars: 1, harmony: ["A"], chordVel: 0.55, energy: 0.45 },
    { kind: "groove", bars: 2, harmony: ["Fsm", "D"], lead: ["state", "answer"], groove: "main", energy: 0.5 },
    { kind: "hook", bars: 2, harmony: ["A", "E"], lead: ["peak", "lean"], counter: ["rise", "rest"], groove: "main", energy: 0.58 },
    { kind: "half", bars: 1, harmony: ["Bm Esus"], lead: ["breath"], bass: ["B2:1.5 F#3:.5 E3:1.5 r:.5"], groove: "half", energy: 0.5 },
    { kind: "outro", bars: 2, harmony: ["Home", "~"], lead: ["last", "rest"], comp: ["x:4", "~:2 r:2"], energy: 0.6 },
    // the stretch: one more held bar of home, played 0 or more times so the film is whole bars of the score
    { kind: "outro", bars: 1, harmony: ["~"], lead: ["rest"], stretch: true, energy: 0.5 },
  ],
});
