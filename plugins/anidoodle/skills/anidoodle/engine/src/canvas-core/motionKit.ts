// MOTION KIT. Small helpers that keep a motion-graphics film from turning into a slide deck. Each one
// exists because a brand launch film needed it and wrote it by hand (or got it wrong):
//
//   alternate(i, ["left", "right"])          side, direction or entry for the i-th item of a list, never the same twice running
//   entryFrom(i)                             a different entry direction for each item: no carousel
//   chatScroll(f, steps, o)                  a chat column that scrolls over 18-24 frames on an ease-out, never a snap
//   temperament(name | spec)                 the brand's motion temperament as numbers: top speed, settle time, overshoot
//   cubicBezier(x1, y1, x2, y2)              a CSS / Figma easing curve as a function (brand motion tokens)
//   motionTokens(tokens)                     a brand's exported motion tokens as named eases and durations
//   typeExit(q)                              how far a line of type has sunk on its way out (ease-in, 1.3x its size)
//
// Every function is pure arithmetic over its arguments: no clock, no state, any frame order.
import { speedCeiling } from "./seams";

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/**
 * The i-th choice of a list that never repeats twice running: alternate(i, ["left", "right"]) gives
 * left, right, left. With three or more choices it walks a fixed shuffle so a list of eight items does
 * not read as a strict ping-pong either. The designer's note on the speakers: "each time pop up from a
 * different place".
 */
export const alternate = <T>(i: number, choices: readonly T[]): T => {
  if (!Number.isInteger(i) || i < 0) throw new Error(`alternate: i is a whole index from 0 (got ${i})`);
  if (choices.length < 2) throw new Error("alternate: give at least two choices; one choice repeated is the carousel this helper exists to stop");
  if (choices.length === 2) return choices[i % 2];
  // a stride coprime with the length visits every choice before repeating and never lands on the same one twice in a row
  const n = choices.length; let s = 2; while (gcd(s, n) !== 1) s++;
  return choices[(i * s) % n];
};
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export type Entry = "left" | "right" | "below" | "above";
/** A different entry for each item: from the left, then the right, then below, then above, in the alternate() walk. */
export const entryFrom = (i: number, from: readonly Entry[] = ["left", "right", "below", "above"]): Entry => alternate(i, from);

/** Where a chat column sits at frame f: each step is { f, by } (start frame, pixels to scroll). Ease-out over `frames` (18-24). */
export const chatScroll = (f: number, steps: readonly { f: number; by: number }[], o: { frames?: number } = {}) => {
  const n = o.frames ?? 20;
  if (!(n >= 18 && n <= 24)) throw new Error(`chatScroll: a scroll takes 18 to 24 frames (got ${n}); fewer is the 100 px-a-frame snap that ghosts the text`);
  let y = 0;
  for (const s of steps) { const u = clamp((f - s.f) / n); y += s.by * (1 - Math.pow(1 - u, 3)); }
  return y;
};

// ---------------------------------------------------------------- temperament
/**
 * A brand's motion temperament, set in the brief before any motion is made. A brand launch film was
 * first "violent" and then "flat": nobody had written down how fast, how soft, and whether things
 * overshoot. maxSpeed is a share of speedCeiling (2.5 frame widths a second), settle is how long an
 * arrival takes in seconds, overshoot says whether arrivals may pass their mark and come back.
 */
export type Temperament = { name: string; maxSpeed: number; settle: [number, number]; overshoot: boolean };
export const TEMPERAMENTS: Record<string, Temperament> = {
  // poured liquid: long, soft, no bounce (a brand launch film, Apple "Intention")
  calm: { name: "calm", maxSpeed: 0.35, settle: [0.5, 1.0], overshoot: false },
  // alive but never violent: small landings, short settles
  lively: { name: "lively", maxSpeed: 0.55, settle: [0.3, 0.7], overshoot: true },
  // snappy product UI: quick arrivals, still under the ceiling
  snappy: { name: "snappy", maxSpeed: 0.8, settle: [0.2, 0.45], overshoot: true },
};
export const temperament = (t: string | Temperament): Temperament & { pxPerFrame: (W: number, fps: number) => number; settleFrames: (fps: number) => [number, number]; arrive: (u: number) => number } => {
  const spec = typeof t === "string" ? TEMPERAMENTS[t] : t;
  if (!spec) throw new Error(`temperament: '${t}' is not one of ${Object.keys(TEMPERAMENTS).join(", ")}; or pass { maxSpeed, settle, overshoot }`);
  if (!(spec.maxSpeed > 0 && spec.maxSpeed <= 1)) throw new Error(`temperament: maxSpeed is a share of speedCeiling, in (0, 1] (got ${spec.maxSpeed})`);
  if (!(spec.settle[0] > 0 && spec.settle[1] >= spec.settle[0])) throw new Error(`temperament: settle is [shortest, longest] seconds (got ${spec.settle})`);
  // an arrival curve that matches: with overshoot a small back-ease (passes by about 4 %), without it a quintic out
  const arrive = spec.overshoot ? (u: number) => { const c = clamp(u), s = 1.2; return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2); } : (u: number) => 1 - Math.pow(1 - clamp(u), 5);
  return { ...spec, arrive, pxPerFrame: (W, fps) => spec.maxSpeed * speedCeiling(W, fps), settleFrames: (fps) => [Math.round(spec.settle[0] * fps), Math.round(spec.settle[1] * fps)] };
};

// ---------------------------------------------------------------- brand motion tokens
/** cubic-bezier(x1, y1, x2, y2) as an easing function of u in [0, 1]: the curve a designer types in Figma or CSS. */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  if (![x1, x2].every((x) => x >= 0 && x <= 1)) throw new Error(`cubicBezier: x1 and x2 must lie in [0, 1] (got ${x1}, ${x2})`);
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  return (u: number) => {
    const x = clamp(u); if (x === 0 || x === 1) return x;
    let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; } // bisection: exact enough, and never fails to converge
    return by((lo + hi) / 2);
  };
};
/** A brand's motion tokens (brand.mjs import writes brand.motion from Figma's prototype timings). */
export type MotionToken = { ease: [number, number, number, number] | "linear"; ms: number; distance?: number };
/** Named eases and frame counts from the tokens: motionTokens(brand.motion, 60).turn.ease(u), .turn.frames. */
export const motionTokens = (tokens: Record<string, MotionToken>, fps: number) => Object.fromEntries(Object.entries(tokens).map(([k, t]) => {
  if (!(t.ms > 0)) throw new Error(`motionTokens: token "${k}" has no duration (ms ${t.ms})`);
  return [k, { ease: t.ease === "linear" ? (u: number) => clamp(u) : cubicBezier(...t.ease), frames: Math.max(1, Math.round((t.ms / 1000) * fps)), distance: t.distance }];
})) as Record<string, { ease: (u: number) => number; frames: number; distance?: number }>;

// ---------------------------------------------------------------- type exits
/** How far type travels when it sinks out, as a share of its font size: 1.3 clears ascenders and i-dots past the clip. */
export const TYPE_EXIT_TRAVEL = 1.3;
/**
 * A line of type leaving: q 0..1 is its exit progress, the result is how far it has sunk in font sizes.
 * EASE-IN, so it accelerates away and nothing lingers at the clip edge. The ease-out exit (1.0x) on
 * a brand launch film left letter tops visible for about half a second: the director saw them.
 */
export const typeExit = (q: number) => TYPE_EXIT_TRAVEL * Math.pow(clamp(q), 3);

// ---------------------------------------------------------------- the blur mask
/**
 * Draw something that must stay sharp under render --blur (a logo lockup, a UI card with small type):
 * the renderer leaves it out of the blurred subframes and lays the sharp frame's pixels over them.
 * Text and photos are kept sharp automatically; this is for anything else that reads as type.
 */
export const sharp = (draw: () => void) => { if ((globalThis as { __ANIDOODLE_SHARP__?: string }).__ANIDOODLE_SHARP__ === "skip") return; draw(); };

// ---------------------------------------------------------------- landings
/**
 * Squash and stretch for a landing, volume kept: [sx, sy] at frame t for a body landing at frame
 * `land`. Stretched into the ground, squashed for a few frames on contact, round again after (the
 * proof-3 grammar the director called "better than before"). A brand mark keeps its shape: pass brand: true
 * and this refuses unless `gag` names why the squash is the joke (brandKit.drawEl asks the same).
 */
export const landSquash = (t: number, land: number, o: { amount?: number; frames?: number; brand?: boolean; gag?: string } = {}): [number, number] => {
  if (o.brand && !o.gag?.trim()) throw new Error("landSquash: a brand mark keeps its shape (an ellipse of a brand circle is a redraw); pass { gag: \"<why the squash is the joke>\" } or squash a shape that is not the brand's");
  const amt = o.amount ?? 0.25, n = o.frames ?? 6, u = t - land;
  if (u < -n || u > n) return [1, 1];
  const sy = u < 0 ? 1 + amt * 0.6 * (1 + u / n) : 1 - amt * (1 - u / n) ** 2; // fullest squash on the contact frame (the classic contact pose), round again n frames later
  return [1 / Math.sqrt(sy), sy];
};
