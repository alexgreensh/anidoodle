// MusicPlan and notes as data (spec 08 section 2), a small bar-checked notation so a composer
// writes real lines instead of arrays of numbers, the plan validator, and `arrange`, which fits
// a piece to ANY film duration (tempo inside the style's range, then repeat or drop sections).
import { midi, type ModeId, MODES, detectMode, pcOf } from "./theory";
import { MOODS, STYLES, REFUSED_BLENDS, type MoodId, type StyleId, type MelodyType } from "./tables";

export type Meter = "3/4" | "4/4" | "6/8" | "12/8";
export const beatsPerBar = (m: Meter) => (m === "3/4" ? 3 : m === "4/4" ? 4 : m === "6/8" ? 2 : 4);

export type Role = "melody" | "inner" | "bass" | "accomp" | "color" | "drum";
/** t, d in beats from the piece start; p = MIDI; v = written velocity 0..1 (performance shapes it). */
export type Note = { t: number; d: number; p: number; v: number; role: Role; roll?: number; kind?: string };
export type InstId = "piano" | "musicBox" | "bell" | "celesta" | "marimba" | "vibes" | "harp" | "guitar" | "strings" | "fmBell" | "ePiano" | "pulse" | "triangle" | "noiseDrum" | "kick" | "snare" | "hat" | "bass" | "vinyl";
export type Part = { id: string; inst: InstId; role: Role; notes: Note[]; gainDb?: number; pan?: number; opts?: Record<string, number | boolean | string>; send?: number };
export type Section = {
  id: string; bars: number; mood: MoodId | [MoodId, MoodId, number]; key: string; mode: ModeId; melody: MelodyType[];
  /** loudness level at start and end of the section, 0..1 (performance maps it to velocity) */
  dyn: [number, number]; ending?: "button" | "tail" | "hardOut"; repeatable?: boolean; optional?: boolean;
  /** melody beats before the downbeat that belong to this section (re-emitted wherever it is placed) */ pickup?: number;
  /** how repeats differ, cycled */ variations?: Variation[];
};
export type MusicPlan = { style: StyleId; tempo: number; meter: Meter; sections: Section[]; pickupBeats?: number; swing?: number; phraseBars?: number; sync?: string[];
  /** tempo-arch depth per phrase (1 = +-2.5 %); final ritard end-tempo ratio (1 = none) */ rubato?: number; ritard?: number;
  /** room override (the guards' bad fixture uses it; films normally take the style's room) */ space?: { er?: number; late?: number; rt60?: number; hp?: number } };
export type Chord = { t: number; name: string };
export type Piece = { title: string; plan: MusicPlan; parts: Part[]; harmony: Chord[]; tail: number; seed: number;
  /** a shorter complete form of the same music, chosen automatically when the film is too short for this one */ shortForm?: () => Piece };

// ---------------------------------------------------------------- notation
// "Eb4:1 | C5:2 Bb4:.5 Ab4:.5 | [Ab2 Eb3]:1 r:2 | G5:1/3@0.8 ..." ; a token is NOTE:DUR[@VEL] or
// [CHORD]:DUR[@VEL] or r:DUR. Every complete bar must sum to the meter: a wrong bar throws.
const dur = (s: string) => { if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return a / b; } return Number(s); };
export const line = (start: number, src: string, o: { role: Role; v?: number; bpb: number; pickup?: number; roll?: number; kind?: string }): Note[] => {
  const out: Note[] = []; let t = start; const bars = src.split("|").map((b) => b.trim()).filter((b, i, a) => b.length || (i > 0 && i < a.length - 1));
  bars.forEach((bar, bi) => {
    let sum = 0;
    for (const tok of bar.split(/\s+(?![^\[]*\])/).filter(Boolean)) {
      const m = /^(\[[^\]]+\]|[^:]+):([0-9./]+)(?:@([0-9.]+))?$/.exec(tok); if (!m) throw new Error(`bad token "${tok}" in "${bar}"`);
      const d = dur(m[2]), vel = (o.v ?? 0.7) * (m[3] ? Number(m[3]) : 1);
      if (m[1] !== "r") {
        const names = m[1].startsWith("[") ? m[1].slice(1, -1).trim().split(/\s+/) : [m[1]];
        for (const nm of names) out.push({ t, d, p: midi(nm), v: vel, role: o.role, roll: names.length > 1 ? o.roll ?? 0.012 : undefined, kind: o.kind });
      }
      t += d; sum += d;
    }
    const first = bi === 0, last = bi === bars.length - 1;
    const ok = Math.abs(sum - o.bpb) < 1e-6 || (first && o.pickup !== undefined && Math.abs(sum - o.pickup) < 1e-6) || (last && sum <= o.bpb + 1e-6);
    if (!ok) throw new Error(`bar ${bi} sums to ${sum} beats, meter wants ${o.bpb}: "${bar}"`);
  });
  return out;
};

// ---------------------------------------------------------------- validation (spec 08 sections 3, 5, 7)
export const planProblems = (p: Piece): string[] => {
  const probs: string[] = [], plan = p.plan, st = STYLES[plan.style], bpb = beatsPerBar(plan.meter);
  if (!st) probs.push(`unknown style ${plan.style}`);
  else if (plan.tempo < st.tempo[0] * 0.85 || plan.tempo > st.tempo[1] * 1.15) probs.push(`tempo ${plan.tempo} far outside style ${st.id} ${st.tempo.join("-")}`);
  let b0 = -(plan.pickupBeats ?? 0);
  for (const s of plan.sections) {
    const ids = Array.isArray(s.mood) ? [s.mood[0], s.mood[1]] : [s.mood];
    for (const id of ids) if (!MOODS[id]) probs.push(`${s.id}: unknown mood ${id}`);
    if (Array.isArray(s.mood) && REFUSED_BLENDS.some(([a, b]) => (a === s.mood[0] && b === s.mood[1]) || (a === s.mood[1] && b === s.mood[0]))) probs.push(`${s.id}: refused blend ${s.mood[0]}+${s.mood[1]}`);
    if (!MODES[s.mode]) probs.push(`${s.id}: unknown mode ${s.mode}`);
    const lo = b0, hi = b0 + s.bars * bpb + (b0 < 0 ? plan.pickupBeats ?? 0 : 0);
    const notes = p.parts.flatMap((pt) => pt.notes).filter((n) => n.t >= lo && n.t < hi && n.role !== "drum");
    if (notes.length) {
      const top = detectMode(notes, [s.mode, "major", "aeolian", "dorian", "mixolydian", "lydian"]);
      const want = pcOf(s.key.replace(/m$/, ""));
      const hit = top.slice(0, 2).some((c) => pcOf(c.tonic) === want && c.mode === s.mode) || top.slice(0, 2).some((c) => c.mode === s.mode);
      if (!hit) probs.push(`${s.id}: declared ${s.key} ${s.mode}, notes measure ${top.map((c) => `${c.tonic} ${c.mode}`).join(" / ")}`);
    }
    b0 = hi;
  }
  // voice guard: no close thirds below C3 in piano parts (nocturne style guard)
  for (const pt of p.parts) if (pt.inst === "piano") {
    const by = new Map<number, number[]>(); for (const n of pt.notes) { const k = Math.round(n.t * 96); by.set(k, [...(by.get(k) ?? []), n.p]); }
    for (const [k, ps] of by) { ps.sort((a, b) => a - b); for (let i = 1; i < ps.length; i++) if (ps[i] < 48 && ps[i] - ps[i - 1] <= 4) probs.push(`close third below C3 at beat ${k / 96}`); }
  }
  return probs;
};

// ---------------------------------------------------------------- fit to any duration
/** Section beat spans [start, end) in piece beats (pickup lives before 0 and belongs to section 0). */
export const sectionSpans = (plan: MusicPlan) => { const bpb = beatsPerBar(plan.meter); let b = 0; return plan.sections.map((s, i) => { const a = i === 0 ? -(plan.pickupBeats ?? 0) : b; b += s.bars * bpb; return { s, a, b: b }; }); };

export type Variation = "same" | "octaveDouble" | "octaveUp" | "thin";
/** Apply a repeat variation to one section's notes. */
const vary = (notes: Note[], v: Variation): Note[] => {
  if (v === "octaveDouble") return [...notes, ...notes.filter((n) => n.role === "melody").map((n) => ({ ...n, p: n.p - 12, role: "inner" as Role, v: n.v * 0.8 }))];
  if (v === "octaveUp") return notes.map((n) => (n.role === "melody" ? { ...n, p: n.p + 12, v: n.v * 0.9 } : n));
  if (v === "thin") return notes.filter((n) => n.role !== "accomp" || Math.abs(n.t - Math.round(n.t)) < 1e-6);
  return notes;
};

/**
 * Rebuild a piece from a list of section indices (repeat/drop), shifting notes and chords.
 * A section's `pickup` (melody beats before its downbeat) travels with it: wherever the section
 * lands, the last `pickup` beats of melody before it are replaced by the section's own pickup.
 * Repeats cycle through the section's `variations` so a returning theme is never a photocopy.
 */
export const resequence = (p: Piece, order: number[]): Piece => {
  const spans = sectionSpans(p.plan); const parts = p.parts.map((pt) => ({ ...pt, notes: [] as Note[] })); const harmony: Chord[] = []; const sections: Section[] = [];
  let cursor = 0; const bpb = beatsPerBar(p.plan.meter), seen = new Map<number, number>();
  order.forEach((si, k) => {
    const sec = p.plan.sections[si], sp = spans[si], start = si === 0 ? 0 : sp.a, len = sec.bars * bpb, shift = cursor - start;
    const rep = seen.get(si) ?? 0; seen.set(si, rep + 1);
    const vr: Variation = rep > 0 && sec.variations?.length ? sec.variations[(rep - 1) % sec.variations.length] : "same";
    const pk = si === 0 ? p.plan.pickupBeats ?? 0 : sec.pickup ?? 0;
    p.parts.forEach((pt, j) => {
      const body = pt.notes.filter((n) => n.t >= start && n.t < sp.b).map((n) => ({ ...n, t: n.t + shift }));
      if (pk > 0) {
        if (k > 0) parts[j].notes = parts[j].notes.filter((n) => !(n.role === "melody" && n.t >= cursor - pk - 1e-9));
        parts[j].notes.push(...vary(pt.notes.filter((n) => n.role === "melody" && n.t >= start - pk && n.t < start).map((n) => ({ ...n, t: n.t + shift })), vr));
      }
      parts[j].notes.push(...vary(body, vr));
    });
    for (const c of p.harmony) if (c.t >= (si === 0 ? -1e9 : start) && c.t < sp.b) harmony.push({ ...c, t: c.t + shift });
    sections.push({ ...sec, id: rep ? `${sec.id}#${rep}${vr === "same" ? "" : `(${vr})`}` : sec.id });
    cursor += len;
  });
  const pickupBeats = order[0] === 0 ? p.plan.pickupBeats : p.plan.sections[order[0]].pickup ?? 0;
  return { ...p, parts, harmony, plan: { ...p.plan, sections, pickupBeats } };
};
