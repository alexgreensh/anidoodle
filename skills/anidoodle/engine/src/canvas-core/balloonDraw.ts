import type { Ctx, Env, P } from "./core";
import type { Film } from "./film";
import { drawBalloon, type BalloonClock, type CrayonKind } from "./balloon";

// HOT-AIR BALLOON · crayon, drawn on. The balloon plate's own marks, replayed in the order a
// child (or an illustrator working in wax crayon) makes them:
//
//   1. the contours, thin and light, the hero first: envelope, basket and burner, then the sun,
//      clouds, the far balloon and birds, then the hills and trees
//   2. scribble fills, back and forth, the balloon's gores one colour at a time, then the rest of
//      the picture, and the sky last, because the sky is always coloured last
//   3. a darker crayon worked over the shade side of everything
//   4. the white crayon pressed hard into the highlight (burnished)
//   5. the fat contour gone over twice, which swallows the light lay-in line under it
//
// Every mark keeps its place in the plate's LAYER order (a later fill still sits under the
// outline drawn before it, the way wax colours up to a line); only its TIME moves. Frame 0 is the
// bare sheet. From frame 420 the plate is drawn with no clock at all, so the last 30 frames are the
// balloon still, byte for byte.

const N = 450;                                                  // 15 s at 30 fps
const PHASE: Record<"lay" | CrayonKind, [number, number]> = {    // frames, all on the 5-frame grid
  lay: [5, 100], fill: [105, 285], shade: [290, 335], burnish: [340, 365], line: [370, 415],
};
const DONE = 420;
Object.values(PHASE).forEach(([a, b]) => { if (a % 5 || b % 5 || b > DONE) throw new Error("balloonDraw: phase off the grid"); });

type Mark = { i: number; kind: CrayonKind; sec: string; len: number; area: number };
const PRIO: Record<string, number> = { envelope: 0, rigging: 1, sky: 2, land: 3 };
const polyLen = (pts: P[]) => pts.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0), 0);
const boxArea = (pts: P[]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); return Math.max(1, (x1 - x0) * (y1 - y0)); };
const clamp = (v: number) => Math.max(0, Math.min(1, v));

// one survey pass of the plate with a clock that draws nothing and writes down every mark
const survey = (ctx: Ctx, env: Env): Mark[] => {
  const marks: Mark[] = [];
  const clk: BalloonClock = { n: 0, sec: "", p: (kind, i, pts) => { marks[i] = { i, kind, sec: clk.sec, len: polyLen(pts), area: boxArea(pts) }; return 0; }, lay: () => 0 };
  drawBalloon(ctx, 0, env, clk);
  return marks;
};

// windows [t0, t1) per mark, one hand working through each phase in order; a long mark is fast
// per unit of length, and every lift of the crayon costs a beat of its own
type Plan = { full: Map<number, [number, number]>; lay: Map<number, [number, number]> };
const plan = (marks: Mark[]): Plan => {
  const full = new Map<number, [number, number]>(), lay = new Map<number, [number, number]>();
  const prio = (m: Mark) => (m.area > 400000 ? 9 : PRIO[m.sec] ?? 5);     // the sky wash waits for everything else
  const cost = (m: Mark) => (m.kind === "line" ? Math.pow(m.len, 0.75) + 6 : Math.sqrt(m.area) * 0.9 + 14);
  const lay1 = (list: Mark[], [a, b]: [number, number], into: Map<number, [number, number]>) => {
    const sorted = [...list].sort((p, q) => prio(p) - prio(q) || p.i - q.i), tot = sorted.reduce((s, m) => s + cost(m), 0); let acc = 0;
    sorted.forEach((m) => { const t0 = a + ((b - a) * acc) / tot; acc += cost(m); into.set(m.i, [t0, a + ((b - a) * acc) / tot]); });
  };
  (["fill", "shade", "burnish", "line"] as CrayonKind[]).forEach((k) => lay1(marks.filter((m) => m && m.kind === k), PHASE[k], full));
  lay1(marks.filter((m) => m && m.kind === "line" && m.len >= 25), PHASE.lay, lay);   // tiny flicks (grass, weave) get no lay-in
  return { full, lay };
};

const at = (w: [number, number] | undefined, f: number) => (w ? clamp((f - w[0]) / Math.max(1e-6, w[1] - w[0])) : 0);

export const balloonDraw: Film = {
  meta: { title: "Hot-air balloon · crayon, drawn on", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{
    id: "drawing", start: 0, end: N, draw: (ctx, f, env) => {
      if (f >= DONE) return drawBalloon(ctx, 0, env);                   // the plate itself: the still, exactly
      const key = "balloonDraw:plan:v1"; let P = env.cache.get(key) as Plan | undefined;
      if (!P) { P = plan(survey(ctx, env)); env.cache.set(key, P); }      // a pure function of the plate; drawn over below
      const Q = P, clk: BalloonClock = { n: 0, sec: "", p: (_k, i) => at(Q.full.get(i), f), lay: (i) => at(Q.lay.get(i), f) };
      drawBalloon(ctx, 0, env, clk);
    },
  }],
};
