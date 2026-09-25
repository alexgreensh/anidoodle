// FOLK-TALE KIT. The marks of a Russian folk-tale storybook painting, where DEPTH IS THE MEDIUM:
// the same object is painted opaque and rich in the foreground, thin and pale in the middle
// distance, and left as a bare graphite drawing on the cream sheet at the back.
//
// Every mark here takes a depth `d` (0 = at the viewer's feet, 1 = the horizon) and a progress
// `p` (0..1, exactly the finished mark at 1). Depth mixes colour toward the warm haze, thins the
// paint, drops the texture, and past ~0.9 leaves only the pencil.
//
// Kit primitives written for this plate (candidates for promotion to core):
//   pencil / sketch   graphite line with pressure breaks and a faint retrace; a list of lines drawn in order, paced by length
//   gouache           an opaque body-colour fill with dry-brush drags, sponge mottle and a darker settled rim, clipped to the shape
//   reveal            a wet brush front sweeping across a wash (a noisy clip), so a big area is PAINTED rather than faded in
//   faded             paint an element on a scratch layer and dissolve it by a gradient mask: paint thinning to bare drawing
//   leaf / lineLeaf   painted leaf (two-tone halves, midrib, side veins, mottle, rim) / the same leaf in pencil
//   petal, sunflower, daisy, bell, dogRose, umbel, blade/grass, limb, pumpkin, gourdLeaf, tendril
import { fractal, rng, sample, type Ctx, type Env, type Gfx, type Layer, type P } from "./core";
import { clamp, mix } from "./gallery";

export const PAPER = "#f4edda", HAZE = "#f2e9c9", GRAPH = "#6f665a";
export const LIGHT: P = [-0.6, -0.8]; // toward the sun: low, upper left

export const lighten = (c: string, k: number) => mix(c, "#fffbe8", clamp(k));
export const darken = (c: string, k: number) => mix(c, "#17170d", clamp(k));
export const far = (c: string, d: number) => mix(c, HAZE, clamp(d) * 0.85);

// ---------------------------------------------------------------- geometry
export type Box = [number, number, number, number];
export const bbox = (pts: P[]): Box => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
export const trace = (c: Ctx, pts: P[], closed = true) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (closed) c.closePath(); };
export const len = (s: P[]) => { let l = 0; for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); return l; };
export const cutAt = (s: P[], p: number): P[] => {
  if (p >= 1) return s; if (p <= 0) return s.slice(0, 1);
  const n = (s.length - 1) * p, i = Math.floor(n), f = n - i, out = s.slice(0, i + 1);
  if (f > 1e-9 && i + 1 < s.length) out.push([s[i][0] + (s[i + 1][0] - s[i][0]) * f, s[i][1] + (s[i + 1][1] - s[i][1]) * f]);
  return out;
};
const tan = (s: P[], i: number): P => { const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
// centreline + half-width -> closed outline (left side out, right side back)
export const ribbonOf = (s: P[], hw: (t: number) => number): P[] => {
  const L: P[] = [], R: P[] = [], n = s.length;
  for (let i = 0; i < n; i++) { const t = i / Math.max(1, n - 1), [dx, dy] = tan(s, i), w = hw(t); L.push([s[i][0] - dy * w, s[i][1] + dx * w]); R.push([s[i][0] + dy * w, s[i][1] - dx * w]); }
  return [...L, ...R.reverse()];
};
export const smooth = (pts: P[], per = 8, closed = false) => sample(pts, closed, per);
export const at = (x: number, y: number, a: number, r: number): P => [x + Math.cos(a) * r, y + Math.sin(a) * r];

// ---------------------------------------------------------------- pencil
// Graphite on a cream cartridge sheet: a soft HB line whose weight and darkness breathe with the
// pressure of the hand (noise along its length), lighter where it starts and lifts, with a faint
// second pass that does not quite sit on the first.
export type Line = { pts: P[]; seed: number; w?: number; a?: number; closed?: boolean; per?: number; col?: string; retrace?: boolean };
export const pencil = (c: Ctx, L: Line, p = 1) => {
  if (p <= 0 || L.pts.length < 2) return;
  const { w = 1.1, a = 0.72, seed, closed = false, per = 6, col = GRAPH, retrace = true } = L, r = rng(seed * 13 + 1);
  const ctrl = closed ? [...L.pts, L.pts[0]] : L.pts;
  const pass = (jit: number, alpha: number, wk: number, sd: number) => {
    const j = ctrl.map(([x, y]) => [x + (r() - 0.5) * jit, y + (r() - 0.5) * jit] as P), s = sample(j, false, per), n = s.length, m = p >= 1 ? n : Math.max(2, Math.ceil(n * p));
    c.strokeStyle = col; c.lineCap = "round"; c.lineJoin = "round";
    for (let i = 0; i < m - 1; i += 3) {
      const t = i / Math.max(1, n - 1), nz = fractal(sd, i * 0.19, 3.7, 1, 1, 2), end = Math.min(1, t / 0.07 + 0.4, (1 - t) / 0.09 + 0.35);
      c.globalAlpha = alpha * clamp(0.4 + 0.85 * nz) * end; c.lineWidth = w * wk * (0.7 + 0.6 * nz);
      c.beginPath(); c.moveTo(s[i][0], s[i][1]); for (let k = i + 1; k <= Math.min(m - 1, i + 3); k++) c.lineTo(s[k][0], s[k][1]); c.stroke();
    }
  };
  pass(0.9, a, 1, seed);
  if (retrace) pass(1.8, a * 0.3, 0.6, seed + 77);
  c.globalAlpha = 1;
};
// a sketch is lines drawn one after another; each gets time in proportion to its length
export const sketch = (c: Ctx, lines: Line[], p: number) => {
  if (p <= 0) return; if (p >= 1) { lines.forEach((l) => pencil(c, l, 1)); return; }
  const ls = lines.map((l) => len(l.pts) + 12), tot = ls.reduce((a, b) => a + b, 0); let acc = 0; const at = p * tot;
  for (let i = 0; i < lines.length; i++) { if (acc >= at) break; pencil(c, lines[i], clamp((at - acc) / ls[i])); acc += ls[i]; }
};

// ---------------------------------------------------------------- paint
// A dry-brush drag: a nearly spent flat brush leaves three or four bristle lines that break.
const drag = (c: Ctx, x: number, y: number, ang: number, l: number, w: number, a: number, r: () => number) => {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, k = 3 + Math.floor(r() * 2), bow = (r() - 0.5) * l * 0.18;
  for (let b = 0; b < k; b++) {
    const off = (b - (k - 1) / 2) * w * 0.5 + (r() - 0.5) * w * 0.3, l0 = l * r() * 0.3, l1 = l * (0.6 + r() * 0.4);
    c.globalAlpha = a * (0.3 + 0.7 * r()); c.lineWidth = w * (0.22 + 0.3 * r());
    const x0 = x + dx * l0 + nx * off, y0 = y + dy * l0 + ny * off, x1 = x + dx * l1 + nx * off, y1 = y + dy * l1 + ny * off;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + nx * bow, (y0 + y1) / 2 + ny * bow, x1, y1); c.stroke();
  }
};
export type Tex = { cols: string[]; n: number; len: number; w: number; ang: number; jit?: number; a?: number };
export type Mottle = { cols: string[]; n: number; r: number; a?: number; freq?: number };
export type Gouache = { seed: number; a?: number; tex?: Tex; mottle?: Mottle; rim?: string; rimW?: number; rimA?: number; wob?: number };
// Opaque body colour. The shape's edge wobbles as a brush-cut edge does, the paint is dragged
// dry over itself inside the shape, and it settles slightly darker along its rim.
export const gouache = (c: Ctx, poly: P[], col: string, o: Gouache) => {
  const { seed, a = 1, wob = 0 } = o, r = rng(seed * 7 + 5);
  const s = wob ? poly.map(([x, y]) => [x + (fractal(seed, x * 0.05, y * 0.05, 1, 1, 2) - 0.5) * wob, y + (fractal(seed + 3, x * 0.05, y * 0.05, 1, 1, 2) - 0.5) * wob] as P) : poly;
  c.globalAlpha = a; c.fillStyle = col; trace(c, s); c.fill();
  if (!o.tex && !o.mottle && !o.rim) { c.globalAlpha = 1; return; }
  c.save(); trace(c, s); c.clip();
  const [x0, y0, x1, y1] = bbox(s), bw = x1 - x0, bh = y1 - y0;
  if (o.tex) { const t = o.tex; c.lineCap = "round"; for (let i = 0; i < t.n; i++) { c.strokeStyle = t.cols[i % t.cols.length]; drag(c, x0 + r() * bw, y0 + r() * bh, t.ang + (r() - 0.5) * (t.jit ?? 0.3), t.len * (0.5 + r() * 0.7), t.w, (t.a ?? 0.35) * a, r); } }
  if (o.mottle) {
    const m = o.mottle, fq = m.freq ?? 0.06;
    for (let i = 0, tries = 0; i < m.n && tries < m.n * 4; tries++) {
      const x = x0 + r() * bw, y = y0 + r() * bh; if (fractal(seed + 11, x * fq, y * fq, 1, 1, 2) < 0.47 + r() * 0.12) continue; i++;
      const rr = m.r * (0.35 + r() * 0.8); c.globalAlpha = (m.a ?? 0.4) * (0.4 + 0.6 * r()) * a; c.fillStyle = m.cols[i % m.cols.length];
      c.beginPath(); c.ellipse(x, y, rr, rr * (0.55 + r() * 0.4), r() * 3, 0, Math.PI * 2); c.fill();
    }
  }
  if (o.rim) { c.globalAlpha = (o.rimA ?? 0.4) * a; c.strokeStyle = o.rim; c.lineWidth = (o.rimW ?? 2) * 2; c.lineJoin = "round"; trace(c, s); c.stroke(); }
  c.restore(); c.globalAlpha = 1;
};
// the brush front: clip to the part of the plane a sweep along `ang` has reached at progress p
export const reveal = (c: Ctx, box: Box, ang: number, p: number, seed: number, fn: () => void) => {
  if (p >= 1) { fn(); return; } if (p <= 0) return;
  const dx = Math.cos(ang), dy = Math.sin(ang), cs: P[] = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]];
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; cs.forEach(([x, y]) => { const u = x * dx + y * dy, v = -x * dy + y * dx; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); });
  const amp = Math.min(60, (u1 - u0) * 0.12 + 6), thr = u0 - amp + (u1 - u0 + 2 * amp) * p, pts: P[] = [], toXY = (u: number, v: number): P => [u * dx - v * dy, u * dy + v * dx];
  pts.push(toXY(u0 - 50, v0 - 50));
  for (let v = v0 - 50; v <= v1 + 50; v += 8) pts.push(toXY(thr + (fractal(seed, v * 0.018, p * 2, 1, 1, 2) - 0.5) * amp * 2, v));
  pts.push(toXY(thr, v1 + 50), toXY(u0 - 50, v1 + 50));
  c.save(); trace(c, pts); c.clip(); fn(); c.restore();
};
// paint that thins out into bare drawing: draw on a scratch sheet, keep it through a gradient mask
export const faded = (g: Gfx, box: Box, mask: (m: Ctx) => void, draw: (c: Ctx) => void) => {
  const e = g.env, k = e.scale, DW = Math.round(e.W * k), DH = Math.round(e.H * k), key = `ftk:scratch:${DW}x${DH}`;
  let L = e.cache.get(key) as Layer | undefined; if (!L) { L = e.canvas(DW, DH); e.cache.set(key, L); }
  const x0 = Math.max(0, Math.floor(box[0] * k) - 2), y0 = Math.max(0, Math.floor(box[1] * k) - 2), x1 = Math.min(DW, Math.ceil(box[2] * k) + 2), y1 = Math.min(DH, Math.ceil(box[3] * k) + 2);
  if (x1 <= x0 || y1 <= y0) return;
  const s = L.ctx; s.save(); s.setTransform(1, 0, 0, 1, 0, 0); s.globalAlpha = 1; s.globalCompositeOperation = "source-over"; s.clearRect(x0, y0, x1 - x0, y1 - y0);
  s.beginPath(); s.rect(x0, y0, x1 - x0, y1 - y0); s.clip(); s.setTransform(k, 0, 0, k, 0, 0); draw(s);
  s.globalAlpha = 1; s.globalCompositeOperation = "destination-in"; mask(s); s.restore();
  const c = g.cur; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.drawImage(L.canvas as CanvasImageSource, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); c.restore();
};
// a mask helper: a linear ramp of opacity across a box (stops as [t, alpha])
export const ramp = (m: Ctx, box: Box, a: P, b: P, stops: [number, number][]) => {
  const gr = m.createLinearGradient(a[0], a[1], b[0], b[1]); stops.forEach(([t, v]) => gr.addColorStop(t, `rgba(0,0,0,${clamp(v)})`));
  m.fillStyle = gr; m.fillRect(box[0] - 4, box[1] - 4, box[2] - box[0] + 8, box[3] - box[1] + 8);
};
export const radial = (m: Ctx, box: Box, cx: number, cy: number, r0: number, r1: number, stops: [number, number][], sy = 1) => {
  m.save(); m.translate(cx, cy); m.scale(1, sy); const gr = m.createRadialGradient(0, 0, r0, 0, 0, r1); stops.forEach(([t, v]) => gr.addColorStop(t, `rgba(0,0,0,${clamp(v)})`));
  m.fillStyle = gr; m.fillRect(-1e4, -1e4, 2e4, 2e4); m.restore(); void box;
};
// a soft wash of colour: a gradient band laid with the brush front
export const glowBand = (c: Ctx, box: Box, col: string, stops: [number, number][], vertical = true) => {
  const gr = vertical ? c.createLinearGradient(0, box[1], 0, box[3]) : c.createLinearGradient(box[0], 0, box[2], 0);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16)); stops.forEach(([t, v]) => gr.addColorStop(t, `rgba(${r},${g},${b},${clamp(v)})`));
  c.globalAlpha = 1; c.fillStyle = gr; c.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
};
export const rgba = (col: string, a: number) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16)); return `rgba(${r},${g},${b},${clamp(a)})`; };

// a tapered painted stroke (stems, twigs, blades, veins): a ribbon, grown from its base
export const stroke = (c: Ctx, ctrl: P[], w0: number, w1: number, col: string, a = 1, p = 1, per = 6) => {
  if (p <= 0) return; const s = cutAt(smooth(ctrl, per), p), full = p >= 1;
  const poly = ribbonOf(s, (t) => { const tt = full ? t : t * p; return Math.max(0.15, (w0 + (w1 - w0) * tt) / 2); });
  c.globalAlpha = a; c.fillStyle = col; trace(c, poly); c.fill(); c.globalAlpha = 1;
};

// ---------------------------------------------------------------- leaves
export type Leaf = { x: number; y: number; a: number; len: number; wid: number; col: string; seed: number; bend?: number; d?: number; serr?: number; vein?: string; stalk?: number; round?: number; cord?: number; tri?: boolean };
// A leaf is authored on its axis: attachment at t = 0, tip at t = 1. A cordate leaf's blade
// starts BEHIND the attachment (t = -cord), which gives the rounded lobes either side of the stalk.
export const leafGeom = (L: Leaf) => {
  const n = L.serr ? 30 : 16, ux = Math.cos(L.a), uy = Math.sin(L.a), vx = -uy, vy = ux, st = L.stalk ?? 0, bend = L.bend ?? 0, round = L.round ?? 0.78, cord = L.cord ?? 0;
  const c: P[] = [], ts: number[] = [];
  for (let i = 0; i < n; i++) { const t = -cord + ((1 + cord) * i) / (n - 1), u = st + L.len * t, v = bend * L.len * Math.max(0, t) ** 2; c.push([L.x + ux * u + vx * v, L.y + uy * u + vy * v]); ts.push(t); }
  const hw = (i: number) => { const uu = (ts[i] + cord) / (1 + cord), b = (L.wid / 2) * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, uu), round)), cord ? 0.5 : 0.85); return L.serr ? b * (1 + (i % 2 ? L.serr : -L.serr * 0.4)) : b; };
  const left: P[] = [], right: P[] = [];
  c.forEach((p, i) => { const [dx, dy] = tan(c, i), w = hw(i); left.push([p[0] - dy * w, p[1] + dx * w]); right.push([p[0] + dy * w, p[1] - dx * w]); });
  const ia = Math.round((cord / (1 + cord)) * (n - 1)), idx = (t: number) => Math.max(0, Math.min(n - 1, Math.round(((t + cord) / (1 + cord)) * (n - 1))));
  return { c, left, right, outline: [...left, ...right.slice().reverse()], n, ia, idx };
};
// the sun side of a leaf: whichever half's normal faces the light
const litLeft = (L: Leaf) => { const vx = -Math.sin(L.a), vy = Math.cos(L.a); return vx * LIGHT[0] + vy * LIGHT[1] > 0; };
const lerpP = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const leaf = (c: Ctx, L: Leaf, p = 1) => {
  if (p <= 0) return; const d = L.d ?? 0;
  if (d >= 0.93) { lineLeaf(c, L, p); return; }
  const G = leafGeom(L), grow = clamp(p / 0.6), det = clamp((p - 0.6) / 0.4), r = rng(L.seed), a = 1 - 0.5 * d;
  const lit = far(lighten(L.col, 0.16), d), shd = far(darken(L.col, 0.2), d), k = Math.max(2, Math.ceil(G.n * grow));
  const halfL = [...G.c.slice(0, k), ...G.left.slice(0, k).reverse()], halfR = [...G.c.slice(0, k), ...G.right.slice(0, k).reverse()], ll = litLeft(L);
  if (L.stalk) stroke(c, [[L.x, L.y], G.c[G.ia]], Math.max(1.6, L.wid * 0.05), Math.max(1.2, L.wid * 0.04), far(darken(L.col, 0.2), d), a);
  const mid = far(L.col, d);
  gouache(c, halfL, ll ? mix(mid, lit, 0.55) : mix(mid, shd, 0.55), { seed: L.seed, a }); gouache(c, halfR, ll ? mix(mid, shd, 0.55) : mix(mid, lit, 0.55), { seed: L.seed + 1, a });
  // the brush lay-in: strokes pulled from the midrib out along the side veins, each half in its own light
  if (grow >= 1 && d < 0.85) for (const [half, side, isLit] of [[halfL, G.left, ll], [halfR, G.right, !ll]] as [P[], P[], boolean][]) {
    c.save(); trace(c, half); c.clip(); const ns = Math.round(Math.max(5, L.len / 4.5) * (1 - d * 0.5));
    for (let i = 0; i < ns; i++) { const t = 0.02 + r() * 0.95, bi = G.idx(t), base = G.c[bi], e = side[G.idx(Math.min(1, t + 0.1))], from = lerpP(base, e, r() * 0.25), to = lerpP(base, e, 0.65 + r() * 0.45), col = isLit ? mix(lit, lighten(L.col, 0.35), r() * 0.6) : mix(shd, darken(L.col, 0.4), r() * 0.6);
      stroke(c, [from, lerpP(from, to, 0.5), to], Math.max(1.4, L.wid * (0.07 + r() * 0.08)), Math.max(0.6, L.wid * 0.03), far(col, d), (0.3 + r() * 0.35) * a, 1, 3); }
    c.restore();
  }
  if (det <= 0) return;
  const O = G.outline, area = L.len * L.wid * 0.6, tex = 1 - d, [bx0, by0, bx1, by1] = bbox(O);
  c.save(); trace(c, O); c.clip(); c.lineCap = "round";
  // dry-brush texture: short drags along the leaf, darker, then light flecks where the brush skipped
  const nd = Math.round((area / 90) * det * tex);
  for (let i = 0; i < nd; i++) { c.strokeStyle = r() < 0.5 ? darken(L.col, 0.3) : lighten(L.col, 0.08); const x = bx0 + r() * (bx1 - bx0), y = by0 + r() * (by1 - by0); c.globalAlpha = (0.1 + r() * 0.16) * a; c.lineWidth = 1 + r() * Math.max(1, L.wid * 0.04); const an = L.a + (r() < 0.5 ? 0.7 : -0.7) + (r() - 0.5) * 0.5, l = L.wid * (0.08 + r() * 0.18); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); c.stroke(); }
  const nm = Math.round((area / 22) * det * tex);
  for (let i = 0, t = 0; i < nm && t < nm * 4; t++) { const x = bx0 + r() * (bx1 - bx0), y = by0 + r() * (by1 - by0); if (fractal(L.seed, x * 0.08, y * 0.08, 1, 1, 2) < 0.52) continue; i++; const l = 0.8 + r() * Math.max(1.2, L.wid * 0.05), an = r() * 3.14; c.globalAlpha = (0.14 + r() * 0.24) * a; c.strokeStyle = r() < 0.7 ? lighten(L.col, 0.45) : darken(L.col, 0.4); c.lineWidth = 0.6 + r() * Math.max(0.6, L.wid * 0.022); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); c.stroke(); }
  // veins: the midrib, side veins leaving it outward and curving toward the tip, fading at the margin
  const vcol = far(L.vein ?? lighten(L.col, 0.42), d), nv = Math.max(3, Math.min(8, Math.round(L.len / 20))), shown = Math.round(nv * det), vw = Math.max(0.55, L.wid * 0.022);
  stroke(c, G.c.slice(G.ia, Math.max(G.ia + 2, G.idx(0.94))), Math.max(0.9, L.wid * 0.045), 0.3, vcol, 0.75 * a, det);
  if (L.tri) for (const side of [G.left, G.right]) stroke(c, [G.c[G.ia], lerpP(G.c[G.idx(0.1)], side[G.idx(0.12)], 0.6), lerpP(G.c[G.idx(0.45)], side[G.idx(0.5)], 0.72)], vw * 1.4, 0.3, vcol, 0.6 * a, det);
  for (let i = 0; i < shown; i++) {
    const t = 0.1 + (0.72 * (i + 0.5)) / nv, bi = G.idx(t), base = G.c[bi], fwd = G.idx(Math.min(1, t + 0.16));
    for (const side of [G.left, G.right]) stroke(c, [base, lerpP(base, side[bi], 0.5), lerpP(base, side[fwd], 0.8)], vw, 0.2, vcol, (0.28 + r() * 0.18) * a);
  }
  // the settled rim
  c.globalAlpha = 0.3 * a * det; c.strokeStyle = far(darken(L.col, 0.5), d); c.lineWidth = Math.max(1.2, L.wid * 0.03); trace(c, O); c.stroke();
  c.restore(); c.globalAlpha = 1;
};
export const lineLeaf = (c: Ctx, L: Leaf, p = 1, wash?: string) => {
  const G = leafGeom(L);
  if (wash && p >= 0.5) { c.globalAlpha = 0.35; c.fillStyle = wash; trace(c, G.outline); c.fill(); c.globalAlpha = 1; }
  pencil(c, { pts: G.outline.filter((_, i) => i % 2 === 0), seed: L.seed, w: 0.8, a: 0.55, closed: true, per: 4, retrace: false }, clamp(p / 0.8));
  if (p > 0.8) pencil(c, { pts: G.c.filter((_, i) => i % 3 === 0).slice(0, -1), seed: L.seed + 3, w: 0.6, a: 0.4, per: 4, retrace: false }, clamp((p - 0.8) / 0.2));
};

// ---------------------------------------------------------------- flowers
// One sunflower petal: a lanceolate ray, creased down the middle, the sun half lighter, painted
// in streaks along its length, darker where it tucks under the disc.
export const petal = (c: Ctx, cx: number, cy: number, ang: number, r0: number, l: number, w: number, lit: string, shd: string, seed: number, grow = 1, a = 1) => {
  const r = rng(seed), bend = (r() - 0.5) * 0.35, ll = l * grow, n = 9, s: P[] = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1), rr = r0 + ll * t, aa = ang + bend * t * t * (l / Math.max(1, rr)) * 0.6; s.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr]); }
  const hw = (t: number) => (w / 2) * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, t * 0.97 + 0.03), 0.62)), 0.8);
  const L: P[] = [], R: P[] = []; s.forEach((p, i) => { const [dx, dy] = tan(s, i), h = hw(i / (n - 1)); L.push([p[0] - dy * h, p[1] + dx * h]); R.push([p[0] + dy * h, p[1] - dx * h]); });
  const lft = Math.cos(ang + Math.PI / 2) * LIGHT[0] + Math.sin(ang + Math.PI / 2) * LIGHT[1] > 0;
  c.globalAlpha = a; c.fillStyle = lft ? lit : shd; trace(c, [...s, ...L.slice().reverse()]); c.fill();
  c.fillStyle = lft ? shd : lit; trace(c, [...s, ...R.slice().reverse()]); c.fill();
  // streaks along the ray and a darker root
  c.strokeStyle = darken(shd, 0.25); c.lineCap = "round";
  for (let k = 0; k < 5; k++) { const off = (k - 2) * 0.17, from = 1 + Math.floor(r() * 2), to = n - 2 - Math.floor(r() * 3); c.globalAlpha = a * (0.18 + r() * 0.2); c.lineWidth = Math.max(0.5, w * 0.06); c.beginPath(); for (let i = from; i <= to; i++) { const [dx, dy] = tan(s, i), h = hw(i / (n - 1)) * off * 2; const x = s[i][0] - dy * h, y = s[i][1] + dx * h; i === from ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); }
  c.globalAlpha = a * 0.35; c.strokeStyle = darken(shd, 0.3); c.lineWidth = Math.max(0.6, w * 0.07); trace(c, [...L, ...R.slice().reverse()]); c.stroke();
  c.globalAlpha = a * 0.3; c.strokeStyle = lighten(lit, 0.5); c.lineWidth = Math.max(0.5, w * 0.08); c.beginPath(); c.moveTo(s[2][0], s[2][1]); for (let i = 3; i < n - 1; i++) c.lineTo(s[i][0], s[i][1]); c.stroke();
  c.globalAlpha = 1;
};
export type Sun = { x: number; y: number; r: number; rot: number; sq: number; seed: number; n?: number; pl?: number; pw?: number; d?: number; droop?: number; pal?: [string, string, string, string] };
// A sunflower head: back ray ring, front ray ring, then the disc of florets in concentric bands
// (dark rim, an olive-brown band of open florets, a dark raised centre), spiralled like the plant.
export const sunflower = (c: Ctx, S: Sun, p = 1) => {
  if (p <= 0) return; const d = S.d ?? 0, n = S.n ?? 21, pl = S.pl ?? S.r * 1.25, pw = S.pw ?? S.r * 0.42, r = rng(S.seed), a = 1 - 0.45 * d;
  const units = 2 * n + 6, u = p * units;
  c.save(); c.translate(S.x, S.y); c.rotate(S.rot); c.scale(1, S.sq);
  const [Y, YD, YB, YBd] = S.pal ?? ["#f6c72b", "#dd9314", "#c98612", "#9c5f0e"];
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < n; i++) {
    const idx = ring * n + i; if (idx >= u) break; const g = clamp(u - idx), ang = ((i + (ring ? 0 : 0.5)) / n) * Math.PI * 2 + (r() - 0.5) * 0.12, ln = pl * (ring ? 0.78 + r() * 0.42 : 0.7 + r() * 0.35), wd = pw * (0.75 + r() * 0.5);
    petal(c, 0, 0, ang, S.r * (ring ? 0.9 : 0.95), ln, wd, far(ring ? Y : YB, d), far(ring ? YD : YBd, d), S.seed * 100 + idx, g, a);
  }
  const dp = clamp((u - 2 * n) / 6);
  if (dp > 0) {
    c.globalAlpha = a * clamp(dp * 3); c.fillStyle = far("#3f2a12", d); c.beginPath(); c.arc(0, 0, S.r * 1.02, 0, Math.PI * 2); c.fill();
    if (dp > 0.3) { c.fillStyle = far("#6d5220", d); c.beginPath(); c.arc(0, 0, S.r * 0.8, 0, Math.PI * 2); c.fill(); c.fillStyle = far("#8a6c2c", d); c.beginPath(); c.arc(-S.r * 0.05, -S.r * 0.05, S.r * 0.66, 0, Math.PI * 2); c.fill(); }
    if (dp > 0.5) { c.fillStyle = far("#4a3214", d); c.beginPath(); c.arc(0, 0, S.r * 0.52, 0, Math.PI * 2); c.fill(); c.fillStyle = far("#2d1d0b", d); c.beginPath(); c.arc(S.r * 0.03, S.r * 0.03, S.r * 0.34, 0, Math.PI * 2); c.fill(); }
    if (dp > 0.7 && d < 0.7) { // the florets: short curved dabs laid round the disc in rings, then the spiral seeds at the heart
      const q = clamp((dp - 0.7) / 0.3), rr = rng(S.seed + 9), R = S.r;
      c.lineCap = "round";
      const ring = (r0: number, r1: number, n: number, cols: string[], w: number, al: number) => { const rr = rng(S.seed + Math.round(r0 * 7)); for (let i = 0; i < Math.round(n * q); i++) { const th = rr() * Math.PI * 2, rad = r0 + (r1 - r0) * rr(), l = w * (1.2 + rr() * 1.5); c.globalAlpha = a * al * (0.5 + rr() * 0.5); c.strokeStyle = cols[i % cols.length]; c.lineWidth = w * (0.6 + rr() * 0.5); c.beginPath(); c.arc(0, 0, rad, th, th + l / rad); c.stroke(); } };
      ring(R * 0.84, R * 1.0, R * 3, ["#2a1a08", "#5a3c16", "#1e1206"], R * 0.07, 0.8);
      ring(R * 0.56, R * 0.82, R * 3.4, ["#b09048", "#7a5a22", "#c8a85a", "#5a4018"], R * 0.07, 0.75);
      ring(R * 0.36, R * 0.56, R * 2, ["#3a2610", "#6a4a1e"], R * 0.06, 0.7);
      const Nn = Math.round(R * R * 0.05 * q); for (let i = 0; i < Nn; i++) { const rad = Math.sqrt((i + 0.5) / Math.max(1, R * R * 0.05)) * R * 0.36, th = i * 2.39996; c.globalAlpha = a * 0.6; c.fillStyle = i % 3 ? "#1a1006" : "#4a3214"; c.beginPath(); c.arc(Math.cos(th) * rad, Math.sin(th) * rad, R * 0.028, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = a * 0.3; c.strokeStyle = "#f0d078"; c.lineWidth = R * 0.07; c.beginPath(); c.arc(0, 0, R * 0.7, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
      c.globalAlpha = a * 0.4; c.strokeStyle = "#140b04"; c.lineWidth = R * 0.1; c.beginPath(); c.arc(0, 0, R * 0.95, Math.PI * 0.05, Math.PI * 0.75); c.stroke();
    }
  }
  c.restore(); c.globalAlpha = 1;
};
// a meadow daisy (ox-eye), seen a little from above: white rays, their undersides greyed, a yellow boss
export const daisy = (c: Ctx, x: number, y: number, r: number, seed: number, d = 0, sq = 0.62, p = 1) => {
  if (p <= 0) return; const rr = rng(seed), n = 13, a = (1 - 0.5 * d) * clamp(p * 1.5);
  c.save(); c.translate(x, y); c.rotate((rr() - 0.5) * 0.5); c.scale(1, sq);
  for (let i = 0; i < n; i++) { const th = (i / n) * Math.PI * 2 + rr() * 0.2, l = r * (0.85 + rr() * 0.3); c.globalAlpha = a; c.fillStyle = far(Math.sin(th) > 0.3 ? "#ddd8cc" : "#fbf8ef", d); c.beginPath(); c.ellipse(Math.cos(th) * l * 0.55, Math.sin(th) * l * 0.55, l * 0.5, r * 0.19, th, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = a; c.fillStyle = far("#e8b62a", d); c.beginPath(); c.arc(0, 0, r * 0.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = far("#b9791a", d); c.beginPath(); c.arc(r * 0.07, r * 0.08, r * 0.17, 0, Math.PI * 2); c.fill();
  c.restore(); c.globalAlpha = 1;
};
// a bellflower (Campanula): a nodding bell, narrow at the calyx, flaring to five pointed lobes
// that curl out at the mouth; the dark throat shows between the front lobes
export const bell = (c: Ctx, x: number, y: number, s: number, ang: number, seed: number, d = 0, col = "#5d6fc4", p = 1) => {
  if (p <= 0) return; const r = rng(seed), a = (1 - 0.45 * d) * clamp(p * 1.4), L = s, Wd = s * 0.78;
  c.save(); c.translate(x, y); c.rotate(ang);
  const ctrl: P[] = [[-Wd * 0.1, 0], [-Wd * 0.26, L * 0.35], [-Wd * 0.33, L * 0.7], [-Wd * 0.42, L * 0.88], [-Wd * 0.62, L * 0.98], [-Wd * 0.4, L * 0.97], [-Wd * 0.24, L * 1.0], [0, L * 1.1], [Wd * 0.24, L * 1.0], [Wd * 0.4, L * 0.97], [Wd * 0.62, L * 0.98], [Wd * 0.42, L * 0.88], [Wd * 0.33, L * 0.7], [Wd * 0.26, L * 0.35], [Wd * 0.1, 0]];
  const body = sample(ctrl.map(([px, py]) => [px + (r() - 0.5) * s * 0.03, py] as P), true, 5);
  c.globalAlpha = a; c.fillStyle = far(col, d); trace(c, body); c.fill();
  c.save(); trace(c, body); c.clip();
  c.fillStyle = far(darken(col, 0.32), d); c.beginPath(); c.moveTo(Wd * 0.04, 0); c.quadraticCurveTo(Wd * 0.22, L * 0.6, Wd * 0.2, L * 1.1); c.lineTo(Wd, L * 1.1); c.lineTo(Wd, 0); c.fill();
  c.globalAlpha = a * 0.75; c.fillStyle = far(lighten(col, 0.4), d); c.beginPath(); c.moveTo(-Wd * 0.12, L * 0.08); c.quadraticCurveTo(-Wd * 0.3, L * 0.55, -Wd * 0.26, L * 0.92); c.lineTo(-Wd * 0.14, L * 0.9); c.quadraticCurveTo(-Wd * 0.16, L * 0.5, -Wd * 0.04, L * 0.1); c.fill();
  c.globalAlpha = a * 0.9; c.fillStyle = far("#2a2a5a", d); c.beginPath(); c.ellipse(0, L * 0.97, Wd * 0.26, L * 0.06, 0, 0, Math.PI * 2); c.fill();
  c.globalAlpha = a * 0.45; c.strokeStyle = far(darken(col, 0.45), d); c.lineWidth = Math.max(0.6, s * 0.025); for (const [tx2, ty2] of [[-Wd * 0.55, L * 0.97], [0, L * 1.08], [Wd * 0.55, L * 0.97]] as P[]) { c.beginPath(); c.moveTo(tx2 * 0.15, L * 0.08); c.quadraticCurveTo(tx2 * 0.5, L * 0.6, tx2, ty2); c.stroke(); }
  c.restore();
  c.globalAlpha = a; c.fillStyle = far("#3c5a2a", d); for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(0, -1); c.quadraticCurveTo(sg * Wd * 0.3, L * 0.02, sg * Wd * 0.34, -L * 0.14); c.quadraticCurveTo(sg * Wd * 0.12, L * 0.0, 0, L * 0.12); c.fill(); }
  c.restore(); c.globalAlpha = 1;
};
// dog-rose: five notched pink petals, pale at the heart, a ring of yellow stamens
export const dogRose = (c: Ctx, x: number, y: number, r: number, rot: number, sq: number, seed: number, d = 0, p = 1) => {
  if (p <= 0) return; const rr = rng(seed), a = (1 - 0.45 * d) * clamp(p * 1.4);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, sq);
  for (let i = 0; i < 5; i++) {
    const th = (i / 5) * Math.PI * 2 + rr() * 0.15, pts: P[] = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12, phi = th + (t - 0.5) * 1.25, rad = r * (0.2 + 0.8 * Math.sin(Math.PI * t) ** 0.35) * (1 - 0.12 * Math.exp(-(((t - 0.5) * 9) ** 2))); pts.push([Math.cos(phi) * rad, Math.sin(phi) * rad]); }
    pts.push([0, 0]);
    c.globalAlpha = a; c.fillStyle = far(Math.sin(th) > 0.2 ? "#e48aa0" : "#f3b3c0", d); trace(c, pts); c.fill();
    c.globalAlpha = a * 0.6; c.fillStyle = far("#fde9e6", d); c.beginPath(); c.ellipse(Math.cos(th) * r * 0.32, Math.sin(th) * r * 0.32, r * 0.2, r * 0.13, th, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = a; c.fillStyle = far("#c9a33a", d); c.beginPath(); c.arc(0, 0, r * 0.2, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 16; i++) { const th = (i / 16) * Math.PI * 2, q = r * (0.24 + rr() * 0.06); c.fillStyle = far("#f2c936", d); c.beginPath(); c.arc(Math.cos(th) * q, Math.sin(th) * q, r * 0.045, 0, Math.PI * 2); c.fill(); }
  c.restore(); c.globalAlpha = 1;
};
// cow parsley / wild carrot gone to seed: dark hairline rays, each ending in a small umbel
export const umbel = (c: Ctx, x: number, y: number, r: number, seed: number, col = "#2f3320", p = 1, a = 0.85) => {
  if (p <= 0) return; const rr = rng(seed), n = 11;
  c.strokeStyle = col; c.fillStyle = col; c.lineCap = "round";
  for (let i = 0; i < n; i++) {
    if (i / n > p) break; const th = -Math.PI / 2 + ((i / (n - 1)) - 0.5) * 2.4 + (rr() - 0.5) * 0.15, l = r * (0.75 + rr() * 0.35), ex = x + Math.cos(th) * l, ey = y + Math.sin(th) * l * 0.75;
    c.globalAlpha = a * 0.8; c.lineWidth = Math.max(1, r * 0.028); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 - l * 0.12, ex, ey); c.stroke();
    for (let k = 0; k < 7; k++) { const t2 = -Math.PI / 2 + ((k / 6) - 0.5) * 2.2, l2 = r * 0.22 * (0.7 + rr() * 0.5), fx = ex + Math.cos(t2) * l2, fy = ey + Math.sin(t2) * l2 * 0.8; c.globalAlpha = a * 0.7; c.lineWidth = Math.max(0.6, r * 0.015); c.beginPath(); c.moveTo(ex, ey); c.lineTo(fx, fy); c.stroke(); c.globalAlpha = a; c.beginPath(); c.arc(fx, fy, Math.max(1.3, r * 0.03), 0, Math.PI * 2); c.fill(); }
  }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- grass
// A meadow is thousands of blades, painted back to front: dark roots first, then blades in
// several greens, leaning with the wind, the tips catching the light.
export type Grass = { x0: number; x1: number; base: (x: number) => number; n: number; h: [number, number]; w: number; cols: string[]; lean?: number; seed: number; d?: number; tip?: string; spread?: number; a?: number; clump?: number; skip?: (x: number, y: number) => boolean; dry?: string };
// clumps: several blades fanning from one root, as grass actually grows and as a brush lays it
export const grass = (c: Ctx, G: Grass, p = 1) => {
  if (p <= 0) return; const r = rng(G.seed), d = G.d ?? 0, a0 = (G.a ?? 1) * (1 - 0.45 * d), spread = G.spread ?? 14, cols = G.cols.map((k) => far(k, d)), tip = G.tip ? far(G.tip, d) : null, dry = G.dry ? far(G.dry, d) : null, per = G.clump ?? 1;
  const clumps = Math.ceil(G.n / per), m = p >= 1 ? clumps : Math.floor(clumps * p);
  c.lineCap = "round";
  for (let i = 0; i < m; i++) {
    const x = G.x0 + r() * (G.x1 - G.x0), y = G.base(x) + r() * spread, H0 = G.h[0] + (G.h[1] - G.h[0]) * r() ** 1.3, lean0 = (G.lean ?? 0.2) + (r() - 0.5) * 0.5, k = per === 1 ? 1 : Math.max(2, Math.round(per * (0.6 + r() * 0.8))), skip = G.skip?.(x, y) ?? false;
    for (let b = 0; b < k; b++) {
      const fan = k === 1 ? 0 : ((b / (k - 1)) - 0.5) * 1.3, h = H0 * (0.55 + r() * 0.5) * (1 - Math.abs(fan) * 0.3), lean = lean0 + fan * 0.55 + (r() - 0.5) * 0.25, w = G.w * (0.6 + r() * 0.7);
      const col = dry && r() < 0.08 ? dry : cols[Math.floor(r() * cols.length)], al = a0 * (0.6 + r() * 0.4), bx = x + (r() - 0.5) * 4;
      if (skip) continue;
      const tx = bx + lean * h, ty = y - h * (1 - Math.abs(lean) * 0.15), mx = bx + lean * h * 0.3 + (r() - 0.5) * h * 0.08, my = y - h * 0.55;
      c.globalAlpha = al; c.fillStyle = col; c.beginPath(); c.moveTo(bx - w / 2, y); c.quadraticCurveTo(mx - w * 0.35, my, tx, ty); c.quadraticCurveTo(mx + w * 0.35, my, bx + w / 2, y); c.closePath(); c.fill();
      if (tip && r() < 0.5) { c.globalAlpha = al * 0.7; c.strokeStyle = tip; c.lineWidth = Math.max(0.5, w * 0.28); c.beginPath(); c.moveTo(bx + (mx - bx) * 0.9 - w * 0.15, my); c.quadraticCurveTo(mx + (tx - mx) * 0.55, my - h * 0.22, tx, ty); c.stroke(); }
    }
  }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- limbs and bark
// A painted limb: body colour, the shadow side laid wet beside it, bark drags along the grain.
export const limb = (c: Ctx, ctrl: P[], w0: number, w1: number, col: string, seed: number, d = 0, p = 1, shade = 0.3, grain = 1) => {
  if (p <= 0) return; const s = cutAt(smooth(ctrl, 8), p), a = 1 - 0.5 * d, r = rng(seed);
  if (s.length < 2) return;
  const hw = (t: number) => (w0 + (w1 - w0) * t * (p >= 1 ? 1 : p)) / 2;
  const body = ribbonOf(s, hw);
  c.globalAlpha = a; c.fillStyle = far(col, d); trace(c, body); c.fill();
  // the shadow half: which side faces away from the sun
  const [tx, ty] = tan(s, Math.floor(s.length / 2)), rightLit = (ty * LIGHT[0] - tx * LIGHT[1]) > 0;
  const shadeSide: P[] = []; const n = s.length;
  for (let i = 0; i < n; i++) { const [dx, dy] = tan(s, i), w = hw(i / Math.max(1, n - 1)), sg = rightLit ? -1 : 1; shadeSide.push([s[i][0] - dy * w * sg, s[i][1] + dx * w * sg]); }
  const mid: P[] = s.map((q, i) => { const [dx, dy] = tan(s, i), w = hw(i / Math.max(1, n - 1)) * 0.15, sg = rightLit ? -1 : 1; return [q[0] - dy * w * sg, q[1] + dx * w * sg]; });
  c.globalAlpha = a * 0.85; c.fillStyle = far(darken(col, shade), d); trace(c, [...mid, ...shadeSide.reverse()]); c.fill();
  if (grain > 0 && d < 0.8) { // bark: drags along the limb
    c.save(); trace(c, body); c.clip(); c.lineCap = "round";
    const L = len(s), k = Math.round((L * (w0 + w1)) / 2 / 40 * grain);
    for (let i = 0; i < k; i++) { const t = r(), idx = Math.min(n - 2, Math.floor(t * (n - 1))), [dx, dy] = tan(s, idx), off = (r() - 0.5) * 2 * hw(t) * 0.95, x = s[idx][0] - dy * off, y = s[idx][1] + dx * off, l = 6 + r() * Math.max(10, w0 * 1.2); c.strokeStyle = far(r() < 0.5 ? darken(col, 0.45) : lighten(col, 0.3), d); drag(c, x, y, Math.atan2(dy, dx) + (r() - 0.5) * 0.15, l, Math.max(1.5, w0 * 0.12), 0.45 * a, r); }
    c.restore();
  }
  c.globalAlpha = 1;
};
// the same limb in pencil only: two edge lines and a few grain ticks
export const lineLimb = (w0: number, w1: number, ctrl: P[], seed: number, a = 0.6): Line[] => {
  const s = smooth(ctrl, 3), n = s.length, L: P[] = [], R: P[] = [];
  s.forEach((q, i) => { const [dx, dy] = tan(s, i), w = (w0 + (w1 - w0) * (i / Math.max(1, n - 1))) / 2; L.push([q[0] - dy * w, q[1] + dx * w]); R.push([q[0] + dy * w, q[1] - dx * w]); });
  const out: Line[] = [{ pts: L, seed, a, w: 0.95, per: 3 }, { pts: R, seed: seed + 1, a: a * 0.85, w: 0.9, per: 3 }];
  if (w0 > 10) { const r = rng(seed); for (let k = 0; k < Math.round(w0 / 5); k++) { const i = Math.floor(r() * (n - 3)), [dx, dy] = tan(s, i), off = (r() - 0.5) * (w0 + (w1 - w0) * (i / n)) * 0.7, x = s[i][0] - dy * off, y = s[i][1] + dx * off, l = 8 + r() * 20; out.push({ pts: [[x, y], [x + dx * l * 0.5 + (r() - 0.5) * 2, y + dy * l * 0.5], [x + dx * l, y + dy * l]], seed: seed + 10 + k, a: a * 0.5, w: 0.7, retrace: false }); } }
  return out;
};

// ---------------------------------------------------------------- the garden
// a ribbed pumpkin: lobes between meridians, lit lobes warm, shadow lobes deep, grooves dark,
// a dry twisted stalk sunk in the dimple, a cast shadow on the ground to the lower right
export const pumpkin = (c: Ctx, x: number, y: number, rx: number, ry: number, seed: number, d = 0, p = 1, col = "#e2761c") => {
  if (p <= 0) return; const r = rng(seed), a = 1 - 0.45 * d, k = 9, ph = clamp(p / 0.7), det = clamp((p - 0.7) / 0.3);
  c.save();
  c.globalAlpha = 0.35 * a * ph; c.fillStyle = far("#2e3e16", d); c.beginPath(); c.ellipse(x + rx * 0.28, y + ry * 0.86, rx * 1.1, ry * 0.26, 0, 0, Math.PI * 2); c.fill();
  const phi = Array.from({ length: k + 1 }, (_, i) => -Math.PI / 2 + (Math.PI * i) / k + (i && i < k ? (r() - 0.5) * 0.08 : 0));
  const mer = (f: number, t: number): P => { const w = Math.pow(Math.sin(Math.PI * t), 0.42), yy = -ry + 2 * ry * t; return [x + Math.sin(f) * rx * w, y + yy * (0.82 + 0.18 * w) + Math.cos(f) * ry * 0.06]; };
  const lobe = (f0: number, f1: number): P[] => { const A: P[] = [], B: P[] = []; for (let s = 0; s <= 14; s++) { const t = s / 14; A.push(mer(f0, t)); B.push(mer(f1, t)); } return [...A, ...B.reverse()]; };
  const order = Array.from({ length: k }, (_, i) => i).sort((i, j) => Math.abs(i + 0.5 - k / 2) < Math.abs(j + 0.5 - k / 2) ? 1 : -1);
  order.forEach((i, o) => {
    if (o / k > ph) return; const m = (i + 0.5) / k, lit = clamp(1 - m * 0.95), base = mix(darken(col, 0.42), lighten(col, 0.1), lit), f0 = phi[i], f1 = phi[i + 1];
    gouache(c, lobe(f0, f1), far(base, d), { seed: seed + i, a, rim: far(darken(col, 0.55), d), rimW: 1.6, rimA: 0.6 });
    // the lobe's own roundness: a lighter lens toward the sun, a dark foot
    gouache(c, lobe(f0 + (f1 - f0) * 0.18, f1 - (f1 - f0) * 0.45).map(([px, py]) => [px, py - ry * 0.06] as P), far(mix(base, "#ffd070", 0.35 * lit + 0.1), d), { seed: seed + 30 + i, a: a * 0.55 });
    if (det > 0) { c.save(); trace(c, lobe(f0, f1)); c.clip();
      for (let q = 1; q < 4; q++) { const f = f0 + ((f1 - f0) * q) / 4; c.globalAlpha = 0.18 * a * det; c.strokeStyle = far(q % 2 ? darken(col, 0.4) : lighten(col, 0.35), d); c.lineWidth = 1.2; c.beginPath(); for (let s = 1; s < 14; s++) { const P0 = mer(f, s / 14); s === 1 ? c.moveTo(P0[0], P0[1]) : c.lineTo(P0[0], P0[1]); } c.stroke(); }
      const gr = c.createLinearGradient(0, y + ry * 0.2, 0, y + ry); gr.addColorStop(0, rgba("#3a1a06", 0)); gr.addColorStop(1, rgba("#3a1a06", 0.45 * det)); c.globalAlpha = a; c.fillStyle = gr; c.fillRect(x - rx - 2, y - ry, rx * 2 + 4, ry * 2 + 4);
      c.restore(); }
  });
  if (det > 0) {
    c.globalAlpha = a * det; c.fillStyle = far(darken(col, 0.5), d); c.beginPath(); c.ellipse(x, y - ry * 0.8, rx * 0.16, ry * 0.07, 0, 0, Math.PI * 2); c.fill();
    const sx = x + (r() - 0.5) * rx * 0.06, top: P = [sx + rx * 0.12, y - ry * 1.18];
    gouache(c, [[sx - rx * 0.08, y - ry * 0.8], [sx - rx * 0.07, y - ry * 1.02], [top[0] - 4, top[1] - 2], [top[0] + 4, top[1] + 3], [sx + rx * 0.07, y - ry * 1.0], [sx + rx * 0.09, y - ry * 0.8]], far("#6a6a2c", d), { seed: seed + 50, a, rim: far("#2e2e10", d), rimA: 0.6, rimW: 1.2 });
    stroke(c, [[sx - rx * 0.03, y - ry * 0.82], [sx - rx * 0.02, y - ry * 1.0], [top[0] - 2, top[1]]], 2, 1, far("#a8a45a", d), 0.7 * a);
  }
  c.restore(); c.globalAlpha = 1;
};
// a pumpkin leaf (Cucurbita): broad, palmately five-lobed with shallow sinuses, a deep notch at the
// stalk, fine teeth; dark and rough, the main veins pale and raised, seen a little from above
export const gourdLeaf = (c: Ctx, x: number, y: number, s: number, rot: number, sq: number, col: string, seed: number, d = 0, p = 1) => {
  if (p <= 0) return; const r = rng(seed), a = 1 - 0.45 * d, g = clamp(p / 0.6), det = clamp((p - 0.6) / 0.4);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, sq);
  const tips = [-1.75, -0.9, 0, 0.9, 1.75].map((t) => t + (r() - 0.5) * 0.15), lens = tips.map(() => 0.85 + r() * 0.2);
  const rad = (th: number) => { let m = 0; tips.forEach((t, k) => { m = Math.max(m, lens[k] * Math.exp(-(((th - t) / 0.36) ** 2))); }); return s * g * (0.62 + 0.38 * m) * (1 - 0.3 * (Math.abs(th) / Math.PI) ** 2) * (1 + 0.025 * Math.sin(th * 46 + seed)); };
  const out: P[] = []; for (let i = 0; i <= 90; i++) { const th = -Math.PI * 0.9 + (i / 90) * Math.PI * 1.8; out.push([Math.sin(th) * rad(th), -Math.cos(th) * rad(th) * 0.95]); }
  const lft = out.filter(([px]) => px <= 0), rgt = out.filter(([px]) => px >= 0);
  gouache(c, [[0, 0], ...lft], far(lighten(col, 0.08), d), { seed, a });
  gouache(c, [[0, 0], ...rgt], far(darken(col, 0.15), d), { seed: seed + 1, a });
  if (det > 0) {
    c.save(); trace(c, [[0, 0], ...out]); c.clip(); c.lineCap = "round";
    for (let i = 0; i < Math.round(s * 0.9 * det); i++) { const th = (r() - 0.5) * 3.2, q = r() * rad(th) * 0.95, px = Math.sin(th) * q, py = -Math.cos(th) * q, l = 3 + r() * s * 0.12, an = th - Math.PI / 2 + (r() - 0.5) * 0.6; c.globalAlpha = (0.12 + r() * 0.16) * a; c.strokeStyle = far(r() < 0.5 ? darken(col, 0.35) : lighten(col, 0.3), d); c.lineWidth = 1 + r() * s * 0.025; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); c.stroke(); }
    tips.forEach((th, v) => { const R = rad(th) * 0.9, ex = Math.sin(th) * R, ey = -Math.cos(th) * R * 0.95; stroke(c, [[0, 0], [ex * 0.5 + (r() - 0.5) * 3, ey * 0.5], [ex, ey]], s * 0.035, 0.6, far(lighten(col, 0.45), d), 0.65 * a, det);
      for (let q = 1; q <= 3; q++) { const t = q / 4.2, bx = ex * t, by = ey * t; for (const sg of [-1, 1]) { const th2 = th + sg * 0.7, l = R * 0.28 * (1 - t * 0.4); stroke(c, [[bx, by], [bx + Math.sin(th2) * l * 0.6, by - Math.cos(th2) * l * 0.6], [bx + Math.sin(th2 - sg * 0.3) * l, by - Math.cos(th2 - sg * 0.3) * l]], s * 0.014, 0.3, far(lighten(col, 0.35), d), 0.4 * a, det); } } void v; });
    c.restore();
    c.globalAlpha = 0.45 * a; c.strokeStyle = far(darken(col, 0.55), d); c.lineWidth = 1.6; trace(c, [[0, 0], ...out]); c.stroke();
  }
  c.restore(); c.globalAlpha = 1;
};
export const tendril = (c: Ctx, x: number, y: number, s: number, dir: number, seed: number, col: string, d = 0, p = 1) => {
  if (p <= 0) return; const r = rng(seed), pts: P[] = [[x, y]]; let a = dir, cx = x, cy = y, k = 0.05;
  for (let i = 0; i < 40; i++) { a += k; k *= 1.07; const st = s * 0.05 * (1 - i / 60); cx += Math.cos(a) * st; cy += Math.sin(a) * st; pts.push([cx, cy]); }
  void r; stroke(c, pts, 1.6, 0.5, far(col, d), 0.9 * (1 - 0.4 * d), p, 2);
};

// ---------------------------------------------------------------- the sheet
// Warm cream cartridge with its own slow unevenness: the glow the paint sits in.
export const sheet = (g: Gfx, glow: [number, number, number, string][]) => {
  const c = g.cur, e: Env = g.env; c.save(); c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.globalAlpha = 1; c.fillStyle = PAPER; c.fillRect(0, 0, e.W, e.H);
  glow.forEach(([x, y, rad, col]) => { const gr = c.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0)); c.fillStyle = gr; c.fillRect(0, 0, e.W, e.H); });
  c.restore();
};
