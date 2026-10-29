// THE DRAWN EXAMPLE'S SCORE. Composed for the drawn launch example's made-up product (a warm, lively tool
// that turns a sentence into a hand-drawn picture) the way a user composes one for their own brief
// (references/music/compose.md). It is a worked example of the format, never a score to reuse: your film's
// music is written for YOUR brief.
//
// The brief as numbers: a 16 to 19 s launch film at 90 bpm in 4/4 (a bar is 2.67 s), cut on the template's
// beat grid. Picture beats: the first prompt typed from frame 0 and Generate pressed at 1.8 s, the word
// page at 4.0 s, the second prompt at 8.0 s and its press at 10.5 s, the end card on bar 5 (13.3 s,
// claimBar 5). The arc: a fingerpicked start under the typing, the tune on the word page, the lift as the
// second answer draws itself, the home chord and the tune's last word on the end card, then a short ring.
// Loudness stays even (a product film is watched with the sound low): the energy moves by layers.
// The motif: a rising sixth and a step back, a sketch of a line being drawn; answered lower, lifted on the
// second answer, and set down whole on the end card.
import type { Material } from "./music";

export const sketchScore = (): Material => ({
  style: "folk", title: "Your Product, sketched", seed: 23, mood: "hopeful",
  bpm: 90, key: "D", mode: "major", meter: "4/4",
  moodControls: { energy: 0.5, warmth: 0.7, brightness: 0.6, tension: 0.3, space: 0.75 },
  swing: 0.52, dyn: [0.6, 0.66], tail: 0, // the held home chord is the ring, released inside the film
  // (the lead is set 2 dB under where it was: the harp's soft layer is recorded about 12 dB hot against its
  // model and the sample loader trims at most 9 dB, so its D5 to A5 tune sat 3 dB hot in the 300 Hz to
  // 1.2 kHz body and crowded it, the sound check's one warning)
  levels: { lead: 0, counter: -6, chords: -2 },
  chords: {
    D: { voicing: "[D3 A3 D4 F#4]", bass: "D2:1.5 A2:.5 D2:1 F#2:1" },
    Bm: { voicing: "[B2 F#3 B3 D4]", bass: "B1:1.5 F#2:.5 B1:1 D2:1" },
    G: { voicing: "[G2 D3 G3 B3]", bass: "G2:1.5 D2:.5 G2:1 B2:1" },
    A: { voicing: "[A2 E3 A3 C#4]", bass: "A2:1.5 E2:.5 A2:1 C#3:1" },
    Em: { voicing: "[E3 G3 B3 D4]", bass: "E2:1.5 B2:.5 E2:2" },
    Asus: { voicing: "[A2 D3 E3 A3]", bass: "A2:4" },
    Home: { voicing: "[D3 A3 D4 F#4 A4]", bass: "D2:4" },
  },
  motifs: {
    open: "r:1 D5:.5 E5:.5 F#5:1 A4:1",
    sketch: "r:.5 A4:.5 F#5:1 E5:.5 D5:.5 B4:1",
    reply: "r:.5 F#4:.5 D5:1 C#5:.5 B4:.5 A4:1",
    lift: "r:.5 B4:.5 G5:1 F#5:.5 E5:.5 D5:1",
    crest: "r:.5 C#5:.5 A5:1.5 G5:.5 E5:1",
    lean: "r:.5 D5:.5 E5:.5 F#5:.5 E5:2",
    last: "A4:1 F#5:1 D5:2",
    ring: "r:1 F#4:1 A4:1 D5:1", // the last bar keeps sounding under the held card: a held chord alone sagged 16 LU (sound check)
    rest: "r:4",
  },
  // brushes under the picking: a light kit that moves without pushing (a drawing tool, not a dance floor)
  grooves: { main: { family: "brushes", density: 0.3, variation: 0.3 } },
  sections: [
    { kind: "intro", bars: 1, harmony: ["D"], lead: ["open"], chordVel: 0.6, energy: 0.5 }, // the tune's first notes under the typing: no hole before the press
    { kind: "verse", bars: 2, harmony: ["Bm", "G"], lead: ["sketch", "reply"], groove: "main", energy: 0.55 },
    { kind: "hook", bars: 2, harmony: ["G A", "Em Asus"], lead: ["lift", "crest"], counter: ["rest", "lean"], bass: ["G2:1.5 D2:.5 A2:1.5 E2:.5", "E2:1.5 B2:.5 A2:2"], groove: "main", energy: 0.6 },
    { kind: "outro", bars: 2, harmony: ["Home", "Home"], lead: ["last", "ring"], groove: "main", energy: 0.6 },
    // the stretch: one more held bar of home, played 0 or more times so the film is whole bars of the score
    { kind: "outro", bars: 1, harmony: ["~"], lead: ["rest"], stretch: true, energy: 0.5 },
  ],
});
