// SUMI-E KIT. Two things the core does not have yet, both candidates for promotion:
//
// 1. runProcess: a still that draws itself as a list of timed marks ("ops"). Finished ops are
//    painted once onto a cached surface whose key is (id, scale, how many ops are finished), and
//    the cache is only ever EXTENDED (ops k..k' drawn on top) or rebuilt from the ground, so a
//    cached frame and a cold frame are the same pixels. The ops still in the hand are drawn live
//    at their progress, then `finish` (paper, sizing) goes over everything, every frame.
// 2. brush: one loaded brush of real hairs. Each hair carries its own ink load, spends it with
//    travel (edge hairs faster), and skips where the paper's tooth wins once it runs low, so a
//    stroke shifts from wet-dark to dry-brush ("flying white", split hairs) along its length.
//    Slow points (touch-down, node pauses, lift) bleed into the paper fibres.
import { Gfx, rng, fractal, type Ctx, type Env, type Layer, type Medium, type P } from "./core";
import { clamp, mix, profile, resample, smooth } from "./gallery";

// ---------------------------------------------------------------- the process runner
export type Op = { t0: number; t1: number; draw: (g: Gfx, p: number) => void };
export type Proc = { id: string; medium: Medium; ground: (g: Gfx) => void; ops: Op[]; finish?: (g: Gfx) => void };
export const prog = (f: number, t0: number, t1: number) => (f >= t1 ? 1 : f <= t0 ? 0 : (f - t0) / (t1 - t0)); // exactly 1 at and past the end
export const runProcess = (pr: Proc, ctx: Ctx, f: number, env: Env) => {
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), ops = pr.ops;
  let k = 0; while (k < ops.length && ops[k].t1 <= f) k++;
  const key = `${pr.id}:done:${env.scale}:${DW}x${DH}`; let C = env.cache.get(key) as { k: number; L: Layer } | undefined;
  const on = (L: Layer) => { L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = "source-over"; return new Gfx(L.ctx, env, 0, pr.medium); };
  if (!C || C.k > k) { const L = C?.L ?? env.canvas(DW, DH); L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, DW, DH); pr.ground(on(L)); C = { k: 0, L }; env.cache.set(key, C); }
  if (C.k < k) { const g = on(C.L); for (let i = C.k; i < k; i++) ops[i].draw(g, 1); C.k = k; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.drawImage(C.L.canvas as CanvasImageSource, 0, 0);
  const g = new Gfx(ctx, env, 0, pr.medium);
  for (let i = k; i < ops.length; i++) if (ops[i].t0 < f || ops[i].t1 <= f) ops[i].draw(g, prog(f, ops[i].t0, ops[i].t1));
  pr.finish?.(g);
};
// fit a process authored at a hand's pace into the frames available: the largest stretch k <= 1
// whose last op ends by `last` (many one-frame ops do not scale linearly, so search for it)
export const fit = (build: (k: number) => Proc, last: number): Proc => {
  const end = (p: Proc) => p.ops[p.ops.length - 1].t1; let lo = 0.05, hi = 1, best = build(1);
  if (end(best) <= last) return best;
  for (let i = 0; i < 24; i++) { const k = (lo + hi) / 2, p = build(k); if (end(p) <= last) { lo = k; best = p; } else hi = k; }
  if (end(best) > last) throw new Error(`${best.id}: the process cannot be fitted to end by frame ${last}`);
  return best;
};
// lay ops end to end: a cursor that hands out [t0, t1) windows with pauses between passes
// `k` stretches every duration and pause, so a process authored at a hand's pace can be fitted to the film
// `frac`: op windows may be fractions of a frame (a brush can lay several quick marks in one
// frame); otherwise every op gets at least one whole frame.
export const timeline = (start: number, k = 1, frac = false) => { let t = start; const ops: Op[] = []; return { ops, at: () => t, wait: (n: number) => { t += n * k; }, add: (dur: number, draw: Op["draw"]) => {
  if (frac) { const t0 = t; t += dur * k; ops.push({ t0, t1: t, draw }); return t; }
  const t0 = Math.round(t); t = Math.max(t0 + 1, t + dur * k); ops.push({ t0, t1: Math.round(t) > t0 ? Math.round(t) : t0 + 1, draw }); return t; } }; };

// ---------------------------------------------------------------- ink
// Five inks (墨分五色) are one stick of ink at five dilutions: scorched, thick, heavy, light,
// clear. Diluted sumi goes a little cool and blue as the carbon thins out; it never goes brown.
export const INK_BLACK = "#0f0d0c", INK_COOL = "#39414a";
export const tone = (v: number) => ({ color: mix(INK_BLACK, INK_COOL, clamp(1 - v) * 0.85), alpha: clamp(0.08 + 0.92 * Math.pow(clamp(v), 0.95)) });
export const JIAO = 1, NONG = 0.82, ZHONG = 0.6, DAN = 0.38, QING = 0.2;

export type Brush = {
  ctrl: P[];                      // hand-placed control points of the stroke's centreline
  w: number;                      // full-press width, px
  press: [number, number][];      // pressure knots [t, 0..1.1] along the stroke
  ink: number;                    // dilution: 1 scorched .. 0.2 clear
  load?: number;                  // how much ink the brush carries at touch-down (1 = freshly loaded)
  dry?: number;                   // ink spent per 100 px of travel
  edge?: number;                  // >0 edge hairs carry more ink (side-laid brush), <0 the tip carries it
  split?: number;                 // how far dry hairs splay apart (0..1)
  bleed?: number;                 // how much the wet parts feather into the fibres
  wet?: number;                   // 0 laid on dry paper (crisp) .. 1 laid into a damp sheet (the whole edge goes soft)
  streak?: boolean;               // a half-loaded brush: hairs hold very different amounts, so it breaks into streaks early and stays broken
  slow?: [number, number][];      // slow points [t, strength]: touch-down, pause, lift: they bleed
  hairs?: number; seed: number;
};
type Hair = { u: number; load: number };
const hairsOf = (b: Brush): Hair[] => {
  const n = b.hairs ?? Math.max(10, Math.min(46, Math.round(b.w * 1.25))), r = rng(b.seed * 7 + 3), e = b.edge ?? 0, L = b.load ?? 1, out: Hair[] = [];
  const v = b.streak ? 0.75 : 0.28; for (let i = 0; i < n; i++) { const u = -1 + (2 * (i + 0.5)) / n + (r() - 0.5) * (1.6 / n); out.push({ u, load: L * (1 + e * (u * u - 0.33)) * (1 - v / 2 + v * r()) }); }
  return out;
};
export const brushPath = (b: Brush) => { const s = smooth(b.ctrl, false, 10); let len = 0; for (let i = 1; i < s.length; i++) len += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); const n = Math.max(8, Math.round(len / 1.6)); return { pts: resample(s, n), len, n }; };

// draw the stroke up to `travel` (0..1 of its length). `soak` grows the bleed at slow points: a
// point the brush has passed keeps drinking ink into the fibres for a moment after it leaves.
export const brush = (g: Gfx, b: Brush, travel = 1, soak = 1) => {
  if (travel <= 0) return;
  const { pts, len, n } = brushPath(b), pr = profile(b.press), hs = hairsOf(b), T = tone(b.ink), dry = (b.dry ?? 0.25) / 100, split = b.split ?? 0.5, c = g.cur;
  const last = Math.max(1, Math.min(n - 1, Math.round((n - 1) * travel)));
  const nr: P[] = pts.map((_, i) => { const a = pts[Math.max(0, i - 1)], q = pts[Math.min(n - 1, i + 1)], dx = q[0] - a[0], dy = q[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  const wid = (i: number) => b.w * pr(i / (n - 1));
  // 1. the bleed: slow points and the wet body feather into the paper, soft, under the crisp hairs
  const bl = b.bleed ?? 0.6;
  if (bl > 0) g.group("plain", () => {
    c.globalCompositeOperation = "source-over";
    const k = g.cur; k.fillStyle = T.color;
    (b.slow ?? []).forEach(([t, s], j) => {
      const i = Math.round(t * (n - 1)); if (i > last) return;
      const grow = clamp(soak * (i === last ? 0.6 : 1)), r0 = wid(i) * (0.5 + 0.35 * s) * (0.55 + 0.45 * Math.sqrt(grow)) + 2.5 * s, [x, y] = pts[i], rr = rng(b.seed * 31 + j);
      k.globalAlpha = T.alpha * 0.34 * s * bl; k.beginPath();
      for (let a = 0; a < 18; a++) { const th = (a / 18) * Math.PI * 2, f = 1 + (fractal(b.seed + j * 5, Math.cos(th) * 2 + 9, Math.sin(th) * 2 + 9, 0.9, 0.9, 2) - 0.5) * 0.7; const px = x + Math.cos(th) * r0 * f, py = y + Math.sin(th) * r0 * f; a ? k.lineTo(px, py) : k.moveTo(px, py); }
      k.closePath(); k.fill(); g.touch(x - r0 * 1.4, y - r0 * 1.4, x + r0 * 1.4, y + r0 * 1.4);
      // the feathers: ink wicking out along single fibres, the tell of absorbent paper
      k.strokeStyle = T.color; k.lineWidth = 0.55; k.lineCap = "round";
      for (let q = 0; q < Math.round(10 + 14 * s); q++) { const th = rr() * Math.PI * 2, d0 = r0 * (0.75 + rr() * 0.3), d1 = d0 + (2 + rr() * 7 * s) * Math.sqrt(grow), bend = (rr() - 0.5) * 0.6; k.globalAlpha = T.alpha * (0.25 + rr() * 0.3) * bl; k.beginPath(); k.moveTo(x + Math.cos(th) * d0, y + Math.sin(th) * d0); const ex = x + Math.cos(th + bend * 0.2) * d1, ey = y + Math.sin(th + bend * 0.2) * d1; k.lineTo(ex, ey); k.stroke(); g.touch(ex - 2, ey - 2, ex + 2, ey + 2); }
    });
    // the wet body: a halo a hair wider than the stroke wherever the brush was still wet
    k.globalAlpha = T.alpha * 0.16 * bl; k.beginPath();
    const L: P[] = [], R: P[] = [];
    for (let i = 0; i <= last; i++) { const wet = clamp((b.load ?? 1) - dry * (i / (n - 1)) * len * 1.2), h = (wid(i) / 2) * (0.9 + 0.25 * wet) + 1.6 * wet; L.push([pts[i][0] + nr[i][0] * h, pts[i][1] + nr[i][1] * h]); R.push([pts[i][0] - nr[i][0] * h, pts[i][1] - nr[i][1] * h]); }
    [...L, ...R.reverse()].forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y))); k.closePath(); k.fill(); L.forEach(([x, y]) => g.touch(x - 3, y - 3, x + 3, y + 3)); R.forEach(([x, y]) => g.touch(x - 3, y - 3, x + 3, y + 3));
    k.globalAlpha = 1;
  }, { blend: "multiply", blur: 1.4 + 1.6 * Math.min(1.5, bl) + 3 * (b.wet ?? 0) });
  // 2. the hairs: each one lays its own line while it has ink, skipping where it runs dry. They
  // are drawn as ONE opaque mark and laid down at the ink's tone, because ink does not stack
  // with itself inside a single stroke; it stacks only where a second stroke crosses the first.
  g.group("plain", () => {
    const k = g.cur; k.strokeStyle = T.color; k.lineCap = "round"; k.lineJoin = "round";
    const tipLen = Math.min(len * 0.2, b.w * 0.45);
    hs.forEach((h, hi) => {
      let run: { p: P; w: number; q: number }[] = [];
      const flush = () => {
        for (let a = 0; a + 1 < run.length; a += 4) {
          const seg = run.slice(a, Math.min(run.length, a + 5)); let w = 0, q = 0; seg.forEach((s) => { w += s.w; q += s.q; }); w /= seg.length; q /= seg.length;
          k.lineWidth = w; k.beginPath(); seg.forEach((s, i) => (i ? k.lineTo(s.p[0], s.p[1]) : k.moveTo(s.p[0], s.p[1]))); k.stroke();
        }
        run = [];
      };
      for (let i = 0; i <= last; i++) {
        const s = (i / (n - 1)) * len, rem = h.load - dry * s * (1 + 0.7 * Math.abs(h.u)), q = clamp(rem * (b.streak ? 1.25 : 2.1));
        // the brush is a cone: its tip touches first and leaves last, so outer hairs start later and lift sooner
        const tipIn = tipLen * Math.pow(Math.abs(h.u), 1.6) * (0.8 + 0.4 * h.load), tipOut = tipLen * 0.7 * Math.pow(Math.abs(h.u), 1.6);
        if (s < tipIn || s > len - tipOut) { flush(); continue; }
        const nz = fractal(b.seed * 13 + hi, s * 0.045, hi * 0.83, 1, 1, 2), present = q * 1.3 > nz + 0.06;
        if (!present) { flush(); continue; }
        const W = wid(i), spl = (fractal(b.seed * 17 + hi, s * 0.02, hi * 0.5, 1, 1, 2) - 0.5) * split * (1 - q) * b.w * 0.7;
        const off = h.u * (W / 2) * (1 + 0.12 * (1 - q)) + spl, p: P = [pts[i][0] + nr[i][0] * off, pts[i][1] + nr[i][1] * off];
        run.push({ p, w: Math.max(0.45, (W / hs.length) * 2.3 * (0.75 + 0.25 * q)), q });
        g.touch(p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3);
      }
      flush();
    });
    k.globalAlpha = 1;
  }, { blend: "multiply", alpha: T.alpha * (1 - 0.35 * (b.wet ?? 0)), blur: b.wet ? 0.6 + 2.6 * b.wet : undefined });
};
// a stroke's op body: touch down (slow point bleeds), travel, lift, then keep soaking a moment
export const strokeDraw = (b: Brush) => (g: Gfx, p: number) => { const travel = clamp((p - 0.12) / 0.7), soak = clamp(p / 0.12) * 0.55 + clamp((p - 0.82) / 0.18) * 0.45; brush(g, b, p >= 1 ? 1 : Math.max(0.02, travel), p >= 1 ? 1 : soak); };
