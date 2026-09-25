// The text score a human reads (spec 08 section 10): at each section head the style, mood, key
// and mode; then bar by bar the chords and the melody's note names with durations in beats.
import { beatsPerBar, sectionSpans, type Piece } from "./plan";
import { spellerFor } from "./theory";

export const scoreText = (p: Piece): string => {
  const bpb = beatsPerBar(p.plan.meter), out: string[] = [`${p.title}  |  style ${p.plan.style}, ${p.plan.meter} at ${p.plan.tempo} bpm`];
  const mel = p.parts.flatMap((pt) => pt.notes.filter((n) => n.role === "melody")).sort((a, b) => a.t - b.t);
  const pick = p.plan.pickupBeats ?? 0;
  for (const { s, a, b } of sectionSpans(p.plan)) {
    const mood = Array.isArray(s.mood) ? `${s.mood[0]}+${s.mood[1]} (${s.mood[2]})` : s.mood;
    out.push(`== ${s.id}: ${mood}, ${s.key} ${s.mode}, melody ${s.melody.join("/")}, dynamics ${s.dyn[0]} -> ${s.dyn[1]}${s.ending ? `, ending ${s.ending}` : ""}`);
    const nm = spellerFor(s.key, s.mode);
    const first = Math.floor((a + (a < 0 ? 0 : 0)) / bpb), last = Math.ceil(b / bpb);
    for (let bar = Math.max(first, a < 0 ? -1 : first); bar < last; bar++) {
      const lo = bar === -1 ? -pick : bar * bpb, hi = (bar + 1) * bpb;
      const chords = p.harmony.filter((c) => c.t >= lo && c.t < hi).map((c) => c.name).join(" ");
      const notes = mel.filter((n) => n.t >= lo && n.t < hi).map((n) => `${nm(n.p)}:${+n.d.toFixed(3)}`).join(" ");
      out.push(`  ${String(bar < 0 ? "pk" : bar).padStart(3)} | ${chords.padEnd(16)} | ${notes}`);
    }
  }
  return out.join("\n");
};
