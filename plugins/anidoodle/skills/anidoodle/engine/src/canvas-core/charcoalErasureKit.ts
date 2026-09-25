// CHARCOAL + ERASURE KIT. The marks a charcoal draughtsman makes, as geometry on a Gfx surface:
// the stick's point (vine = soft grey, compressed = black and crisp), the SIDE of the stick for
// tone, the paper stump that rubs tone into the tooth, and the kneaded eraser that lifts it off
// again but never quite all of it. Plus the pass/mark clock the charcoal film is timed by.
//
// Kit primitives written here (candidates for core): registerTiles (four charcoal tiles),
// taperPoly (a centreline -> tapered, bitten ribbon, cut on the centreline by progress),
// zigzag (a rubbing path over a region), spiral (a circular rubbing), and the Pass/Step/Mark
// clock (`runPass`), which lays marks down one after another inside a pass.
import { Gfx, TILES, rng, fractal, type P } from "./core";
import { bounds, clamp, fillShape, hatchRuns, inside, lerp, lerpP, polyLen, resample, trace } from "./gallery";

// ---------------------------------------------------------------- tiles
// Registered into the shared TILES table under a ce_ prefix so Gfx.group can use them as tooth.
// Pure data, set once at module load; the tile builder caches by (kind, scale).
export const registerTiles = () => {
  TILES.ce_vine = { fx: 0.62, oct: 2, seed: 61, k: -3.1, o: 2.3 };      // vine skates over the tooth: broken, grey
  TILES.ce_comp = { fx: 0.85, oct: 2, seed: 62, k: -2.1, o: 2.0 };      // compressed bites deeper: mostly solid
  TILES.ce_blend = { fx: 0.4, oct: 3, seed: 63, k: -1.3, o: 1.55 };     // stumped tone: pushed into the valleys, still a little open
  TILES.ce_streak = { fx: 0.03, fy: 0.36, oct: 3, seed: 64, k: -1.25, o: 1.5 }; // an eraser drags, it does not lift evenly
  TILES.ce_sheet = { fx: 0.34, oct: 3, seed: 65, gray: true };           // heavy rag paper, felt-marked
};
registerTiles();

export const INK = "#1b1917";                      // charcoal is warm black, never #000
export const VINE = { textures: ["ce_vine"], blur: 0.55 };
export const COMP = { textures: ["ce_comp"] };
export const STUMP = (blur = 7) => ({ textures: ["ce_blend"], blur });
export const ERASE = (alpha: number, blur = 2.6) => ({ blend: "destination-out" as GlobalCompositeOperation, alpha, textures: ["ce_streak"], blur });

// ---------------------------------------------------------------- the clock
// A mark is anything a hand puts down in one go; `t` is how long it takes relative to its
// neighbours. A step is a run of marks sharing one tool (one Gfx group). A pass is a run of steps.
export type Mark = { t: number; d: (g: Gfx, p: number) => void };
export type Step = { o: Parameters<Gfx["group"]>[2]; m: Mark[] };
export const dur = (len: number, base = 0.35, per = 380) => base + len / per; // long strokes fast, fiddly strokes slow
export const runPass = (g: Gfx, steps: Step[], p: number) => {
  const total = steps.reduce((a, s) => a + s.m.reduce((b, m) => b + m.t, 0), 0);
  let budget = p >= 1 ? Infinity : p * total;
  for (const st of steps) {
    if (budget <= 0) break;
    const start = budget;
    g.group("plain", () => { let b = start; for (const m of st.m) { if (b <= 0) break; m.d(g, b >= m.t ? 1 : b / m.t); b -= m.t; } }, st.o);
    budget -= st.m.reduce((b, m) => b + m.t, 0);
  }
};

// ---------------------------------------------------------------- the stick
// Cut a polyline at fraction `p` of its vertex run (on the centreline, like core's pen).
export const upTo = (s: P[], p: number): P[] => {
  if (p >= 1) return s; const n = (s.length - 1) * p, i = Math.floor(n), f = n - i, h = s.slice(0, i + 1);
  if (f > 1e-9 && i + 1 < s.length) h.push(lerpP(s[i], s[i + 1], f));
  return h.length > 1 ? h : s.slice(0, 2);
};
// A centreline -> tapered ribbon whose edges the paper bites. Width runs w0 -> w1 along the
// FINISHED stroke, so a stroke seen half made already has its final weight where it has been.
export const taperPoly = (c0: P[], w0: number, w1: number, seed: number, o: { rough?: number; p?: number; ends?: number; step?: number } = {}): P[] => {
  const { rough = 0.5, p = 1, ends = 0, step = 3 } = o, L0 = polyLen(c0), n = Math.max(3, Math.round(L0 / step)), s = resample(c0, n), r = rng(seed);
  const cut = p >= 1 ? n - 1 : (n - 1) * p, L: P[] = [], R: P[] = [], ph = (seed % 13) * 0.7;
  for (let i = 0; i <= Math.ceil(cut) && i < n; i++) {
    const tt = Math.min(i, cut), i0 = Math.floor(tt), f = tt - i0, pt = i0 + 1 < n ? lerpP(s[i0], s[i0 + 1], f) : s[i0];
    const a = s[Math.max(0, i0 - 1)], b = s[Math.min(n - 1, i0 + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, t = tt / (n - 1);
    const endK = ends ? Math.min(1, t / ends, (1 - t) / ends) : 1, w = lerp(w0, w1, Math.pow(t, 0.85)) * (0.3 + 0.7 * Math.pow(clamp(endK), 0.6)) * (1 + 0.1 * Math.sin(t * 11 + ph)) / 2;
    const j1 = (r() - 0.5) * rough, j2 = (r() - 0.5) * rough;
    L.push([pt[0] - (dy / l) * (w + j1), pt[1] + (dx / l) * (w + j1)]); R.push([pt[0] + (dy / l) * (w + j2), pt[1] - (dx / l) * (w + j2)]);
  }
  return [...L, ...R.reverse()];
};
export const stick = (g: Gfx, c: P[], w0: number, w1: number, alpha: number, seed: number, p: number, o: { rough?: number; ends?: number; color?: string } = {}) => {
  if (p <= 0 || c.length < 2) return; fillShape(g, taperPoly(c, w0, w1, seed, { rough: o.rough ?? 0.6, p, ends: o.ends ?? 0 }), o.color ?? INK, alpha);
};

// ---------------------------------------------------------------- the side of the stick
// Broad parallel drags clipped to a region, density steered by `keep`. Returns marks, one per drag.
export const sideMarks = (region: P[], o: { angle: number; gap: number; w: number; alpha: number; seed: number; keep?: (x: number, y: number) => boolean; color?: string; per?: number; test?: (x: number, y: number) => boolean }): Mark[] => {
  const { angle, gap, w, alpha, seed, keep = () => true, color = INK, per = 900, test } = o, r = rng(seed), b = bounds(region);
  const runs = hatchRuns(b, angle, gap, (x, y) => (test ? test(x, y) : inside(region, x, y)) && keep(x, y), 4, seed);
  return runs.map((run) => {
    const a = alpha * (0.75 + r() * 0.45), jit: P[] = run.filter((_, k, arr) => k % 3 === 0 || k === arr.length - 1).map(([x, y]) => [x + (r() - 0.5) * 1.6, y + (r() - 0.5) * 1.6]);
    const len = polyLen(jit);
    return { t: 0.12 + len / per, d: (g: Gfx, p: number) => {
      const pts = upTo(jit, p), c = g.cur, bb = bounds(pts); g.touch(bb.x0 - w, bb.y0 - w, bb.x1 + w, bb.y1 + w);
      c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = color; c.lineWidth = w; c.globalAlpha = a; trace(c, pts, false); c.stroke(); c.restore();
    } };
  });
};

// ---------------------------------------------------------------- rubbing paths (stump and eraser)
// A back-and-forth rub across a region's box: rows `gap` apart, each a zigzag of amplitude `amp`.
export const zigzag = (b: { x0: number; y0: number; x1: number; y1: number }, gap: number, amp: number, seed: number, angle = 0): P[][] => {
  const r = rng(seed), rows: P[][] = [], cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, ca = Math.cos(angle), sa = Math.sin(angle);
  const hw = (b.x1 - b.x0) / 2 + gap, hh = (b.y1 - b.y0) / 2 + gap, R = Math.hypot(hw, hh);
  for (let v = -R, k = 0; v <= R; v += gap, k++) {
    const row: P[] = []; const dir = k % 2 ? -1 : 1;
    for (let u = -R, j = 0; u <= R; u += amp * 0.9, j++) { const uu = dir * u, vv = v + (j % 2 ? amp : -amp) * 0.5 + (r() - 0.5) * amp * 0.3; const x = cx + uu * ca - vv * sa, y = cy + uu * sa + vv * ca; if (x > b.x0 - gap && x < b.x1 + gap && y > b.y0 - gap && y < b.y1 + gap) row.push([x, y]); }
    if (row.length > 1) rows.push(row);
  }
  return rows;
};
export const spiral = (cx: number, cy: number, r0: number, r1: number, turns: number, seed: number): P[] => {
  const r = rng(seed), out: P[] = [], n = Math.round(turns * 28);
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2, rr = lerp(r0, r1, t) * (1 + (r() - 0.5) * 0.08); out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.96]); }
  return out;
};
// a rub is a round, soft, wide stroke: the stump's or the eraser's contact patch dragged along
// `clip` is one outline or several (a union of lobes, traced as subpaths of one nonzero path)
export const clipTo = (c: CanvasRenderingContext2D, clip: P[] | P[][]) => { const many = Array.isArray(clip[0]?.[0]) ? (clip as P[][]) : [clip as P[]]; c.beginPath(); many.forEach((s) => { s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }); c.clip(); };
export const rubMark = (path: P[], w: number, alpha: number, color = INK, clip?: P[] | P[][], per = 1400): Mark => ({ t: 0.2 + polyLen(path) / per, d: (g, p) => {
  const pts = upTo(path, p), c = g.cur, bb = bounds(pts); g.touch(bb.x0 - w, bb.y0 - w, bb.x1 + w, bb.y1 + w);
  c.save(); if (clip) clipTo(c, clip); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = color; c.lineWidth = w; c.globalAlpha = alpha; trace(c, pts, false); c.stroke(); c.restore();
} });
// a soft-edged dab (a leaf, a bud, a blot): a small bitten blob
export const dab = (g: Gfx, x: number, y: number, rx: number, ry: number, rot: number, alpha: number, seed: number, color = INK) => {
  const r = rng(seed), n = 9, pts: P[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.75 + r() * 0.45, px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k; pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]); }
  fillShape(g, pts, color, alpha);
};
export const noiseAt = (seed: number, x: number, y: number, f = 0.01) => fractal(seed, x, y, f, f, 3);
