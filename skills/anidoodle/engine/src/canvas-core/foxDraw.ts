import { Gfx, PENCIL, rng, type Ctx, type Env, type Layer } from "./core";
import type { Film } from "./film";
import { foxScene, type Pose, type Stage } from "./fox";

// FOX AT DUSK · laid down. The cut-paper fox (fox.ts), made the way a collage artist makes it:
// from the bottom of the stack up. Frame 0 is the bare backing board. Then the sheets go down in
// the plate's own layer order: the sky ground, the torn bands of dusk, the moon and its seas, the
// stars; the hill and its pines tier by tier; the fox from the far sweep of the brush forward to
// the eye's glint; last the leaves and the grass across the feet.
// Each piece arrives in the hand: held a little above the sheet it throws a wide, soft, far
// shadow, then it is lowered and pressed, and the shadow pulls in tight under it. Big sheets are
// slid in from the edge they belong to and go down fast; small pieces are fiddly and slow. A beat
// of rest between the four passes. The last second is the still, pixel for pixel (md5 of the
// last frame = md5 of `fox`).

const N = 480, HOLD = 30, T0 = 5;
type Slot = { start: number; dur: number; dx: number; dy: number };
// the schedule, derived once from the plate's own layer list
const plan = (() => {
  const st: Stage = { n: 0, pose: () => null, count: [] };
  // a dry run: every piece "not placed", so nothing is drawn; we only learn the layer sizes
  const counts = (() => { const fake = { cur: null } as unknown as Gfx; foxScene(fake, st); return st.count!; })();
  const pass = (li: number) => (li < 7 ? 0 : li < 12 ? 1 : li < counts.length - 2 ? 2 : 3);  // sky, hill, fox, foreground
  const r = rng(58);
  // raw timing in arbitrary units: big full-bleed sheets are quick, each extra piece in a layer
  // adds a fiddly placement, and a pause separates passes
  const raw: { li: number; t: number; d: number; stag: number }[] = []; let t = 0;
  counts.forEach((n, li) => { if (li > 0 && pass(li) !== pass(li - 1)) t += 12; const stag = n > 1 ? Math.min(pass(li) === 3 ? 1.2 : 2.2, 30 / n) : 0, d = li < 5 || li === 7 || (li >= 10 && li <= 11) ? 12 : pass(li) === 2 ? 11 : 8; raw.push({ li, t, d, stag }); t += d * 0.8 + stag * (n - 1); });
  const k = (N - HOLD - T0 - 12) / t;
  const slots: Slot[][] = raw.map(({ li, t: t0, d, stag }) => Array.from({ length: counts[li] }, (_, j) => {
    const big = li < 5 || li === 7 || li >= 10 && li <= 11;           // full-bleed bands slide in from below
    const a = big ? Math.PI / 2 : -Math.PI / 2 + (r() - 0.5) * 2.2, far = big ? 70 : 22 + r() * 16;
    return { start: T0 + (t0 + stag * j) * k, dur: Math.max(6, d * k * (big ? 0.9 : 1.1)), dx: Math.cos(a) * far, dy: Math.sin(a) * far };
  }));
  const done = raw.map(({ li }) => Math.max(...slots[li].map((s) => s.start + s.dur)));
  return { counts, slots, done };
})();
const ease = (u: number) => (u >= 1 ? 1 : 1 - (1 - u) ** 3);
const poseAt = (s: Slot, f: number): Pose | null | undefined => {
  if (f < s.start) return null; const u = (f - s.start) / s.dur; if (u >= 1) return undefined;
  const e = ease(u), h = (1 - e) * (1 - e);
  return { dx: s.dx * (1 - e), dy: s.dy * (1 - e), lift: 1 + 5 * h };
};

export const drawFoxDraw = (ctx: Ctx, f: number, env: Env) => {
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), L = plan.counts.length;
  let k = 0; while (k < L && plan.done[k] <= f) k++;
  // everything down: draw the plate exactly as fox.ts does, on this canvas, so the held last
  // second is the still byte for byte (a blit of an offscreen base differs by +-3 in places)
  if (k === L) {
    // drawn once, then restored with putImageData (an exact pixel copy, no compositing), so every
    // held frame is the same bytes as `fox` without paying for the whole collage again
    const fk = `foxDraw:final:${DW}x${DH}`, img = env.cache.get(fk) as ImageData | undefined;
    if (img) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.putImageData(img, 0, 0); return; }
    const g = new Gfx(ctx, env, 0, PENCIL); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); foxScene(g); g.paper("paper", 0.1);
    env.cache.set(fk, ctx.getImageData(0, 0, DW, DH)); return;
  }
  // base = layers [0, k) settled, on the board. Its pixels are a pure function of k; the stored
  // k says which prefix it holds, and it only rolls forward (a backward seek rebuilds).
  const key = `foxDraw:base:${DW}x${DH}`; let c = env.cache.get(key) as { k: number; L: Layer } | undefined;
  if (!c) { c = { k: -1, L: env.canvas(DW, DH) }; env.cache.set(key, c); }
  if (c.k > k || c.k < 0) { const b = c.L.ctx; b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.globalCompositeOperation = "source-over"; b.fillStyle = "#e9dfc9"; b.fillRect(0, 0, DW, DH); c.k = 0; }   // the backing board
  if (c.k < k) { const from = c.k, g = new Gfx(c.L.ctx, env, 0, PENCIL); foxScene(g, { n: 0, pose: (li) => (li >= from && li < k ? undefined : null) }); c.k = k; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c.L.canvas as CanvasImageSource, 0, 0);
  const g = new Gfx(ctx, env, 0, PENCIL);
  if (k < L) foxScene(g, { n: 0, pose: (li, j) => (li < k ? null : poseAt(plan.slots[li][j], f)) });
  g.paper("paper", 0.1);
};

export const foxDraw: Film = {
  meta: { title: "Fox at dusk · laid down", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "foxDraw", start: 0, end: N, draw: (ctx, f, env) => drawFoxDraw(ctx, f, env) }],
};
export const STYLE = { id: "foxDraw", name: "Cut-paper collage, laid down", family: "collage", medium: "torn and scissor-cut coloured papers on a backing board, each lowered by hand onto the stack", nearest: "fox", hero: "Fox at dusk, assembled bottom layer up" };
