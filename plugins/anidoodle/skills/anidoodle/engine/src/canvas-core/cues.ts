// CUE SHEET. The film says when its events happen, once, in its own source, and every tool reads
// that: the sound mix, the sync check, the duration budget. A brand launch film kept a second copy of
// its timing in a Python file (a hand-kept timing script) that re-implemented the film's time maps by hand; it drifted
// twice (one section left at real time after a 25 % slowdown, logo keys set in the wrong units), and
// its effects landed at chance level (49 % of 97 visual events had a sound, 71 % by chance alone).
//
//   export const myFilm = withCues(film, [
//     { name: "x-lock",   at: { scene: 22.0, through: [master] } },            // a scene time, through the film's time maps
//     { name: "fall",     at: { scene: 11.94, through: [slowMo, master] } },   // innermost map first, as they are applied
//     { name: "card",     at: { film: 84.2 }, sync: true },                    // a film time, also a verify-export sync marker
//     { name: "tap",      at: { frame: 512 }, sound: "tap:tock -4" },          // a whole frame, with its sound
//   ]);
//   node tools/cues.mjs myFilm      -> out/myFilm.cues.json, which tools/track.mjs mix reads
//
// Times say their units: a bare number throws, because "4.4" in scene seconds and "4.4" in film seconds
// are different frames once a time map runs (the logo-keys bug). Pure: arithmetic over the maps.
import type { Film } from "./film";
import type { TimeRemap } from "./timeRemap";

export type CueAt = { frame: number } | { film: number } | { scene: number; through?: TimeRemap[] };
export type CueDef = { name: string; at: CueAt; sound?: string; sync?: boolean; note?: string };
export type FilmCue = { name: string; frame: number; t: number; sound?: string; sync?: boolean; note?: string };
export type CuedFilm = Film & { cues: FilmCue[] };

/** The film frame (fractional) that shows scene frame `t` under one map: the inverse of map.at, by bisection. */
export const invertRemap = (map: TimeRemap, t: number) => {
  const whole = map.filmFrameOf(t); // the first whole frame at or past t
  let lo = whole - 1, hi = whole;
  if (map.at(lo) >= t) return lo;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (map.at(mid) >= t) hi = mid; else lo = mid; }
  return hi;
};

/** One cue's film frame, fractional: a scene time is carried out through each map in turn. */
export const cueFrame = (at: CueAt, fps: number): number => {
  if (typeof at !== "object" || at === null) throw new Error(`cue time ${String(at)} has no units: write { scene: s }, { film: s } or { frame: n }`);
  if ("frame" in at) { if (!Number.isFinite(at.frame)) throw new Error(`cue frame must be a number, got ${String(at.frame)}`); return at.frame; }
  if ("film" in at) { if (!Number.isFinite(at.film)) throw new Error(`cue film time must be a number of seconds, got ${String(at.film)}`); return at.film * fps; }
  if ("scene" in at) {
    if (!Number.isFinite(at.scene)) throw new Error(`cue scene time must be a number of seconds, got ${String(at.scene)}`);
    let f = at.scene * fps; for (const m of at.through ?? []) f = invertRemap(m, f); return f;
  }
  throw new Error(`cue time ${JSON.stringify(at)} has no units: write { scene: s }, { film: s } or { frame: n }`);
};

/**
 * The film's cue sheet: each cue on the first whole frame that shows it (a sound cued a frame early
 * reads as a lead, a frame late as a lag), with its exact time in seconds. Names are unique, cues sit
 * inside the film, and the list is sorted by frame.
 */
export const cueSheet = (meta: Pick<Film["meta"], "fps" | "durationFrames">, defs: CueDef[]): FilmCue[] => {
  const seen = new Set<string>();
  const out = defs.map((d, i) => {
    if (!d || typeof d.name !== "string" || !d.name.trim()) throw new Error(`cue #${i} needs a name (what happens: "x-lock", "card-lands")`);
    if (seen.has(d.name)) throw new Error(`cue "${d.name}" is declared twice; give each event its own name ("land-1", "land-2")`);
    seen.add(d.name);
    const f = cueFrame(d.at, meta.fps), frame = Math.ceil(f - 1e-6);
    if (frame < 0 || frame >= meta.durationFrames) throw new Error(`cue "${d.name}" lands on frame ${frame}, outside the film (0..${meta.durationFrames - 1})`);
    return { name: d.name, frame, t: +(f / meta.fps).toFixed(4), ...(d.sound ? { sound: d.sound } : {}), ...(d.sync ? { sync: true } : {}), ...(d.note ? { note: d.note } : {}) };
  });
  return out.sort((a, b) => a.frame - b.frame || a.name.localeCompare(b.name));
};

/** The film with its cue sheet attached, and the cues marked sync added to meta.sync (verify-export's markers). */
export const withCues = (film: Film, defs: CueDef[]): CuedFilm => {
  const cues = cueSheet(film.meta, defs), sync = cues.filter((c) => c.sync).map((c) => ({ frame: c.frame, label: c.name }));
  const meta = sync.length ? { ...film.meta, sync: [...(film.meta.sync ?? []), ...sync] } : film.meta;
  return { ...film, meta, cues };
};

/** What changed between two cue sheets (a mix built from an old sheet is out of date): moved, added, removed. */
export const diffCues = (was: FilmCue[], now: FilmCue[], tolFrames = 0) => {
  const a = new Map(was.map((c) => [c.name, c])), b = new Map(now.map((c) => [c.name, c])), out: string[] = [];
  for (const [n, c] of b) {
    const o = a.get(n); if (!o) { out.push(`added "${n}" at frame ${c.frame}`); continue; }
    if (Math.abs(o.frame - c.frame) > tolFrames) out.push(`moved "${n}" from frame ${o.frame} to ${c.frame} (${((c.frame - o.frame) / 1).toFixed(0)} frames)`);
    // the mix plays the cue's sound, and verify-export reads its sync mark: a change to either is a stale mix too
    if ((o.sound ?? "") !== (c.sound ?? "")) out.push(`"${n}" changed its sound from ${o.sound ?? "none"} to ${c.sound ?? "none"}`);
    if (!!o.sync !== !!c.sync) out.push(`"${n}" ${c.sync ? "gained" : "lost"} its sync mark`);
  }
  for (const n of a.keys()) if (!b.has(n)) out.push(`removed "${n}"`);
  return out;
};

/**
 * Any film's cues as sheet cues: { name, frame, t } each. A withCues sheet passes through unchanged. A
 * launch template film carries its sound cues as film.cues ({ frame, kind, variant, label }, no name and
 * no time): each gets t = frame / fps, its label (or its kind) as the name, numbered in frame order when
 * the label repeats (every key of a typed prompt), and kind:variant as its sound, so --check can tell
 * one moved cue from another.
 */
export const sheetCues = (cues: readonly ({ frame: number; name?: string; t?: number; label?: string; kind?: string; variant?: string; sound?: string; sync?: boolean; note?: string })[], fps: number): FilmCue[] => {
  const seen = new Map<string, number>();
  return [...cues].sort((a, b) => a.frame - b.frame).map((c) => {
    if (typeof c.name === "string" && c.name && typeof c.t === "number") return c as FilmCue;
    const base = c.name || c.label || c.kind || "cue", k = (seen.get(base) ?? 0) + 1; seen.set(base, k);
    const sound = c.sound ?? (c.kind ? (c.variant ? `${c.kind}:${c.variant}` : c.kind) : undefined);
    return { name: k === 1 ? base : `${base} #${k}`, frame: c.frame, t: c.frame / fps, ...(sound ? { sound } : {}), ...(c.sync ? { sync: true } : {}), ...(c.note ? { note: c.note } : {}) };
  });
};

/** What changed between a written cue sheet and the film's sheet now: frame rate, length, then every cue. */
export const diffSheets = (was: { fps?: number; durationFrames?: number; cues?: FilmCue[] }, now: { fps: number; durationFrames: number; cues: FilmCue[] }) => {
  const out: string[] = [];
  if (was.fps !== now.fps) out.push(`the film runs at ${now.fps} fps now, ${was.fps ?? "no"} fps when the sheet was written`);
  if (was.durationFrames !== now.durationFrames) out.push(`the film is ${now.durationFrames} frames now, ${was.durationFrames ?? "no"} when the sheet was written`);
  return [...out, ...diffCues(was.cues ?? [], now.cues)];
};
