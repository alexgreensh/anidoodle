// BROKEN-COLOUR KIT. Three primitives the core does not have, written here so the lead can promote them:
//
//   staged(...)  a still that draws itself: an ordered list of timed ops, a cached canvas holding the
//                finished prefix, and the ops still in progress drawn on top at their progress. Pure in
//                (frame, env): the cached canvas is always "ground + ops[0..n)" and is rebuilt from the
//                ground whenever a frame asks for less than it holds, so frame order cannot change pixels.
//   brush(...)   one loaded oil brush stroke: blunt where the flat brush lands, full through the body,
//                dragged thin where it lifts, with an impasto ridge on one side and a groove on the other.
//   weave(...)   a primed linen canvas: a seeded, periodic plain-weave tile multiplied over the frame.
import { fractal, rng, type Ctx, type Env, type Layer, type P } from "./core";

// ---------------------------------------------------------------- colour
export type RGB = [number, number, number];
export const mixC = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const css = (c: RGB) => `rgb(${Math.round(Math.max(0, Math.min(255, c[0])))},${Math.round(Math.max(0, Math.min(255, c[1])))},${Math.round(Math.max(0, Math.min(255, c[2])))})`;
export const toHsl = ([r, g, b]: RGB): [number, number, number] => {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
};
export const fromHsl = ([h, s, l]: [number, number, number]): RGB => {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t: number) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
};
export const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the staged still
export type Op = { t0: number; t1: number; draw: (ctx: Ctx, env: Env, p: number) => void };
// ops MUST be sorted so that t1 never decreases: then "finished by frame f" is a prefix, and the cached
// canvas stacks marks in exactly the order the finished still does.
export const checkOps = (ops: Op[], last: number): Op[] => {
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (!(o.t1 > o.t0) || o.t0 <= 0) throw new Error(`op ${i}: bad timing ${o.t0}..${o.t1}`);
    if (i && o.t1 < ops[i - 1].t1) throw new Error(`op ${i}: t1 ${o.t1} before op ${i - 1}'s ${ops[i - 1].t1}`);
    if (o.t1 > last) throw new Error(`op ${i}: finishes at ${o.t1}, after the hold starts at ${last}`);
  }
  return ops;
};
type Progress = { L: Layer; n: number };
export const staged = (key: string, ops: () => Op[], ground: (ctx: Ctx, env: Env) => void, finish: (ctx: Ctx, env: Env) => void) => (ctx: Ctx, frame: number, env: Env) => {
  const list = ops(), DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale);
  let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].t1 <= frame) lo = m + 1; else hi = m; }
  const n = lo, ck = `${key}:progress:${DW}x${DH}`;
  let pr = env.cache.get(ck) as Progress | undefined;
  if (!pr) { pr = { L: env.canvas(DW, DH), n: -1 }; env.cache.set(ck, pr); }
  if (pr.n < 0 || pr.n > n) { const c = pr.L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, DW, DH); ground(c, env); pr.n = 0; }
  for (let i = pr.n; i < n; i++) list[i].draw(pr.L.ctx, env, 1);
  pr.n = n;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.drawImage(pr.L.canvas as CanvasImageSource, 0, 0);
  for (let i = n; i < list.length && list[i].t0 < frame; i++) list[i].draw(ctx, env, Math.max(0.001, Math.min(0.999, (frame - list[i].t0) / (list[i].t1 - list[i].t0))));
  finish(ctx, env);
};
// lay `count` ops out over [f0, f1): starts follow a pace curve, each lasts `dur` frames, t1 monotonic
export const schedule = (count: number, f0: number, f1: number, dur: number, pace: (u: number) => number = (u) => u) =>
  Array.from({ length: count }, (_, i) => { const t0 = f0 + (f1 - dur - f0) * pace(count > 1 ? i / (count - 1) : 0); return { t0, t1: t0 + dur }; });

// ---------------------------------------------------------------- one loaded brush stroke
// kind 0: an opaque dab (flat brush, ridge + groove). kind 1: a rigger/liner line, tapered both ends.
// kind 2: a thin scrubbed lay-in stroke, bristles skipping, the ground showing between them.
export type Mark = { a: P; b: P; bend: number; w: number; rgb: RGB; alpha: number; seed: number; kind: 0 | 1 | 2 };
const quad = (m: Mark, t: number): P => { const dx = m.b[0] - m.a[0], dy = m.b[1] - m.a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, s = 4 * t * (1 - t) * m.bend; return [m.a[0] + dx * t + nx * s, m.a[1] + dy * t + ny * s]; };
const fillRibbon = (c: Ctx, m: Mark, prog: number, prof: (t: number) => number, w: number, off: number, n: number, jit: number, seed: number) => {
  const r = rng(seed), L: P[] = [], R: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * prog, p = quad(m, t), q = quad(m, Math.min(1, t + 0.02)), o = quad(m, Math.max(0, t - 0.02)), dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const hw = (w / 2) * prof(t), j1 = 1 + (r() - 0.5) * jit, j2 = 1 + (r() - 0.5) * jit, cx = p[0] + nx * off, cy = p[1] + ny * off;
    L.push([cx + nx * hw * j1, cy + ny * hw * j1]); R.push([cx - nx * hw * j2, cy - ny * hw * j2]);
  }
  c.beginPath(); L.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath(); c.fill();
};
const flat = (t: number) => (t < 0.1 ? 0.8 + 2 * t : t > 0.6 ? 1 - 0.62 * Math.pow((t - 0.6) / 0.4, 1.5) : 1);
const liner = (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.92 + 0.04))), 0.6);
export const brush = (c: Ctx, env: Env, m: Mark, prog = 1) => {
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.globalCompositeOperation = "source-over";
  const lighter = mixC(m.rgb, [255, 250, 238], 0.2), darker = mixC(m.rgb, [20, 18, 40], 0.14);
  if (m.kind === 0) {
    c.globalAlpha = m.alpha; c.fillStyle = css(m.rgb); fillRibbon(c, m, prog, flat, m.w, 0, 8, 0.2, m.seed);
    if (m.w >= 3.2) {
      c.globalAlpha = m.alpha * 0.5; c.fillStyle = css(lighter); fillRibbon(c, m, prog, flat, m.w * 0.2, m.w * 0.24, 6, 0.4, m.seed + 1); // the ridge the bristles push up
      c.globalAlpha = m.alpha * 0.32; c.fillStyle = css(darker); fillRibbon(c, m, prog, flat, m.w * 0.12, -m.w * 0.3, 6, 0.5, m.seed + 2); // the groove beside it
    }
    if (m.w >= 11) { const r = rng(m.seed + 3); for (let k = 0; k < 3; k++) { c.globalAlpha = m.alpha * (0.4 + r() * 0.4); c.fillStyle = css(k === 1 ? lighter : m.rgb); fillRibbon(c, m, prog, (t) => (t < 0.55 ? 0 : 0.9), m.w * 0.09, (r() - 0.5) * m.w * 0.7, 6, 0.3, m.seed + 4 + k); } } // dry bristle tails
  } else if (m.kind === 1) {
    c.globalAlpha = m.alpha; c.fillStyle = css(m.rgb); fillRibbon(c, m, prog, liner, m.w, 0, 14, 0.25, m.seed);
  } else {
    const r = rng(m.seed);
    for (let k = 0; k < 7; k++) { const off = ((k + 0.5) / 7 - 0.5) * m.w, len = 0.82 + r() * 0.18; c.globalAlpha = m.alpha * (0.45 + r() * 0.55); c.fillStyle = css(mixC(m.rgb, k % 2 ? [255, 244, 228] : m.rgb, 0.18)); fillRibbon(c, m, prog * len, (t) => (t / len > 0.85 ? Math.max(0.1, (1 - t / len) / 0.15) : 1), (m.w / 7) * (1.2 + r() * 0.5), off, 10, 0.6, m.seed + 10 + k); }
  }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- the primed linen
// A plain weave: warp and weft alternate over/under, each thread a rounded ridge, thread thickness
// wandering along its length. Near white, so multiplied at full opacity it only darkens the valleys.
const TILE = 512, PITCH = TILE / 190;
export const weave = (env: Env): Layer => {
  const key = `tile:linen:${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const n = Math.round(TILE * env.scale); L = env.canvas(n, n);
  const img = L.ctx.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const lx = x / env.scale, ly = y / env.scale, cx = Math.floor(lx / PITCH), cy = Math.floor(ly / PITCH), fx = lx / PITCH - cx, fy = ly / PITCH - cy;
    const warpOver = ((cx + cy) & 1) === 0, thick = 0.75 + 0.5 * fractal(61, warpOver ? lx : ly, warpOver ? ly : lx, 0.35, 0.012, 2, TILE);
    const across = warpOver ? fx : fy, along = warpOver ? fy : fx, ridge = Math.pow(Math.sin(Math.PI * across), thick), dip = 0.55 + 0.45 * Math.sin(Math.PI * along);
    const v = ridge * dip * (0.85 + 0.3 * fractal(67, lx, ly, 0.08, 0.08, 2, TILE)), i = (y * n + x) * 4, g = 255 * Math.min(1, 1 - 0.26 * (1 - v));
    d[i] = g; d[i + 1] = g * 0.995; d[i + 2] = g * 0.985; d[i + 3] = 255;
  }
  L.ctx.putImageData(img, 0, 0); env.cache.set(key, L); return L;
};
export const linen = (ctx: Ctx, env: Env, opacity: number) => {
  const t = weave(env); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = opacity;
  ctx.fillStyle = ctx.createPattern(t.canvas as CanvasImageSource, "repeat")!; ctx.fillRect(0, 0, Math.round(env.W * env.scale), Math.round(env.H * env.scale)); ctx.restore();
};
