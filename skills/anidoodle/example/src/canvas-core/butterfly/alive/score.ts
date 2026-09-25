// THE SCORE (spec section 8, rewritten on note: a real piece, not a sound design pass).
// Pure maths into two Float32Arrays. No Web Audio, no samples, no Node: as deterministic as the
// picture, and it runs under any backend.
//
// ONE THEME carries the whole film, and the whole film is in a MAJOR key. The note was: it was
// reading sad and eerie, which was the minor mode doing exactly what the minor mode does. Act 1 is
// curious and mechanical but SUNNY: a music box in C major, sparse and bright, which ends on the
// dominant so the question is still open without ever being mournful. The come-alive warms it with
// a harp and a low pad; the bloom opens it out; the meadow answers it home. Nothing anywhere is
// minor except two passing chords that make the major ones taste sweeter.
//
//   frames    0-540   C major   Act 1. Music box and a clockwork ostinato, ending open on G
//   frames  540-1200  C major   the come-alive and the bloom: harp, warm pad, a counter-line
//   frame  1200       C MAJOR   the meadow. Plagal turn, perfect cadence, DING on 1365
import { DING, LANDINGS, SIPS, TAKEOFFS } from "./cues";

const OFF = 540, FPS = 30, BEAT = 15, BAR = 60;
export const atFrame = (filmFrame: number, sr: number) => Math.round((filmFrame / FPS) * sr);

const HZ: Record<string, number> = {
  C2: 65.41, G2: 98.0, Ab2: 103.83, Bb2: 116.54, C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.0, Ab3: 207.65, A3: 220.0, Bb3: 233.08,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.0, Ab4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 784.0, Ab5: 830.61, A5: 880.0, Bb5: 932.33, C6: 1046.5, Eb6: 1244.51, G6: 1568.0,
};
// root, and the triad over it. The harmony is a real progression, not a drone.
const CHORD: Record<string, [string, string[]]> = {
  C: ["C3", ["C4", "E4", "G4"]], F: ["F3", ["F4", "A4", "C5"]], G: ["G3", ["G4", "B4", "D5"]],
  Am: ["A3", ["A4", "C5", "E5"]], Dm: ["D3", ["D4", "F4", "A4"]], C2nd: ["C3", ["D4", "E4", "G4"]],
};
// film frame -> chord. The meadow lands on C MAJOR exactly on 1410, which is local 870.
const PROG: [number, string][] = [
  [0, "C"], [120, "F"], [180, "G"], [240, "C"], [300, "Am"], [360, "F"], [420, "G"],
  [540, "C"], [600, "F"], [660, "C2nd"], [720, "G"], [780, "C"], [840, "F"], [900, "Dm"],
  [960, "G"], [1020, "C"], [1080, "F"], [1140, "G"],
  [1200, "C"], [1260, "F"], [1320, "Am"], [1350, "G"], [1365, "C"],
];
const chordAt = (f: number) => { let c = PROG[0][1]; for (const [s, ch] of PROG) if (f >= s) c = ch; return c; };

// THE THEME: eight notes, in semitones above the tonic, with its rhythm in beats. The only
// difference between the minor statement and the major answer is the third.
const THEME_MAJ = [0, 4, 7, 5, 4, 0, 2, 4]; // the only mode this film is in
const RHYTHM = [1, 1, 2, 1, 1, 2, 1, 3];

export const aliveScore = (frames: number) => (sr: number): [Float32Array, Float32Array] => {
  const n = Math.ceil((frames / FPS) * sr), L = new Float32Array(n), R = new Float32Array(n);
  const put = (i0: number, len: number, fn: (t: number) => number, pan: number, gain: number) => {
    for (let i = 0; i < len; i++) { const j = i0 + i; if (j < 0 || j >= n) continue; const v = fn(i / sr) * gain; L[j] += v * (1 - pan); R[j] += v * pan; }
  };
  // ---- the instruments. Each one is a different way of making a note start and stop, which is
  // all an instrument is once you have the harmony right.
  const box = (fr: number, hz: number, g = 0.3, pan = 0.5, ring = 2.2) => put(atFrame(fr, sr), Math.floor(ring * sr), (t) => {
    const e = Math.exp(-t * 2.8) * Math.min(1, t * 900);
    return (Math.sin(6.283 * hz * t) + 0.4 * Math.sin(6.283 * hz * 2.76 * t) * Math.exp(-t * 6) + 0.18 * Math.sin(6.283 * hz * 5.4 * t) * Math.exp(-t * 11)) * e * 0.5;
  }, pan, g);
  const harp = (fr: number, hz: number, g = 0.22, pan = 0.5, ring = 2.6) => put(atFrame(fr, sr), Math.floor(ring * sr), (t) => {
    const e = Math.exp(-t * 1.9) * Math.min(1, t * 500);
    return (Math.sin(6.283 * hz * t) + 0.34 * Math.sin(6.283 * hz * 2 * t) * Math.exp(-t * 3) + 0.14 * Math.sin(6.283 * hz * 3 * t) * Math.exp(-t * 5)) * e * 0.5;
  }, pan, g);
  const pad = (fr: number, hz: number, lenFr: number, g = 0.1, pan = 0.5) => { const len = Math.floor((lenFr / FPS) * sr); put(atFrame(fr, sr), len, (t) => {
    const u = t / (len / sr), e = Math.min(1, u * 5) * Math.min(1, (1 - u) * 4), vib = 1 + 0.0016 * Math.sin(6.283 * 4.2 * t);
    let v = Math.sin(6.283 * hz * t * vib) * 1.5; for (let k = 2; k <= 4; k++) v += Math.sin(6.283 * hz * k * t * vib) / (k * k * 0.85);
    return v * e * 0.26;
  }, pan, g); };
  const bass = (fr: number, hz: number, lenFr: number, g = 0.16) => { const len = Math.floor((lenFr / FPS) * sr); put(atFrame(fr, sr), len, (t) => {
    const u = t / (len / sr), e = Math.min(1, u * 8) * Math.min(1, (1 - u) * 3);
    return (Math.sin(6.283 * hz * t) + 0.3 * Math.sin(6.283 * hz * 2 * t) + 0.12 * Math.sin(6.283 * hz * 3 * t)) * e * 0.42;
  }, 0.5, g); };
  const bell = (fr: number, hz: number, g = 0.3) => put(atFrame(fr, sr), Math.floor(4.5 * sr), (t) => {
    const e = Math.exp(-t * 1.0) * Math.min(1, t * 700);
    return (Math.sin(6.283 * hz * t) + 0.5 * Math.sin(6.283 * hz * 2.0 * t) * Math.exp(-t * 1.6) + 0.3 * Math.sin(6.283 * hz * 2.76 * t) * Math.exp(-t * 2.4) + 0.16 * Math.sin(6.283 * hz * 5.4 * t) * Math.exp(-t * 4)) * e * 0.5;
  }, 0.5, g);
  const tick = (fr: number, g: number) => put(atFrame(fr, sr), Math.floor(0.04 * sr), (t) => (Math.sin(6.283 * 2100 * t) * 0.55 + Math.sin(6.283 * 3300 * t) * 0.45) * Math.exp(-t * 170), 0.46, g);
  const flutter = (fr: number, g: number, sd: number) => { let s = (sd * 2654435761) >>> 0; put(atFrame(fr, sr), Math.floor(0.15 * sr), (t) => { s = (s * 1664525 + 1013904223) >>> 0; return ((s / 4294967296) * 2 - 1) * Math.exp(-t * 24) * (0.35 + 0.65 * Math.sin(6.283 * 95 * t)); }, 0.5, g); };
  const water = (fr: number, g: number) => put(atFrame(fr, sr), Math.floor(0.6 * sr), (t) => Math.sin(6.283 * (600 + 850 * t) * t) * Math.exp(-t * 6.5) * Math.min(1, t * 500), 0.52, g);
  const heart = (fr: number, g: number) => put(atFrame(fr, sr), Math.floor(0.36 * sr), (t) => (Math.sin(6.283 * 56 * t) + 0.4 * Math.sin(6.283 * 112 * t)) * Math.exp(-t * 8.5) * Math.min(1, t * 180), 0.5, g);

  const semis = (hz: number, s: number) => hz * Math.pow(2, s / 12);
  // one statement of the theme, on whatever instrument and in whichever mode
  const theme = (start: number, tonic: number, major: boolean, voice: (fr: number, hz: number, g: number, pan: number) => void, g: number, stretch = 1, pan = 0.5) => {
    const T = THEME_MAJ; let fr = start;
    T.forEach((s, i) => { voice(fr, semis(tonic, s), g * (i === 0 || i === 2 ? 1 : 0.82), pan + (i % 2 ? 0.06 : -0.06)); fr += RHYTHM[i] * BEAT * stretch; });
    return fr;
  };

  // ================================================================ ACT 1: curious, mechanical
  // A clockwork ostinato under a music box, and the theme stated twice in C minor. The act ends
  // on the DOMINANT and stays there: the question the whole rest of the film answers.
  for (let f = 0; f < 540; f += BEAT / 2) { const ch = CHORD[chordAt(f)][1], k = (f / (BEAT / 2)) % 3; box(f, HZ[ch[k]] * 2, 0.07, 0.3 + 0.4 * ((f / BEAT) % 2), 0.9); } /* the escapement, ticking through the harmony */
  for (let f = 0; f < 540; f += BAR) { const c = chordAt(f); bass(f, HZ[CHORD[c][0]], BAR, 0.14); pad(f, HZ[CHORD[c][1][1]], BAR, 0.045, 0.62); }
  theme(30, HZ.C5, true, (fr, hz, g, pan) => box(fr, hz, g, pan), 0.28);
  theme(240, HZ.C5, true, (fr, hz, g, pan) => box(fr, hz, g, pan), 0.26);
  box(420, HZ.G5, 0.24, 0.42, 3); box(450, HZ.D5, 0.2, 0.58, 3); box(480, HZ.B4, 0.24, 0.5, 4); box(480, HZ.G4, 0.2, 0.5, 4); /* it asks, and leaves it open */
  pad(420, HZ.G3, 120, 0.075, 0.5); pad(420, HZ.D4, 120, 0.05, 0.36); pad(420, HZ.B4, 120, 0.035, 0.66);

  // ================================================================ MOVEMENT 2
  water(OFF + 5, 0.3);
  for (let fr = 0; fr < 240; fr += 5) { const thin = fr < 180 ? 1 : 1 - (fr - 180) / 60; if (thin > 0) tick(OFF + fr, 0.16 * thin); } /* the tick thins to a wing-flutter and is gone by 240 */
  [180, 210, 230].forEach((a, k) => { for (let j = 0; j < 3; j++) flutter(OFF + a + j * (30 - k * 10), 0.085 + k * 0.02, a + j); });

  // the come-alive: the theme returns at HALF SPEED and warm, on a harp, over a real bass line
  for (let f = 540; f < 1200; f += BAR) { const c = chordAt(f); bass(f, HZ[CHORD[c][0]], BAR, 0.155); CHORD[c][1].forEach((nm, k) => pad(f, HZ[nm], BAR, 0.05 - k * 0.008, 0.28 + k * 0.22)); }
  theme(OFF + 15, HZ.C4, true, (fr, hz, g, pan) => harp(fr, hz, g, pan, 3.2), 0.2, 2, 0.44);
  theme(OFF + 255, HZ.C5, true, (fr, hz, g, pan) => harp(fr, hz, g, pan, 2.8), 0.18, 1.5, 0.56); /* it lifts an octave as the creature does */

  // the BLOOM: E flat major, the relative major. Same theme, opened out, with a counter-line
  // moving against it in thirds, which is the sound of a world arriving.
  theme(1020, HZ.F4, true, (fr, hz, g, pan) => harp(fr, hz, g, pan, 3.4), 0.2, 1.5, 0.4);
  theme(1020 + 8, HZ.A4, true, (fr, hz, g, pan) => harp(fr, hz, g * 0.6, pan, 3), 0.17, 1.5, 0.64);
    [1110, 1125, 1140, 1170].forEach((f, k) => harp(f, [HZ.G5, HZ.F5, HZ.E5, HZ.D5][k], 0.15, 0.3 + k * 0.12, 2.4));
  pad(1140, HZ.G3, 60, 0.09, 0.5); pad(1140, HZ.D4, 60, 0.06, 0.4); /* the dominant, gathering */

  // the MEADOW at 1410: C MAJOR. The answer to Act 1's question, the same eight notes with the
  // third raised, then a plagal turn and a perfect cadence to close.
  for (let f = 1200; f < 1410; f += BAR) { const c = chordAt(f); bass(f, HZ[CHORD[c][0]], BAR, 0.17); CHORD[c][1].forEach((nm, k) => pad(f, HZ[nm], BAR, 0.055 - k * 0.008, 0.26 + k * 0.24)); }
  theme(1200, HZ.C5, true, (fr, hz, g, pan) => box(fr, hz, g, pan, 3.4), 0.3, 1, 0.46);
  theme(1206, HZ.E4, true, (fr, hz, g, pan) => harp(fr, hz, g * 0.72, pan, 3), 0.2, 1, 0.66);
  theme(1200, HZ.C3, true, (fr, hz, g, pan) => pad(fr, hz, 45, g * 0.4, pan), 0.1, 1, 0.5);
  [1290, 1320, 1335, 1350].forEach((f, k) => harp(f, [HZ.A4, HZ.C5, HZ.F5, HZ.G5][k], 0.17, 0.36 + k * 0.1, 3));
  bell(OFF + DING, HZ.C6, 0.3); bell(OFF + DING, HZ.C5, 0.16); box(OFF + DING, HZ.G5, 0.12, 0.5, 3.4); /* the DING, on the last stroke of the signature */
  bass(OFF + DING, HZ.C2, 75, 0.17); pad(OFF + DING, HZ.C4, 75, 0.07, 0.5); pad(OFF + DING, HZ.E4, 75, 0.05, 0.36); pad(OFF + DING, HZ.G4, 75, 0.04, 0.64);
  [1380, 1390, 1400].forEach((f, k) => harp(f, [HZ.E5, HZ.G5, HZ.C6][k], 0.11 - k * 0.02, 0.4 + k * 0.1, 3));

  // ---- the events the picture makes, sitting inside the harmony rather than on top of it
  LANDINGS.forEach((l, i) => { const c = CHORD[chordAt(OFF + l.at)][1]; harp(OFF + l.at, HZ[c[i % 3]] * 2, 0.16, 0.3 + i * 0.12, 2.2); });
  TAKEOFFS.forEach((t, i) => { flutter(OFF + t, 0.1, t); if (i > 0) { const c = CHORD[chordAt(OFF + t)][1]; harp(OFF + t, HZ[c[1]], 0.1, 0.62, 1.8); } });
  SIPS.forEach(([a, b]) => { for (let fr = a; fr < b; fr += BEAT) heart(OFF + fr, 0.17); }); /* the tick has become a heartbeat */

  // ---- a little room. Three taps is not a reverb, but it is the difference between a score and
  // a row of beeps: nothing in this film happens in an anechoic chamber.
  const taps: [number, number][] = [[0.085, 0.3], [0.168, 0.19], [0.287, 0.11]];
  const dl = L.slice(), dr = R.slice();
  taps.forEach(([sec, g]) => { const d = Math.floor(sec * sr); for (let i = d; i < n; i++) { L[i] += dr[i - d] * g; R[i] += dl[i - d] * g; } });
  for (let i = 0; i < n; i++) { const w = i < 1200 ? i / 1200 : i > n - 18000 ? Math.max(0, (n - i) / 18000) : 1; L[i] = Math.tanh(L[i] * 2.15) * w; R[i] = Math.tanh(R[i] * 2.15) * w; }
  return [L, R];
};

// every onset must sit exactly on its frame, which is what makes a cue a cue
export const scoreProblems = (sr = 48000): string[] => {
  const p: string[] = [];
  [5, ...TAKEOFFS, ...LANDINGS.map((l) => l.at), DING, 660, 750].forEach((fr) => { const want = Math.round(((fr + OFF) / FPS) * sr); if (atFrame(fr + OFF, sr) !== want) p.push(`cue at local ${fr} lands on sample ${atFrame(fr + OFF, sr)}, not ${want}`); });
  if (atFrame(OFF + DING, 48000) !== 2184000) p.push(`the DING is at sample ${atFrame(OFF + DING, 48000)}, expected 2184000 (film frame ${OFF + DING})`);
  if (chordAt(1200) !== "C") p.push(`the meadow does not land on C major at 1200, it lands on ${chordAt(1200)}`);
  if (chordAt(480) !== "G") p.push(`Act 1 does not end on the dominant, it ends on ${chordAt(480)}`);
  return p;
};
