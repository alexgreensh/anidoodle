// DRAWING MARKS. The pencil-family marks a drawing score is made of: a stroke with a pressure
// profile, hatching clipped to a region, a contour as a chain of overlapping strokes, the loose
// construction ellipse a teacher draws, a scribbled dot, an eraser sweep. Every mark is built
// ONCE from (points, seed) and frozen: its geometry never boils, so a finished mark cannot change
// while later marks go down, and `draw(c, 1)` is the still, byte for byte.
//
// Kin to colouredPencilKit.ts (the v1 coloured-pencil plate): same stroke profile idea, but these
// marks are addressable one by one, which is what a score needs.
import { rng, sample, type Ctx, type P } from "./core";

export type Box = [number, number, number, number];
export type Ink = { cost: number; box: Box; draw: (c: Ctx, p: number) => void; cl: P[] };
export type Region = { box: Box; has: (x: number, y: number) => boolean };

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const boxOf = (pts: P[], pad = 0): Box => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]; };
export const lengthOf = (c: P[]) => { let s = 0; for (let i = 1; i < c.length; i++) s += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]); return s; };
export const densify = (s: P[], step: number): P[] => { const out: P[] = [s[0]]; for (let i = 1; i < s.length; i++) { const a = s[i - 1], b = s[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } return out; };

// ---------------------------------------------------------------- regions (what hatching is clipped to)
export const inPoly = (pts: P[], x: number, y: number) => { let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
export const polyR = (pts: P[]): Region => { const box = boxOf(pts); return { box, has: (x, y) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inPoly(pts, x, y) }; };
export const ellR = (cx: number, cy: number, rx: number, ry: number, rot = 0): Region => { const c = Math.cos(-rot), s = Math.sin(-rot), R = Math.max(rx, ry); return { box: [cx - R, cy - R, cx + R, cy + R], has: (x, y) => { const dx = x - cx, dy = y - cy, u = dx * c - dy * s, v = dx * s + dy * c; return (u / rx) ** 2 + (v / ry) ** 2 <= 1; } }; };
export const union = (...rs: Region[]): Region => ({ box: [Math.min(...rs.map((r) => r.box[0])), Math.min(...rs.map((r) => r.box[1])), Math.max(...rs.map((r) => r.box[2])), Math.max(...rs.map((r) => r.box[3]))], has: (x, y) => rs.some((r) => r.has(x, y)) });
export const minus = (a: Region, ...bs: Region[]): Region => ({ box: a.box, has: (x, y) => a.has(x, y) && !bs.some((b) => b.has(x, y)) });
export const inter = (a: Region, b: Region): Region => ({ box: a.box, has: (x, y) => a.has(x, y) && b.has(x, y) });
// distance to a closed polygon's boundary: tone that gathers toward the turning edge of a form
export const edgeDist = (pts: P[]) => (x: number, y: number) => { let d = 1e9; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, ay] = pts[j], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / l); d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return d; };
export const ellipsePts = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 24): P[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as P; });

// ---------------------------------------------------------------- the stroke
// Pressure lands fast, holds, lifts in a longer taper. `taper` 0 = a blunt tool (marker, biro).
const profileOf = (t: number, taper: number) => 1 - taper + taper * Math.max(0.2, Math.pow(clamp(t / 0.14), 0.6) * Math.pow(clamp((1 - t) / 0.38), 0.75));
const outline = (c: P[], w: number, taper: number): P[] => {
  const n = c.length, L: P[] = [], R: P[] = [];
  for (let i = 0; i < n; i++) { const p = c[i], q = c[Math.min(n - 1, i + 1)], o = c[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, h = (w * profileOf(n > 1 ? i / (n - 1) : 0.5, taper)) / 2; L.push([p[0] - (dy / l) * h, p[1] + (dx / l) * h]); R.push([p[0] + (dy / l) * h, p[1] - (dx / l) * h]); }
  return [...L, ...R.reverse()];
};
const cut = (c: P[], p: number): P[] => { if (p >= 1) return c; const n = (c.length - 1) * p, i = Math.floor(n), f = n - i, head = c.slice(0, i + 1); if (f > 1e-6 && i + 1 < c.length) head.push([c[i][0] + (c[i + 1][0] - c[i][0]) * f, c[i][1] + (c[i + 1][1] - c[i][1]) * f]); return head.length > 1 ? head : c.slice(0, 2); };
const fillPoly = (c: Ctx, pts: P[]) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); };

export type StrokeOpts = { w: number; col: string; a: number; taper?: number; smooth?: boolean };
// One stroke. The centreline is resampled so a partial draw is cut ON the centreline and the
// travelling tip keeps its taper, which is how a line is seen being made.
export const stroke = (pts: P[], o: StrokeOpts): Ink => {
  const { w, col, a, taper = 1, smooth = true } = o, len = lengthOf(pts), per = Math.max(2, Math.min(12, Math.round(len / 5)));
  const c = densify(smooth && pts.length > 2 ? sample(pts, false, Math.max(2, Math.ceil(per / (pts.length - 1)) + 1)) : pts, Math.max(2, len / 40));
  const full = outline(c, w, taper);
  return { cost: len + 9, box: boxOf(full, 2), cl: c, draw: (cx, p) => { if (p <= 0) return; cx.globalAlpha = a; cx.fillStyle = col; fillPoly(cx, p >= 1 ? full : outline(cut(c, p), w, taper)); cx.globalAlpha = 1; } };
};

// ---------------------------------------------------------------- hatching
export type HatchOpts = {
  ang: number; gap: number; len: number; w: number; col: string; a: number; seed: number;
  dens?: (x: number, y: number) => number; // 0..1: how much tone at a point (pressure AND coverage)
  jit?: number; strip?: number; over?: number; taper?: number;
  back?: boolean;                          // back-and-forth zigzag strokes (a scribble fill) instead of lifted hatches
};
// Parallel strokes at one angle, laid side by side in strips the way a hand works a patch.
// Edges are where the strokes stop; tone is where they sit and how hard they press.
export const hatch = (reg: Region, o: HatchOpts): Ink[] => {
  const { ang, gap, len, w, col, a, seed, dens = () => 1, jit = 0.08, strip = 140, over = 1.5, taper = 1 } = o, r = rng(seed);
  const cs = Math.cos(ang), sn = Math.sin(ang), b = reg.box, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, R = Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + gap;
  const at = (u: number, v: number): P => [cx + u * cs - v * sn, cy + u * sn + v * cs];
  const found: { u: number; v: number; m: Ink }[] = [];
  for (let v = -R; v <= R; v += gap * (0.8 + r() * 0.4)) {
    let run0 = NaN;
    for (let u = -R; u <= R + 2; u += 2) {
      const [x, y] = at(u, v), ins = u <= R && reg.has(x, y);
      if (ins && isNaN(run0)) run0 = u;
      if (!ins && !isNaN(run0)) {
        const u0 = run0 - r() * over, u1 = u - 2 + r() * over; run0 = NaN; let s = u0 + (r() - 0.5) * len * 0.4;
        while (s < u1) {
          const L = len * (0.6 + r() * 0.7), e = Math.min(u1, s + L), s0 = Math.max(u0, s);
          if (e - s0 > 2.5) {
            const mu = (s0 + e) / 2, [mx, my] = at(mu, v), d = clamp(dens(mx, my));
            if (d > 0.03 && r() < Math.pow(d, 0.5)) {
              const tw = (r() - 0.5) * 2 * jit, dv = ((e - s0) * Math.sin(tw)) / 2, bow = (r() - 0.5) * 1.6;
              found.push({ u: mu, v, m: stroke([at(s0, v - dv), at(mu, v + bow), at(e, v + dv)], { w: w * (0.8 + r() * 0.4) * (0.7 + 0.3 * d), col, a: a * (0.35 + 0.65 * d) * (0.8 + r() * 0.35), taper }) });
            }
          }
          s = e + (r() - 0.4) * len * 0.3;
        }
      }
    }
  }
  found.sort((p, q) => { const sp = Math.floor((p.u + R) / strip), sq = Math.floor((q.u + R) / strip); return sp !== sq ? sp - sq : sp % 2 ? q.v - p.v : p.v - q.v; });
  // cost is shared: a hand hatches a patch quickly, so a hatch stroke costs less time than its length
  return found.map((f) => ({ ...f.m, cost: f.m.cost * 0.55 }));
};

// ---------------------------------------------------------------- contours
export type ContourOpts = { w: number; col: string; a: number; seed: number; seg?: number; keep?: (x: number, y: number, t: number) => number; closed?: boolean; smooth?: boolean; taper?: number };
// A contour the way a pencil draws one: overlapping strokes, each a touch off the last, the pressure
// lifting between them. keep(x, y, t) -> weight multiplier: 0 loses the edge where the light eats it.
export const contour = (pts: P[], o: ContourOpts): Ink[] => {
  const { w, col, a, seed, seg = 70, keep = () => 1, closed = false, smooth = true, taper = 1 } = o, r = rng(seed);
  const base = smooth ? sample(pts, closed, 8) : densify(closed ? [...pts, pts[0]] : pts, 3), path = densify(base, 2.5), n = path.length, out: Ink[] = [];
  let i = 0;
  while (i < n - 1) {
    const segLen = seg * (0.65 + r() * 0.7), start = Math.max(0, i - Math.round(1 + r() * 2)); let j = start, acc = 0;
    while (j < n - 1 && acc < segLen) { acc += Math.hypot(path[j + 1][0] - path[j][0], path[j + 1][1] - path[j][1]); j++; }
    const piece = path.slice(start, j + 1), mid = piece[piece.length >> 1], k = clamp(keep(mid[0], mid[1], (start + j) / 2 / n), 0, 2);
    if (piece.length > 1 && k > 0.05) { const off = (r() - 0.5) * 0.9, jj = rng(seed * 13 + i); out.push(stroke(piece.filter((_, q) => q % 2 === 0 || q === piece.length - 1).map(([x, y]) => [x + off + (jj() - 0.5) * 0.5, y + (jj() - 0.5) * 0.5] as P), { w: w * (0.8 + r() * 0.35) * (0.6 + 0.4 * k), col, a: a * Math.min(1, 0.5 + 0.5 * k) * (0.8 + r() * 0.25), taper, smooth: false })); }
    i = j;
  }
  return out;
};

// The construction ellipse a teacher draws: one fast, loose loop that goes round a little more than
// once, so the second pass corrects the first. Never a perfect circle.
export const sketchEllipse = (cx: number, cy: number, rx: number, ry: number, o: { rot?: number; w: number; col: string; a: number; seed: number; turns?: number }): Ink => {
  const { rot = 0, w, col, a, seed, turns = 1.18 } = o, r = rng(seed), a0 = -2.2 + r() * 0.6, pts: P[] = [], n = Math.round(40 * turns);
  for (let i = 0; i <= n; i++) { const t = i / n, ang = a0 + t * turns * Math.PI * 2, wob = 1 + (t > 0.85 ? (t - 0.85) * 0.25 : 0) + (r() - 0.5) * 0.02, x = Math.cos(ang) * rx * wob, y = Math.sin(ang) * ry * wob; pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
  return { ...stroke(pts, { w, col, a, taper: 0.6, smooth: false }), cost: lengthOf(pts) * 0.6 + 12 };
};
// a construction line: ruled freehand, overshooting both ends the way a lay-in does
export const guideLine = (a: P, b: P, o: { w: number; col: string; a: number; seed: number; bow?: number }): Ink => {
  const r = rng(o.seed), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, e0 = 6 + r() * 12, e1 = 6 + r() * 12, bow = o.bow ?? (r() - 0.5) * 3;
  return stroke([[a[0] - (dx / l) * e0, a[1] - (dy / l) * e0], [(a[0] + b[0]) / 2 - (dy / l) * bow, (a[1] + b[1]) / 2 + (dx / l) * bow], [b[0] + (dx / l) * e1, b[1] + (dy / l) * e1]], { w: o.w, col: o.col, a: o.a, taper: 0.7 });
};
// a small dark shape worked in place: a pencil twisted in a tight spiral (a pupil, a nostril, a note head)
export const scribbleDot = (x: number, y: number, rx: number, ry: number, o: { w: number; col: string; a: number; seed: number; rot?: number; turns?: number }): Ink => {
  const r = rng(o.seed), pts: P[] = [], n = 26, rot = o.rot ?? 0, turns = o.turns ?? 3;
  for (let k = 0; k <= n; k++) { const t = k / n, an = t * Math.PI * 2 * turns + r() * 0.2, rr = 1 - t * 0.75; const u = Math.cos(an) * rx * rr, v = Math.sin(an) * ry * rr; pts.push([x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot)]); }
  return { ...stroke(pts, { w: o.w, col: o.col, a: o.a, taper: 0.3, smooth: false }), cost: 40 };
};

// ---------------------------------------------------------------- the eraser
// A kneaded eraser worked back and forth over a box: the path it travels, and how wide it bites.
export const eraserPath = (b: Box, o: { seed: number; bite: number; ang?: number }): P[] => {
  const r = rng(o.seed), [x0, y0, x1, y1] = b, rows = Math.max(1, Math.ceil((y1 - y0) / (o.bite * 0.75))), pts: P[] = [];
  for (let i = 0; i <= rows; i++) { const y = y0 + ((y1 - y0) * i) / rows + (r() - 0.5) * o.bite * 0.2; pts.push(i % 2 ? [x1 + (r() - 0.5) * o.bite * 0.3, y] : [x0 + (r() - 0.5) * o.bite * 0.3, y]); }
  return pts;
};
// the eraser's bite, cut at progress p along its travel: ONE stroke() call, so where the path
// crosses itself the eraser still lifts only once (the ghost stays even)
export const eraserStroke = (c: Ctx, path: P[], width: number, p: number) => { const q = cut(densify(path, 6), p); c.lineWidth = width; c.lineJoin = "round"; c.lineCap = "round"; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]); c.stroke(); };
