import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import { drawMoonPhases, type Clock } from "./moonPhases";

// MOON PHASES · the lesson being written. The chalkboard plate, drawn in the order a teacher
// works a board: the felt eraser first, sweeping yesterday's lesson off left to right and leaving
// its ghosts in wide arcs of haze; then the title, underlined twice; the month's arrow and its
// label; then the moons one at a time, each scumbled with the side of the chalk (the whole face,
// then the highlands built up across it, then the lit limb worked a second time), craters tapped
// in, the firm limb line, the faint dark limb and the terminator, and its label written under it
// before the next one starts; the full moon smudged round with a finger. Stars are dotted in
// last, the Plough joined in blue, and the pink note circled. Every stroke carries its dust with it.
//
// The plate itself (moonPhases.ts) takes an optional Clock; without one it draws the finished
// board byte for byte, so the last 30 frames here are the still.

const N = 540, HOLD = 30;
// ONE cue table: [id, start, end] in frames, all on the 5-frame grid. `parts` split a cue evenly.
type Cue = { id: string; a: number; b: number; parts?: string[] };
const moonCues = (i: number, a: number): Cue[] => {
  const m = `m${1000 + i * 37}`, full = i === 3;
  return [
    { id: `${m}.face`, a, b: a + 10 }, { id: `${m}.high`, a: a + 10, b: a + 15 }, { id: `${m}.limb2`, a: a + 15, b: a + 20 },
    { id: `${m}.craters`, a: a + 20, b: a + 25 }, { id: `${m}.lines`, a: a + 25, b: a + 30, parts: [`${m}.limb`, `${m}.limb`, `${m}.back`, `${m}.term`] },
    { id: `lab${i}a`, a: a + 30, b: a + 35 }, full ? { id: `${m}.glow`, a: a + 35, b: a + 40 } : { id: `lab${i}b`, a: a + 35, b: a + 40 },
  ];
};
const CUES: Cue[] = [
  { id: "wipe", a: 5, b: 55 },
  ...Array.from({ length: 9 }, (_, i): Cue => ({ id: `swipe${i}`, a: 5 + i * 5, b: 20 + i * 5 })),   // the eraser's arcs, following it across
  { id: "title", a: 60, b: 95 }, { id: "under1", a: 95, b: 100 }, { id: "under2", a: 100, b: 105 },
  { id: "arc", a: 105, b: 120 }, { id: "arrow", a: 120, b: 125 }, { id: "days", a: 125, b: 140 },
  ...Array.from({ length: 7 }, (_, i) => moonCues(i, 140 + i * 40)).flat(),
  { id: "stars", a: 420, b: 460, parts: Array.from({ length: 70 }, (_, i) => `star${i}`) },
  { id: "dips", a: 460, b: 470, parts: Array.from({ length: 7 }, (_, i) => `dip${i}`) }, { id: "dipA", a: 470, b: 475 }, { id: "dipB", a: 475, b: 480 },
  { id: "note1", a: 480, b: 490 }, { id: "note2", a: 490, b: 500 }, { id: "ring", a: 500, b: 510 },
];
((): void => {   // the checker runs at load: on the grid, inside the film, finished before the hold
  for (const c of CUES) if (c.a % 5 || c.b % 5 || c.b <= c.a || c.b > N - HOLD) throw new Error(`moonPhasesDraw: cue ${c.id} (${c.a}-${c.b}) is off the grid or past the hold`);
  if (N % 15) throw new Error("moonPhasesDraw: duration off the beat");
})();
// id -> [start, end] for every mark, parts spread across their cue (a part named twice gets both slots)
const SPANS: Map<string, [number, number]> = (() => {
  const m = new Map<string, [number, number]>();
  for (const c of CUES) {
    if (!c.parts) { m.set(c.id, [c.a, c.b]); continue; }
    const n = c.parts.length, d = (c.b - c.a) / n;
    c.parts.forEach((p, k) => { const s = c.a + k * d, e = s + d, o = m.get(p); m.set(p, o ? [Math.min(o[0], s), Math.max(o[1], e)] : [s, e]); });
  }
  return m;
})();
const clockAt = (f: number): Clock => (id) => { const s = SPANS.get(id); if (!s) return 1; if (f >= s[1]) return 1; if (f <= s[0]) return 0; return (f - s[0]) / (s[1] - s[0]); };

export const drawMoonPhasesDraw = (ctx: Ctx, f: number, env: Env) => {
  if (f >= N - HOLD) return drawMoonPhases(ctx, f, env);          // the finished board: the still, pixel for pixel
  drawMoonPhases(ctx, f, env, clockAt(f));
};

export const moonPhasesDraw: Film = {
  meta: { title: "Moon phases · the lesson being written", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "lesson", start: 0, end: N, draw: drawMoonPhasesDraw }],
};

export const STYLE = { id: "moonPhasesDraw", name: "Chalkboard, written on", family: "chalk", medium: "soft white and coloured chalk on a slate-green board, side-of-chalk scumble, felt eraser, finger smudge", nearest: "moonPhases", hero: "the phases of the moon, taught" };
