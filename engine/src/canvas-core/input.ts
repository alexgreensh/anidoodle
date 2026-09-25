// INPUT AS DATA. The promise for interactive pieces: "a frame is a fact GIVEN ITS INPUT LOG".
//
// A host (hosts/interactive.ts) owns the clock and the DOM. It quantises time to 60 Hz ticks and
// writes what the user did into an append-only log of InputEvents, each stamped with the tick at
// which it takes effect. The art never sees an event, a clock or the DOM: it is handed
//
//     draw(ctx, tick, env, stateAt(tick, log, piece.input))
//
// and stateAt is a pure fold of the log. Replay the log in a fresh page, in any order, cold or
// warm, and every frame comes back the same pixels. Nothing else in the contract moves.
//
// Rules the host must keep (the reducer checks the first two and throws):
//   1. ticks never decrease along the log; events sharing a tick apply in log order;
//   2. an event is stamped AFTER every tick already drawn (stamp = max(lastDrawn + 1, clock)), so a
//      drawn frame never changes retroactively and a checkpoint never goes stale;
//   3. everything that moves pixels is IN the log, including the initial configuration (target
//      rectangles, scroll, reduced motion, state), written at tick 0 before anything is drawn.
//      Viewport and DPR changes are logged as `view` events: they change `env.scale`, never the
//      state, because every coordinate in the log is already in the piece's logical space.
//
// Motion between events is closed form. A spring is critically damped and its target is a pure
// function of the DISCRETE state (hover, pointer, focus, state...), which only changes AT events.
// Between two events the motion is x(t) = target + (x0 + (v0 + w x0) t) e^(-w t); at an event that
// moves the target, position AND velocity carry over into a new segment. So an interrupted gesture
// (hover, leave, hover again within 3 ticks) is a sum of exact segments, not an integration that
// depends on how often somebody happened to sample it.
import type { Ctx, Env, P } from "./core";
import type { Film } from "./film";

export const HZ = 60; // ticks per second. Hosts quantise to this; the art counts in it.

export type EventType =
  | "move"    // pointer at (x, y) in piece coordinates (may be outside the canvas); value = "mouse" | "pen" | "touch"
  | "leave"   // the pointer left the page, or a touch ended: there is no pointer now
  | "enter"   // pointer entered bound target `target`
  | "exit"    // pointer left bound target `target`
  | "down"    // press started on `target` (or on the piece itself: target "self")
  | "up"      // press released; a click if it lands on the target the press began on
  | "cancel"  // press abandoned (pointercancel, drag away): no click
  | "focus"   // keyboard focus on `target`: the hover equivalent for people who do not use a mouse
  | "blur"    // focus left `target`
  | "key"     // text in `target` changed: value = its length, (x, y) = the caret in piece coordinates
  | "scroll"  // value = scroll progress 0..1 of the piece's scroll track
  | "state"   // value = a UI state name the page set: "idle", "busy", "success", "error", ...
  | "rect"    // `target` occupies (x, y, w, h) in piece coordinates
  | "view"    // value = device scale the host draws at (logical px -> device px). Env only, never state
  | "motion"; // value = "reduce" | "full": prefers-reduced-motion

export type InputEvent = { tick: number; type: EventType; target?: string; x?: number; y?: number; w?: number; h?: number; value?: number | string };
export type InputLog = InputEvent[];
export type Rect = { x: number; y: number; w: number; h: number };
export type Field = { len: number; caret: P | null };

// The discrete state: everything the log says, nothing it does not.
export type Discrete = {
  pointer: P | null; device: string;
  hover: string | null; focus: string | null; pressed: string | null;
  scroll: number; state: string; reduced: boolean; scale: number;
  rects: Record<string, Rect>; fields: Record<string, Field>;
  since: Record<string, number>; // tick of the latest: move, leave, hover, unhover, focus, blur, press, release, click, cancel, key, scroll, state, and "<kind>:<target|name>"
  count: Record<string, number>; // how many of each, same keys: a seed for reaction variety that is itself in the log
};

export type SpringSpec = {
  omega: number;                                // rad per tick. 0.2 settles in ~0.4 s; 0.08 is lazy
  target: (d: Discrete) => number | P;          // MUST depend on d only: that is what makes it closed form
};
export type InputSpec = { springs: Record<string, SpringSpec>; init?: Partial<Pick<Discrete, "state" | "scroll" | "reduced">> };
export type InputState = Discrete & {
  tick: number;
  attention: string | null;                     // the most recent of focus and hover: where a keyboard or mouse user is
  spring: Record<string, number | P>;           // smoothed values, closed form at this tick
  vel: Record<string, number | P>;              // their velocities, per tick
};

// ---------------------------------------------------------------- the discrete fold
const freshDiscrete = (spec: InputSpec): Discrete => ({
  pointer: null, device: "mouse", hover: null, focus: null, pressed: null,
  scroll: spec.init?.scroll ?? 0, state: spec.init?.state ?? "idle", reduced: spec.init?.reduced ?? false, scale: 1,
  rects: {}, fields: {}, since: {}, count: {},
});
const copyDiscrete = (d: Discrete): Discrete => ({ ...d, rects: { ...d.rects }, fields: { ...d.fields }, since: { ...d.since }, count: { ...d.count } });
const bump = (d: Discrete, key: string, tick: number) => { d.since[key] = tick; d.count[key] = (d.count[key] ?? 0) + 1; };

const apply = (d: Discrete, e: InputEvent) => {
  const t = e.tick, tg = e.target;
  switch (e.type) {
    case "move": d.pointer = [e.x ?? 0, e.y ?? 0]; if (typeof e.value === "string") d.device = e.value; bump(d, "move", t); break;
    case "leave": d.pointer = null; d.hover = null; bump(d, "leave", t); break;
    case "enter": if (tg) { d.hover = tg; bump(d, "hover", t); bump(d, `hover:${tg}`, t); } break;
    case "exit": if (tg && d.hover === tg) { d.hover = null; bump(d, "unhover", t); } break;
    case "down": d.pressed = tg ?? "self"; bump(d, "press", t); bump(d, `press:${d.pressed}`, t); break;
    case "up": { const was = d.pressed; d.pressed = null; bump(d, "release", t); if (was && (tg ?? "self") === was) { bump(d, "click", t); bump(d, `click:${was}`, t); } break; }
    case "cancel": d.pressed = null; bump(d, "cancel", t); break;
    case "focus": if (tg) { d.focus = tg; bump(d, "focus", t); bump(d, `focus:${tg}`, t); } break;
    case "blur": if (tg && d.focus === tg) { d.focus = null; bump(d, "blur", t); } break;
    case "key": if (tg) { d.fields[tg] = { len: Number(e.value ?? 0), caret: e.x !== undefined ? [e.x, e.y ?? 0] : null }; bump(d, "key", t); bump(d, `key:${tg}`, t); } break;
    case "scroll": d.scroll = clamp01(Number(e.value ?? 0)); bump(d, "scroll", t); break;
    case "state": { const s = String(e.value ?? "idle"); if (s !== d.state) { d.state = s; bump(d, "state", t); bump(d, `state:${s}`, t); } break; }
    case "rect": if (tg) d.rects[tg] = { x: e.x ?? 0, y: e.y ?? 0, w: e.w ?? 0, h: e.h ?? 0 }; break;
    case "view": d.scale = Number(e.value ?? 1); break;
    case "motion": d.reduced = e.value === "reduce"; break;
  }
};

// ---------------------------------------------------------------- closed-form critically damped springs
// One segment per spring: anchored at tick t0 with displacement x0 from `tgt` and velocity v0.
type Seg = { t0: number; tgt: number[]; x0: number[]; v0: number[] };
const vec = (v: number | P): number[] => (typeof v === "number" ? [v] : [v[0], v[1]]);
const unvec = (a: number[]): number | P => (a.length === 1 ? a[0] : [a[0], a[1]]);
const evalSeg = (s: Seg, w: number, t: number): { x: number[]; v: number[] } => {
  const dt = t - s.t0; if (dt <= 0) return { x: s.tgt.map((g, i) => g + s.x0[i]), v: s.v0.slice() };
  const e = Math.exp(-w * dt);
  return {
    x: s.tgt.map((g, i) => { const c = s.v0[i] + w * s.x0[i]; return g + (s.x0[i] + c * dt) * e; }),
    v: s.tgt.map((_, i) => { const c = s.v0[i] + w * s.x0[i]; return (s.v0[i] - w * c * dt) * e; }),
  };
};
const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

// ---------------------------------------------------------------- checkpointed pure reducer
type Fold = { tick: number; idx: number; d: Discrete; segs: Record<string, Seg>; ref: InputEvent | null };
const CP = 60; // checkpoint every second of ticks
const caches = new WeakMap<InputSpec, WeakMap<InputLog, Fold[]>>();

const initFold = (spec: InputSpec): Fold => {
  const d = freshDiscrete(spec), segs: Record<string, Seg> = {};
  for (const [k, s] of Object.entries(spec.springs)) { const g = vec(s.target(d)); segs[k] = { t0: 0, tgt: g, x0: g.map(() => 0), v0: g.map(() => 0) }; }
  return { tick: -1, idx: 0, d, segs, ref: null }; // the base sits before tick 0: always valid, whatever tick-0 events say
};
const cloneFold = (f: Fold, tick: number): Fold => ({ tick, idx: f.idx, d: copyDiscrete(f.d), segs: { ...f.segs }, ref: f.ref });

// consume every event with tick <= `to`, in log order, retargeting springs as the discrete state moves
const advance = (spec: InputSpec, log: InputLog, f: Fold, to: number) => {
  while (f.idx < log.length && log[f.idx].tick <= to) {
    const e = log[f.idx];
    if (!Number.isFinite(e.tick) || e.tick < 0) throw new Error(`input log: event ${f.idx} has tick ${e.tick}`);
    if (f.ref && e.tick < f.ref.tick) throw new Error(`input log: ticks go backwards at event ${f.idx} (${f.ref.tick} -> ${e.tick})`);
    apply(f.d, e);
    for (const [k, s] of Object.entries(spec.springs)) {
      const g = vec(s.target(f.d)), seg = f.segs[k];
      if (same(g, seg.tgt)) continue;                                   // untouched springs keep their segment: bit-identical either way
      if (f.d.reduced) { f.segs[k] = { t0: e.tick, tgt: g, x0: g.map(() => 0), v0: g.map(() => 0) }; continue; } // reduced motion: arrive, do not travel
      const { x, v } = evalSeg(seg, s.omega, e.tick);                   // where it is and how fast, at the interruption
      f.segs[k] = { t0: e.tick, tgt: g, x0: x.map((xi, i) => xi - g[i]), v0: v };
    }
    f.ref = e; f.idx++;
  }
  f.tick = to;
};

export const stateAt = (tick: number, log: InputLog, spec: InputSpec): InputState => {
  const t = Math.max(0, Math.floor(tick));
  let bySpec = caches.get(spec); if (!bySpec) { bySpec = new WeakMap(); caches.set(spec, bySpec); }
  let cps = bySpec.get(log); if (!cps) { cps = [initFold(spec)]; bySpec.set(log, cps); }
  // a checkpoint is valid while the log still agrees with it: the event it ended on is the same object,
  // and nothing at or before its tick was appended after it was taken (rule 2 makes this the normal case)
  const valid = (c: Fold) => (c.idx === 0 || log[c.idx - 1] === c.ref) && (c.idx >= log.length || log[c.idx].tick > c.tick);
  let k = Math.min(cps.length - 1, Math.floor(t / CP));
  while (k > 0 && !valid(cps[k])) { cps.length = k; k--; }                // stale tail (the log was rewritten): drop it
  const f = cloneFold(cps[k], cps[k].tick);
  for (let b = (k + 1) * CP; b <= t; b += CP) { advance(spec, log, f, b); if (cps.length === b / CP) cps.push(cloneFold(f, b)); }
  advance(spec, log, f, t);
  const spring: Record<string, number | P> = {}, vel: Record<string, number | P> = {};
  for (const [k2, s] of Object.entries(spec.springs)) { const r = evalSeg(f.segs[k2], s.omega, t); spring[k2] = unvec(r.x); vel[k2] = unvec(r.v); }
  return { ...f.d, tick: t, attention: attentionOf(f.d), spring, vel };
};

// The state of a piece nobody has touched, built WITHOUT the reducer: the replay gate draws the
// piece from this and from stateAt(t, []) and demands the same pixels, so the fold cannot drift.
export const restState = (tick: number, spec: InputSpec): InputState => {
  const d = freshDiscrete(spec), spring: Record<string, number | P> = {}, vel: Record<string, number | P> = {};
  for (const [k, s] of Object.entries(spec.springs)) { const g = s.target(d); spring[k] = g; vel[k] = typeof g === "number" ? 0 : [0, 0]; }
  return { ...d, tick, attention: null, spring, vel };
};

// ---------------------------------------------------------------- helpers the art uses
export const clamp01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
export const ease = (u: number) => { const v = clamp01(u); return v >= 1 ? 1 : v * v * (3 - 2 * v); }; // exactly 1 at and past 1
export const lerp = (a: number, b: number, u: number) => (u >= 1 ? b : a + (b - a) * u);
export const centre = (r: Rect): P => [r.x + r.w / 2, r.y + r.h / 2];

// Where to look: the attended target's centre, else the pointer, else `rest`. A spring target.
// The most recent of keyboard focus and pointer hover: every hover reaction has a focus equivalent.
export const attentionOf = (d: Discrete): string | null => (d.focus && d.hover ? ((d.since.focus ?? -1) >= (d.since.hover ?? -1) ? d.focus : d.hover) : d.focus ?? d.hover);
export const lookTarget = (d: Discrete, rest: P, caretFirst = true): P => {
  const a = attentionOf(d);
  if (a && caretFirst && d.fields[a]?.caret) return d.fields[a].caret!;
  if (a && d.rects[a]) return centre(d.rects[a]);
  return d.pointer ?? rest;
};
// Gaze: the offset of a pupil inside its eye, looking from `eye` at `at`. Saturates smoothly at
// `reach`; a point closer than `near` gets a proportionally smaller glance (no cross-eyed snap).
export const gaze = (eye: P, at: P, reach: number, near = 120): P => {
  const dx = at[0] - eye[0], dy = at[1] - eye[1], d = Math.hypot(dx, dy); if (d < 1e-6) return [0, 0];
  const k = reach * Math.tanh(d / near); return [(dx / d) * k, (dy / d) * k];
};
// Lean: a signed amount in [-max, max] toward `at` along x, soft past `range`.
export const lean = (from: P, at: P, max: number, range = 300) => max * Math.tanh((at[0] - from[0]) / range);
// Parallax: a layer at `depth` (0 = pinned, 1 = moves the most) shifted by where the pointer is.
export const parallax = (at: P, c: P, depth: number, range: P): P => [-depth * range[0] * Math.tanh((at[0] - c[0]) / (c[0] || 1)), -depth * range[1] * Math.tanh((at[1] - c[1]) / (c[1] || 1))];
// A discrete reaction: a pre-made clip of FIXED length started by the latest `key` event.
// Retriggering restarts it (the clip is a function of ticks since its trigger, nothing else).
export const clip = (s: InputState, key: string, len: number): { f: number; u: number; n: number } | null => {
  const t0 = s.since[key]; if (t0 === undefined) return null; const f = s.tick - t0;
  return f >= 0 && f < len ? { f, u: f / len, n: s.count[key] ?? 1 } : null;
};
export const ticksSince = (s: InputState, key: string) => (s.since[key] === undefined ? Infinity : s.tick - s.since[key]);
// Randomness in a reaction is seeded from the log: (the trigger's tick, how many there were, the key).
export const reactionSeed = (s: InputState, key: string) => { let h = 2166136261; const str = `${key}|${s.since[key] ?? -1}|${s.count[key] ?? 0}`; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// Scroll progress mapped onto a stretch of the track: 0 before a, exactly 1 at and after b.
export const scrollSpan = (p: number, a = 0, b = 1) => clamp01((p - a) / Math.max(1e-9, b - a));

// ---------------------------------------------------------------- the piece contract
export type PieceMeta = { title: string; W: number; H: number; loop: number; alt: string };
export type Piece = {
  meta: PieceMeta;          // loop: ticks after which the untouched piece repeats exactly
  input: InputSpec;
  // Pre-draw everything static into env.cache. A generator so a host can spread it over frames;
  // draw() must still be correct if it never ran (cold == warm is part of the gate).
  bake?: (env: Env) => Iterable<unknown>;
  draw: (ctx: Ctx, tick: number, env: Env, input: InputState) => void;
};

// The untouched piece as an ordinary Film (60 fps), so render/gate/emit work on it unchanged.
export const loopFilm = (piece: Piece): Film => ({
  meta: { title: piece.meta.title, W: piece.meta.W, H: piece.meta.H, fps: HZ, bpm: 120, durationFrames: piece.meta.loop },
  assets: { images: {} },
  shots: [{ id: "loop", start: 0, end: piece.meta.loop, draw: (ctx, f, env) => piece.draw(ctx, f, env, restState(f, piece.input)) }],
});
