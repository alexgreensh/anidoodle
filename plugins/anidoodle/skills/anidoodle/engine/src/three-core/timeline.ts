// TIMELINE. Author motion the way a director talks ("these three pop in one after another, then the
// title slides up on the word 'three'"), compile it to a flat list of timed tweens, and read any
// track at any frame. Nothing is played: tl.value(name, f) is a pure lookup, so frame 300 never needs
// frames 0-299 and parallel renders agree.
//
//   const tl = timeline(24, { labels: { drop: 48 }, words: [{ text: "three", frame: 96 }] });
//   tl.at(0, set("x", 0), set("tint", "#ff6b5b"));
//   tl.at("drop", chain(to("x", 2, 12, ease.outBack), wait(6), to("x", 0, 12)));
//   tl.at({ word: "three" }, sequence(3, to("a", 1, 8), to("b", 1, 8), to("c", 1, 8)));
//   draw: mesh.position.x = tl.num("x", f);
//
// Rules that keep it honest:
// - A clip is placed RELATIVE to where its parent puts it; only tl.at() names absolute frames (a
//   number, a label, or a spoken word), so beats can come from narration timing later.
// - A tween with no `from` starts from whatever the track holds when it starts (the previous
//   tween's end), resolved once at compile time. A track with nothing before it must be set() or
//   use fromTo(), or compile throws: a silent 0 is how a prop teleports on frame 1.
// - Before the first key a track holds its first value; after the last it holds its last.
// - Colours mix in LINEAR light: sRGB midpoints read muddy and dark (red to green through brown).
// - check() names two tweens writing one track at once (the later-starting one wins, which is
//   rarely what was meant) and cues off the beat grid.
import { ease as E, type Ease } from "./time";

export type Vec3 = [number, number, number];
/** a track's value: a number, an [x, y, z] vector, or a "#rrggbb" colour */
export type Value = number | Vec3 | string;
export type Tween = { track: string; start: number; end: number; from?: Value; to: Value; ease: Ease; src: string };
/** a piece of motion that does not know where it sits yet: emit() writes its tweens from `start` and returns its length */
export type Clip = { len: number; emit: (start: number, out: Tween[]) => void };
export type When = number | string | { label: string; offset?: number } | { word: string; nth?: number; offset?: number };

// ---- values
const hex = (s: string): Vec3 => {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim()) ?? /^#?([0-9a-f]{3})$/i.exec(s.trim());
  if (!m) throw new Error(`timeline: '${s}' is not a #rrggbb colour`);
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Vec3;
};
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const byte = (c: number) => Math.max(0, Math.min(255, Math.round(c * 255))).toString(16).padStart(2, "0");
/** a #rrggbb colour as linear-light rgb in [0, 1] (what three's Color holds internally) */
export const linear = (s: string): Vec3 => hex(s).map(toLin) as Vec3;
/** mix two values at t: numbers and vectors linearly, colours in linear light (returned as #rrggbb) */
export const mix = (a: Value, b: Value, t: number): Value => {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
  if (typeof a === "string" && typeof b === "string") { const p = linear(a), q = linear(b); return "#" + p.map((x, i) => byte(toSrgb(x + (q[i] - x) * t))).join(""); }
  if (Array.isArray(a) && Array.isArray(b) && a.length === 3 && b.length === 3) return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Vec3;
  throw new Error(`timeline: cannot mix ${JSON.stringify(a)} with ${JSON.stringify(b)} (one track, one kind of value)`);
};

// ---- clips (relative time)
const whole = (n: number, what: string) => { if (!Number.isFinite(n) || n < 0) throw new Error(`timeline: ${what} must be a frame count >= 0, got ${n}`); return n; };
/** move a track to `value` over `frames`, starting from wherever it is */
export const to = (track: string, value: Value, frames: number, e: Ease = E.inOutCubic): Clip => ({ len: whole(frames, "to() length"), emit: (s, o) => o.push({ track, start: s, end: s + frames, to: value, ease: e, src: `to(${track})` }) });
/** move a track from `a` to `b` over `frames` (jumps to `a` when it starts) */
export const fromTo = (track: string, a: Value, b: Value, frames: number, e: Ease = E.inOutCubic): Clip => ({ len: whole(frames, "fromTo() length"), emit: (s, o) => o.push({ track, start: s, end: s + frames, from: a, to: b, ease: e, src: `fromTo(${track})` }) });
/** jump a track to `value` with no motion */
export const set = (track: string, value: Value): Clip => ({ len: 0, emit: (s, o) => o.push({ track, start: s, end: s, from: value, to: value, ease: E.linear, src: `set(${track})` }) });
/** nothing for n frames (a held breath inside a chain) */
export const wait = (n: number): Clip => ({ len: whole(n, "wait()"), emit: () => {} });
/** play clips together; lasts as long as the longest */
export const all = (...clips: Clip[]): Clip => ({ len: Math.max(0, ...clips.map((c) => c.len)), emit: (s, o) => clips.forEach((c) => c.emit(s, o)) });
/** play clips one after another */
export const chain = (...clips: Clip[]): Clip => ({ len: clips.reduce((n, c) => n + c.len, 0), emit: (s, o) => { let t = s; for (const c of clips) { c.emit(t, o); t += c.len; } } });
/** start each clip `stagger` frames after the one before (Manim's LaggedStart) */
export const sequence = (stagger: number, ...clips: Clip[]): Clip => ({ len: Math.max(0, ...clips.map((c, i) => i * stagger + c.len)), emit: (s, o) => clips.forEach((c, i) => c.emit(s + i * whole(stagger, "sequence() stagger"), o)) });
/** start a clip n frames late */
export const delay = (n: number, ...clips: Clip[]): Clip => chain(wait(n), all(...clips));
/** play a clip n times back to back; pass a function of the pass index to vary each pass */
export const loop = (n: number, clip: Clip | ((i: number) => Clip)): Clip => chain(...Array.from({ length: whole(n, "loop() count") }, (_, i) => (typeof clip === "function" ? clip(i) : clip)));

export type TimelineOpts = { labels?: Record<string, number>; words?: { text: string; frame: number }[]; beat?: number };
export type Issue = { track?: string; frame: number; msg: string };

/** a seekable timeline at `fps`; labels and spoken-word cues may be passed in from narration timing */
export const timeline = (fps: number, opts: TimelineOpts = {}) => {
  const labels: Record<string, number> = { ...(opts.labels ?? {}) };
  const placed: { at: number; src: string; tweens: Tween[] }[] = [];
  let compiled: Map<string, (Tween & { from: Value })[]> | null = null;

  const resolve = (w: When): number => {
    if (typeof w === "number") return w;
    if (typeof w === "string") { if (!(w in labels)) throw new Error(`timeline: no label '${w}' (have: ${Object.keys(labels).join(", ") || "none"})`); return labels[w]; }
    if ("label" in w) return resolve(w.label) + (w.offset ?? 0);
    const hits = (opts.words ?? []).filter((x) => x.text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "") === w.word.toLowerCase());
    const hit = hits[w.nth ?? 0];
    if (!hit) throw new Error(`timeline: the word '${w.word}'${w.nth ? ` (#${w.nth})` : ""} is not in the narration timing`);
    return hit.frame + (w.offset ?? 0);
  };

  const compile = () => {
    if (compiled) return compiled;
    const by = new Map<string, Tween[]>();
    for (const p of placed) for (const t of p.tweens) { if (!by.has(t.track)) by.set(t.track, []); by.get(t.track)!.push(t); }
    compiled = new Map();
    for (const [track, list] of by) {
      // stable sort: same start keeps authored order, so a set() then a to() at one frame reads right
      const ts = list.map((t, i) => ({ t, i })).sort((a, b) => a.t.start - b.t.start || a.i - b.i).map((x) => x.t);
      const out: (Tween & { from: Value })[] = [];
      for (const t of ts) {
        let from = t.from;
        if (from === undefined) {
          if (!out.length) throw new Error(`timeline: track '${track}' moves at frame ${t.start} with no starting value: set() it first or use fromTo()`);
          from = evalTrack(out, t.start);
        }
        out.push({ ...t, from });
      }
      compiled.set(track, out);
    }
    return compiled;
  };

  // the track's value at frame f: the latest tween that has started wins; before any, the first value
  const evalTrack = (ts: (Tween & { from: Value })[], f: number): Value => {
    if (f < ts[0].start) return ts[0].from;
    let k = 0;
    for (let i = 0; i < ts.length; i++) if (ts[i].start <= f) k = i;
    const t = ts[k];
    if (f >= t.end) return t.to;
    return mix(t.from, t.to, t.ease((f - t.start) / (t.end - t.start)));
  };

  const tl = {
    fps,
    labels,
    /** name a cue frame so clips can be placed on it */
    label(name: string, frame: number) { labels[name] = frame; return tl; },
    /** frame of a label, a word cue or a number */
    frame: resolve,
    /** place clips (played together) at an absolute frame, label or spoken word */
    at(w: When, ...clips: Clip[]) {
      const at = resolve(w), tweens: Tween[] = [];
      all(...clips).emit(at, tweens);
      placed.push({ at, src: typeof w === "object" ? JSON.stringify(w) : String(w), tweens });
      compiled = null;
      return tl;
    },
    /** last frame any tween reaches */
    get end() { return Math.max(0, ...placed.flatMap((p) => p.tweens.map((t) => t.end))); },
    tracks: () => [...compile().keys()],
    /** every compiled tween, in time order per track (for tests and debugging) */
    tweens: (track?: string) => (track ? compile().get(track) ?? [] : [...compile().values()].flat()),
    /** a track's value at frame f */
    value(track: string, f: number): Value {
      const ts = compile().get(track);
      if (!ts) throw new Error(`timeline: no track '${track}'`);
      return evalTrack(ts, f);
    },
    num: (track: string, f: number) => { const v = tl.value(track, f); if (typeof v !== "number") throw new Error(`timeline: track '${track}' is not a number`); return v; },
    vec: (track: string, f: number) => { const v = tl.value(track, f); if (!Array.isArray(v)) throw new Error(`timeline: track '${track}' is not a vector`); return v; },
    color: (track: string, f: number) => { const v = tl.value(track, f); if (typeof v !== "string") throw new Error(`timeline: track '${track}' is not a colour`); return v; },
    /** every track's value at frame f */
    sample(f: number): Record<string, Value> { const o: Record<string, Value> = {}; for (const [k, ts] of compile()) o[k] = evalTrack(ts, f); return o; },
    /** tweens fighting over one track, and cues (tl.at placements) off the beat grid */
    check(grid: { beat?: number; subdiv?: number } = {}): Issue[] {
      const issues: Issue[] = [];
      for (const [track, ts] of compile()) {
        for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i], b = ts[j];
          if (b.start < a.end && a.end > a.start && b.end > b.start) issues.push({ track, frame: b.start, msg: `track '${track}': ${b.src} ${b.start}-${b.end} starts while ${a.src} ${a.start}-${a.end} is still moving (they fight; the later one wins)` });
        }
      }
      const beat = grid.beat ?? opts.beat;
      if (beat) {
        const step = beat / (grid.subdiv ?? 1);
        for (const p of placed) if (Math.abs(p.at / step - Math.round(p.at / step)) > 1e-9) issues.push({ frame: p.at, msg: `cue ${p.src} at frame ${p.at} is off the beat grid (every ${step} frames)` });
      }
      return issues;
    },
  };
  return tl;
};
export type Timeline = ReturnType<typeof timeline>;
