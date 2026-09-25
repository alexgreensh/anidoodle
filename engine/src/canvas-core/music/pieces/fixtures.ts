// THE HATED FIXTURE: a deliberate "ghost crying" (the scar in the old recipe): a slow string pad,
// 2-second attacks, whole-bar chords drifting by chromatic mediants with no dominant and no
// cadence, no rhythm layer, a long reverb tail pushed almost level with the dry sound. It exists so
// the ghost guard has something it MUST fail. Never use it in a film.
import { line, type Piece } from "../plan";

export const ghostFixture = (): Piece => {
  const pad = line(0, "[C4 E4 G4 B4]:8 | [Eb4 G4 Bb4 D5]:8 | [Ab3 C4 Eb4 G4]:8 | [E4 G#4 B4 D#5]:8", { role: "accomp", v: 0.6, bpb: 8 });
  const low = line(0, "C3:8 | Eb3:8 | Ab2:8 | E3:8", { role: "bass", v: 0.5, bpb: 8 });
  const sigh = line(0, "r:4 G5:4 | r:6 F5:2 | r:8 | r:4 D#5:4", { role: "melody", v: 0.4, bpb: 8 });
  return {
    title: "Ghost fixture (hated: slow pad, long tail, no rhythm, no cadence)", seed: 13, tail: 3,
    harmony: [[0, "Cmaj7"], [8, "Ebmaj7"], [16, "Abmaj7"], [24, "Emaj7"]].map(([t, name]) => ({ t: t as number, name: name as string })),
    plan: { style: "ambient", tempo: 60, meter: "4/4", ritard: 1, space: { er: 0.5, late: 1.1, rt60: 5, hp: 150 },
      sections: [{ id: "drift", bars: 8, mood: "calm", key: "C", mode: "major", melody: ["drone"], dyn: [0.5, 0.5], ending: "tail" }] },
    parts: [
      { id: "pad", inst: "strings", role: "accomp", notes: pad, opts: { attack: 2.2, release: 3, bright: 0.6 }, send: 1.6 },
      { id: "low", inst: "strings", role: "bass", notes: low, opts: { attack: 2.5, release: 3, bass: true, bright: 0.4 }, send: 1.6 },
      { id: "sigh", inst: "strings", role: "melody", notes: sigh, opts: { attack: 1.5, release: 2.5 }, send: 1.8, gainDb: -3 },
    ],
  };
};
