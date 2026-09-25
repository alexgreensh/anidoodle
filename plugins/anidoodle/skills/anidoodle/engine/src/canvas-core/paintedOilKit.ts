// PAINTED OIL KIT. What oil paint needs that the core does not have: a canvas-weave tile, a
// loaded flat bristle stroke with ridged edges and relief, and a region filler that lays strokes
// along a form's direction field with the colour the light model asks for at each end.
import { Gfx, rng, fractal, type Env, type Layer, type P } from "./core";
import { bounds, clamp, inside, mix, resample, smooth } from "./gallery";

// ---------------------------------------------------------------- the canvas
// Plain-weave linen: warp and weft threads ~3.4 px apart, each crossing a small rounded bump,
// the thread over on top alternating. A multiply tile (1 = thread top, darker in the valleys),
// periodic so it repeats without a seam, built once per scale.
const WEAVE = 34, THREADS = 10;
const weaveTile = (env: Env): Layer => {
  const key = `paintedOil:weave:${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const n = Math.round(WEAVE * env.scale); L = env.canvas(n, n); const img = L.ctx.createImageData(n, n), d = img.data, cell = WEAVE / THREADS;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const lx = x / env.scale, ly = y / env.scale, i = Math.floor(lx / cell), j = Math.floor(ly / cell), fx = lx / cell - i, fy = ly / cell - j;
    const warpOver = (i + j) % 2 === 0, slub = fractal(71, lx, ly, 0.06, 0.02, 2, WEAVE) * 0.5 + fractal(72, lx, ly, 0.02, 0.06, 2, WEAVE) * 0.5;
    const across = warpOver ? fx : fy, along = warpOver ? fy : fx;
    const round = Math.sin(Math.PI * clamp(across * 1.08 - 0.04)), bump = 0.72 + 0.28 * Math.sin(Math.PI * along);
    let v = 0.62 + 0.38 * Math.pow(round, 0.6) * bump;               // the thread's top catches light, its sides and the gaps sink
    v += (warpOver ? -0.06 : 0.06) * (fx - 0.5);                      // lit from the left: the left flank of every bump is lighter
    v *= 0.92 + 0.12 * slub;
    const g = Math.round(255 * clamp(v)), k = (y * n + x) * 4; d[k] = g; d[k + 1] = Math.round(g * 0.985); d[k + 2] = Math.round(g * 0.95); d[k + 3] = 255;
  }
  L.ctx.putImageData(img, 0, 0); env.cache.set(key, L); return L;
};
export const weave = (g: Gfx, alpha: number) => { const m = g.main, t = weaveTile(g.env); m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = "multiply"; m.globalAlpha = alpha; m.fillStyle = m.createPattern(t.canvas as CanvasImageSource, "repeat")!; m.fillRect(0, 0, Math.round(g.env.W * g.env.scale), Math.round(g.env.H * g.env.scale)); m.restore(); m.setTransform(g.env.scale, 0, 0, g.env.scale, 0, 0); };

// ---------------------------------------------------------------- the bristle stroke
export const LIGHT: P = [-0.9, -0.44];                               // window light, from the left and a little above
const LIFT = "#fff3dc", SINK = "#1b0f08";
export const lighten = (c: string, k: number) => mix(c, LIFT, clamp(k));
export const darken = (c: string, k: number) => mix(c, SINK, clamp(k));
export type OStroke = {
  ctrl: P[]; w: number; c0: string; c1?: string;  // the colour it was loaded with, and what it has picked up by the end (wet into wet)
  load?: number; dry?: number;                    // paint on the brush at touch-down; how fast it runs out (0 = never)
  impasto?: number;                               // 0 lean paint lying flat .. 1 a thick ridged dab standing off the canvas
  alpha?: number;                                 // < 1 only for thin, lean paint (toning, the umber drawing)
  jit?: number;                                   // how much the bristles differ in value (a big soft flat barely streaks)
  soft?: number;                                  // 0 lands square (a fresh flat) .. 0.3 feathered in: the brush slid into the stroke, hairs touching down one after another
  seed: number;
};
// progress < 1 lays the first part of the stroke only: the brush is still travelling
export const oilStroke = (g: Gfx, s: OStroke, travel = 1) => {
  if (travel <= 0) return;
  const { w, c0, c1 = c0, load = 1, dry = 0.35, impasto = 0.3, seed } = s, r = rng(seed * 13 + 5);
  const sm = smooth(s.ctrl, false, 8); let len = 0; for (let i = 1; i < sm.length; i++) len += Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]);
  const n = Math.max(5, Math.round(len / 2.2)), pts = resample(sm, n), last = Math.max(1, Math.min(n - 1, Math.round((n - 1) * travel)));
  const nr: P[] = pts.map((_, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  const nb = Math.max(5, Math.min(26, Math.round(w / 2.3))), prof = (t: number) => (t < 0.08 ? 0.9 + 1.4 * t : t > 0.8 ? 1 - (t - 0.8) * 1.4 : 1) * (1 + 0.05 * Math.sin(t * 9 + seed));
  const c = g.cur, touch = (p: P, pad: number) => g.touch(p[0] - pad, p[1] - pad, p[0] + pad, p[1] + pad);
  // where each hair has paint: the flat brush lands square and full, runs out along its length,
  // the outer hairs first, and a dragged-out end breaks into streaks
  const hairs = Array.from({ length: nb }, (_, b) => ({ u: -1 + (2 * (b + 0.5)) / nb + (r() - 0.5) * (0.8 / nb), tone: (r() - 0.5) * (s.jit ?? 0.14), load: load * (0.85 + 0.3 * r()), end: 1 - r() * 0.1, start: (s.soft ?? 0.1) * r() * (0.35 + 0.65 * Math.abs(-1 + (2 * (b + 0.5)) / nb)) }));
  const has = (h: (typeof hairs)[number], hi: number, i: number) => { const t = i / (n - 1); if (t > h.end || t < h.start) return false; const rem = h.load - dry * t * (1 + 0.5 * Math.abs(h.u)); return rem * 1.6 > fractal(seed * 7 + hi, t * len * 0.05, hi * 0.9, 1, 1, 2) + 0.1; };
  const at = (i: number, u: number, W = w * prof(i / (n - 1))): P => [pts[i][0] + nr[i][0] * (u * W) / 2, pts[i][1] + nr[i][1] * (u * W) / 2];
  const body = (flat?: string) => {
    c.lineCap = "round"; c.lineJoin = "round";
    hairs.forEach((h, hi) => {
      let run: number[] = [];
      const flush = () => {
        for (let a = 0; a + 1 < run.length; a += 5) {
          const seg = run.slice(a, Math.min(run.length, a + 6)), t = seg[Math.floor(seg.length / 2)] / (n - 1), base = mix(c0, c1, clamp(t * 1.15));
          c.strokeStyle = flat ?? (h.tone > 0 ? lighten(base, h.tone) : darken(base, -h.tone)); c.lineWidth = Math.max(0.8, ((w * prof(t)) / nb) * 1.9);
          c.beginPath(); seg.forEach((i, k) => { const p = at(i, h.u); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke();
        }
        run = [];
      };
      for (let i = 0; i <= last; i++) { if (has(h, hi, i)) { run.push(i); touch(at(i, h.u), 3 + w / nb); } else flush(); }
      flush();
    });
  };
  const thin = (s.alpha ?? 1) < 1;
  if (thin) g.group("plain", () => body(), { alpha: s.alpha }); else {
    // relief: a thick dab stands off the canvas and throws a hairline shadow away from the window
    if (impasto > 0.5) { c.save(); c.translate(0.9 * impasto, 0.8 * impasto); c.globalAlpha = 0.16 * impasto; body(darken(c0, 0.7)); c.restore(); c.globalAlpha = 1; }
    body();
  }
  if (impasto <= 0.05) return;
  // the ridges: paint shoved to both edges of the brush. The edge turned to the window catches a
  // light line, the far edge a dark one; a few bristle grooves run down the middle
  const lit = (side: number, i: number) => (nr[i][0] * side * LIGHT[0] + nr[i][1] * side * LIGHT[1]) > 0;
  c.lineCap = "round";
  [-1, 1].forEach((side) => {
    const h = side < 0 ? hairs[0] : hairs[nb - 1], hi = side < 0 ? 0 : nb - 1; let run: number[] = [];
    const flush = () => {
      for (let a = 0; a + 1 < run.length; a += 5) {
        const seg = run.slice(a, Math.min(run.length, a + 6)), i0 = seg[Math.floor(seg.length / 2)], t = i0 / (n - 1), base = mix(c0, c1, clamp(t * 1.15)), L = lit(side, i0);
        c.strokeStyle = L ? lighten(base, 0.22 + 0.35 * impasto) : darken(base, 0.25 + 0.3 * impasto); c.globalAlpha = clamp(0.35 + 0.6 * impasto); c.lineWidth = 0.9 + 1.1 * impasto;
        c.beginPath(); seg.forEach((i, k) => { const p = at(i, side * 0.94); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke();
      }
      run = [];
    };
    for (let i = 0; i <= last; i++) { if (has(h, hi, i)) run.push(i); else flush(); }
    flush();
  });
  for (let k = 0; k < 2 + Math.round(impasto * 3); k++) {
    const u = -0.7 + r() * 1.4, i0 = Math.floor(r() * 0.3 * last), i1 = Math.min(last, i0 + Math.round(last * (0.3 + r() * 0.6)));
    c.globalAlpha = 0.18 + 0.3 * impasto; c.lineWidth = 0.7; c.strokeStyle = darken(c0, 0.35); c.beginPath(); for (let i = i0; i <= i1; i++) { const p = at(i, u); i === i0 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]); } c.stroke();
    c.strokeStyle = lighten(c0, 0.3); c.beginPath(); for (let i = i0; i <= i1; i++) { const p = at(i, u - 0.09); i === i0 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]); } c.stroke();
  }
  // where the brush lifted the paint piles up across the stroke end
  if (travel >= 1 && impasto > 0.25) {
    const i = Math.round(last * 0.97), a = at(i, -0.85), b = at(i, 0.85), m: P = [(a[0] + b[0]) / 2 + (pts[i][0] - pts[Math.max(0, i - 3)][0]) * 0.6, (a[1] + b[1]) / 2 + (pts[i][1] - pts[Math.max(0, i - 3)][1]) * 0.6];
    c.globalAlpha = 0.45 * impasto; c.lineWidth = 1.2 + impasto; c.strokeStyle = lighten(c1, 0.35); c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(m[0], m[1], b[0], b[1]); c.stroke();
  }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- filling a region with strokes
export type Pass = {
  region: P[];                                  // where the stroke centres go
  step: number; len: number; w: number;         // spacing of stroke centres, stroke length and width
  dir: (x: number, y: number) => number;        // stroke angle (radians) at a point: the direction the form asks for
  color: (x: number, y: number) => string | null; // what colour the light model wants here; null = this pass leaves it alone
  seed: number; load?: number; dry?: number; impasto?: number; bend?: number; sweep?: number; jit?: number; soft?: number; // sweep = angle the painter works across the area
  path?: (x: number, y: number, len: number, flip: boolean) => P[] | null; // a stroke that follows the form's own curve (overrides dir)
};
export const fill = (p: Pass): OStroke[] => {
  const b = bounds(p.region), r = rng(p.seed), out: { s: OStroke; k: number }[] = [], sw = p.sweep ?? 0.35;
  for (let y = b.y0; y <= b.y1; y += p.step * 0.86) for (let x = b.x0 - ((Math.round(y / p.step) % 2) * p.step) / 2; x <= b.x1; x += p.step) {
    const px = x + (r() - 0.5) * p.step * 0.9, py = y + (r() - 0.5) * p.step * 0.9, jl = r(), jb = r(), ja = r();
    if (!inside(p.region, px, py)) continue;
    const a = p.dir(px, py) + (ja - 0.5) * 0.25, L = p.len * (0.75 + 0.5 * jl), dx = Math.cos(a), dy = Math.sin(a), bend = (jb - 0.5) * (p.bend ?? 0.18) * L;
    const own = p.path?.(px, py, L, jb < 0.5) ?? null;
    const ctrl: P[] = own ?? [[px - (dx * L) / 2, py - (dy * L) / 2], [px - dy * bend, py + dx * bend], [px + (dx * L) / 2, py + (dy * L) / 2]], p0 = ctrl[0], p2 = ctrl[ctrl.length - 1];
    const c0 = p.color(p0[0], p0[1]) ?? p.color(px, py), c1 = p.color(p2[0], p2[1]) ?? c0;
    if (!c0 || !p.color(px, py)) continue;
    out.push({ s: { ctrl, w: p.w * (0.85 + 0.3 * r()), c0, c1: c1 ?? c0, load: p.load ?? 1, dry: p.dry ?? 0.35, impasto: p.impasto ?? 0.3, jit: p.jit, soft: p.soft, seed: p.seed * 1000 + out.length }, k: px * Math.cos(sw) + py * Math.sin(sw) + (r() - 0.5) * p.step * 3 });
  }
  return out.sort((u, v) => u.k - v.k).map((o) => o.s);
};
