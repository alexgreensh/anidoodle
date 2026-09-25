// The scaffold score: a two-section MusicPlan on the music module, so every new film starts with the
// breadth visible (spec 08 section 12). Section A: music box, JOY, C major, I-IV-V-I. Section B: the
// same box turns WISTFUL in D dorian (same notes, new home; the B natural is the colour). Notes are
// data; the plan fits ANY film length (tempo, then repeats); pure in (frames, sampleRate).
//
// CHANGE NOTE: until the music module landed, this file was 14 lines of sine plucks on a fixed
// C-major arpeggio plus a bell. Nothing imported it, so no shipped film changes sound. The worked
// butterfly film keeps its own score (example/.../alive/score.ts), untouched: it sounds the same.
import { line, type Piece } from "./music/plan";
import { filmAudio } from "./music/render";

const B = 4; // 12/8: four dotted-quarter beats a bar, triplet subdivisions
const arp = (r: string, f: string, t: string) => Array.from({ length: 12 }, (_, i) => `${[r, f, t, f][i % 4]}:1/3`).join(" ");

export const fixturesPiece = (bpm = 120): Piece => ({
  title: "Fixtures: joy, then wistful", seed: 3, tail: 1.6,
  harmony: [[0, "C"], [4, "F"], [8, "G"], [12, "C"], [16, "Dm"], [20, "G/D"], [24, "Dm"], [28, "Dm"]].map(([t, name]) => ({ t: t as number, name: name as string })),
  plan: {
    style: "musicBox", tempo: bpm, meter: "12/8", ritard: 0.85,
    sections: [
      { id: "joy", bars: 4, mood: "joy", key: "C", mode: "major", melody: ["hook", "arpeggio"], dyn: [0.75, 0.8], repeatable: true },
      { id: "wistful", bars: 4, mood: "wistful", key: "D", mode: "dorian", melody: ["themeTransformation"], dyn: [0.7, 0.6], ending: "button", repeatable: true, optional: true },
    ],
  },
  parts: [
    // the hook (E-G-A-G), answered; then the same hook re-seated on D dorian
    { id: "melody", inst: "musicBox", role: "melody", opts: { grid: true }, notes: line(0, [
      "E5:1 G5:2/3 A5:1/3 G5:1 E5:1", "A5:1 C6:2/3 A5:1/3 F5:2", "G5:1 A5:2/3 G5:1/3 D5:1 B5:1", "C6:4",
      "F5:1 A5:2/3 B5:1/3 A5:1 F5:1", "B5:1 D6:2/3 B5:1/3 G5:2", "A5:1 B5:2/3 A5:1/3 E5:1 F5:1", "D5:4"].join(" | "), { role: "melody", v: 0.75, bpb: B }) },
    { id: "arp", inst: "musicBox", role: "accomp", gainDb: -7, opts: { grid: true }, notes: line(0, [
      arp("C5", "G5", "E5"), arp("C5", "A5", "F5"), arp("B4", "G5", "D5"), arp("C5", "G5", "E5"),
      arp("D5", "A5", "F5"), arp("D5", "B5", "G5"), arp("D5", "A5", "F5"), "D5:1/3 A5:1/3 F5:1/3"].join(" | "), { role: "accomp", v: 0.5, bpb: B }) },
    { id: "bass", inst: "musicBox", role: "bass", gainDb: -8, opts: { grid: true }, notes: line(0, "C3:2 G3:2 | F3:2 C3:2 | G3:2 D3:2 | C3:4 | D3:2 A3:2 | G3:2 D3:2 | D3:2 A3:2 | D3:1", { role: "bass", v: 0.62, bpb: B }) },
    { id: "bell", inst: "bell", role: "color", notes: line(28, "D6:1", { role: "color", v: 0.7, bpb: B }) },
  ],
});

/** A film's `audio`: exactly the film's length at any sample rate. The same signature as before. */
export const fixturesScore = (fps: number, bpm: number, frames: number) => filmAudio(fixturesPiece(bpm), frames / fps);
