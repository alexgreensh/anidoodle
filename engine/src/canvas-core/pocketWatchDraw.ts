import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import { drawPocketWatch, type Clock, type Kind } from "./pocketWatch";

// POCKET WATCH · drawn in biro. The ballpoint plate, watched being made.
//
// MEDIUM. One blue ballpoint on cream cartridge paper: a steel ball rolling oil-based ink, so
//   the line is near-constant in weight, it cannot be lifted or thinned, and tone comes only from
//   WHERE strokes are laid (single hatch, cross-hatch, a third direction in the deepest darks).
//   A firm stroke leaves a bead of ink where the ball stops. Nothing is erased.
// ORDER (the way a biro sketcher works, because a pen cannot take a mark back):
//   1. construction: two faint centre lines and a loose ellipse, barely pressed;
//   2. contours: the case, back arc, bezel and track rings, chain links, crown, pendant, bow;
//   3. detail: reeding, minute track, numerals, the sub-dial ticks, the crown's knurling;
//   4. tone, first layer: one direction everywhere there is any shade (table shadow, the case
//      side, the bezel's cylinder, the dial's bezel shadow, the chain);
//   5. tone, cross layer, only where it is darker; 6. the third direction in the deepest darks;
//   7. the solid blacks last: the Breguet hands scribbled in, their hair shadows, the boss.
//   A beat of pause between passes: the hand sits back and looks before the next layer.
// PACE. Each pass is laid down in the plate's own draw order (it already travels round the
//   watch), a mark's time is 4 + length^0.85 frames-units, so long strokes go fast per pixel and
//   short fiddly ones slow; a mark never takes less than a few frames. The ball stops, THEN the
//   bead appears. Solid areas grow as a band across them, never fade.
// REALISM. Everything drawn is pocketWatch.ts's authored watch (open face, reeded bezel, IIII,
//   Breguet moon hands at ten past ten, sunk sub-seconds, crown, pendant, bow, curb chain; light
//   from upper left), and the last frame is that plate byte for byte.

export const STYLE = { id: "pocketWatchDraw", name: "Ballpoint sketch, drawn on", family: "pen & ink", medium: "one blue ballpoint on cream cartridge paper: constant line, tone by hatch placement, ink beads where the ball stops", nearest: "pocketWatch", hero: "a pocket watch lying on a table, drawn stroke by stroke" };

const N = 450, HOLD = 30;
// THE CUE TABLE. Every frame number of the film. [kind, start, end, shortest mark in frames]
const CUES: [Kind, number, number, number][] = [
  ["build", 0, 25, 12],
  ["line", 35, 110, 6],
  ["detail", 120, 180, 4],
  ["h1", 190, 305, 3],
  ["h2", 315, 370, 3],
  ["h3", 380, 395, 3],
  ["fill", 400, 420, 5],
];
(() => { // the grid checker, at load
  const bad: string[] = []; let prev = 0;
  CUES.forEach(([k, a, b, d]) => { if (a % 5 || b % 5) bad.push(`${k} off the 5-frame grid`); if (a < prev || b <= a) bad.push(`${k} out of order`); if (b - a < d) bad.push(`${k} shorter than one mark`); prev = b; });
  if (prev > N - HOLD) bad.push("drawing runs into the hold"); if (N % 15 || N < 300 || N > 540) bad.push("duration off the beat grid");
  if (bad.length) throw new Error("pocketWatchDraw cues: " + bad.join("; "));
})();

// The schedule: one [start, duration] per mark, in the plate's paint order. Built once from a
// recording pass (a clock that answers 0 draws nothing but counts every mark it is asked about).
type Sched = { s: Float64Array; d: Float64Array };
const schedule = (env: Env, ctx: Ctx): Sched => {
  const key = "pwDraw:sched"; let S = env.cache.get(key) as Sched | undefined; if (S) return S;
  const marks: [Kind, number, string][] = []; drawPocketWatch(ctx, 0, env, (k, l, part) => (marks.push([k, l, part ?? "watch"]), 0));
  const s = new Float64Array(marks.length), d = new Float64Array(marks.length);
  CUES.forEach(([kind, a, b, dmin]) => {
    const mine = marks.map((m, i) => (m[0] === kind ? i : -1)).filter((i) => i >= 0), idx = [...mine.filter((i) => marks[i][2] !== "chain"), ...mine.filter((i) => marks[i][2] === "chain")], /* the watch first, its chain after: paint order stays the plate's, only the TIME changes */ cost = idx.map((i) => (marks[i][2] === "hidden" ? 0 : 4 + Math.pow(marks[i][1], 0.85))), /* a stroke the case will cover takes no time: nobody watches it */ total = cost.reduce((x, y) => x + y, 0) || 1, span = b - a;
    let acc = 0; idx.forEach((i, j) => { const dur = Math.min(span, Math.max(dmin, (span * cost[j]) / total)); s[i] = a + ((span - dur) * acc) / total; d[i] = dur; acc += cost[j]; });
  });
  S = { s, d }; env.cache.set(key, S); return S;
};
const at = (S: Sched, f: number): Clock => { let i = 0; return () => { const p = (f - S.s[i]) / S.d[i]; i++; return p >= 1 ? 1 : p <= 0 ? 0 : p; }; };

const draw = (ctx: Ctx, f: number, env: Env) => {
  if (f < N - HOLD) return drawPocketWatch(ctx, 0, env, at(schedule(env, ctx), f));
  // the hold: the finished plate. Drawn straight onto the frame once per scale, then its exact pixels
  // are copied (an offscreen redraw antialiases differently on some rasterisers; a pixel copy cannot)
  const key = `pwDraw:done:${env.scale}`, img = env.cache.get(key) as ImageData | undefined, w = Math.round(env.W * env.scale), h = Math.round(env.H * env.scale);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (img) return ctx.putImageData(img, 0, 0);
  drawPocketWatch(ctx, 0, env); ctx.setTransform(1, 0, 0, 1, 0, 0); env.cache.set(key, ctx.getImageData(0, 0, w, h));
};

export const pocketWatchDraw: Film = {
  meta: { title: "Pocket watch · drawn in biro", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "draw", start: 0, end: N, draw }],
};
