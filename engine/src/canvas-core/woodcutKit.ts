// WOODCUT KIT (ukiyo-e colour woodblock). What a cherry-wood block, a knife and a baren need
// that the core does not have:
//   carved()   a keyblock line as the KNIFE leaves it: two separate cuts either side of a ridge,
//              so the width steps and wanders instead of swelling like a brush, and every end is
//              a chisel cut (flat, oblique), never a round or tapered pen end;
//   gouged()   a solid black area whose edge is a knife edge;
//   grainTile  the plank's figure: long wavy growth rings that print as streaks in a flat;
//   washi()    kozo paper: warm, soft, long curling fibres, a faint cloud;
//   rub()      the baren's path over the back of the sheet, as a coverage mask that grows;
//   bokashi()  a graded wipe on the block: full at one edge, gone by the other, with the
//              uneven edge of a damp cloth.
// Doctrine borrowed from spec 02 (knockouts): a colour block is PRINTED where it is cut, so a
// shape that two blocks share is built once from the shared seeded geometry before either block
// uses it; highlights are uncut wood (bare paper), never a pale ink.
import { fractal, rng, sample, type Ctx, type Env, type Layer, type P } from "./core";

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const path = (c: Ctx, pts: P[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

// arc-length resample of a polyline
export const even = (s: P[], step: number): P[] => {
  const out: P[] = [s[0]]; let carry = 0;
  for (let i = 1; i < s.length; i++) { const a = s[i - 1], b = s[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let d = step - carry; while (d <= L) { const t = d / L; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d += step; } carry = L - (d - step); }
  const last = s[s.length - 1]; if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > step * 0.3) out.push(last);
  return out;
};

// ---------------------------------------------------------------- the knife's line
// `pts` are control points; the centreline is a Catmull-Rom through them. Width: `w`, stepping
// by up to +-`step` where the carver re-set the knife (every 12-30 px), wandering slowly between.
// Each side is its own cut, so the two edges wobble independently (a fraction of a pixel).
// Ends: cut flat at an oblique angle, the angle and hand of each chosen by the seed.
export const carved = (ctrl: P[], w: number, seed: number, o: { step?: number; wander?: number; tail?: number; smooth?: boolean } = {}): P[] => {
  const { step = 0.16, wander = 0.14, tail = 0.8, smooth = true } = o, r = rng(seed);
  const c = even(smooth && ctrl.length > 2 ? sample(ctrl, false, 8) : ctrl, 1.4), n = c.length;
  if (n < 2) return [];
  const L: P[] = [], R: P[] = []; let seg = 0, next = 12 + r() * 18, lvl = 1 + (r() - 0.5) * 2 * step, acc = 0;
  for (let i = 0; i < n; i++) {
    if (i) acc += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    if (acc > next) { next = acc + 12 + r() * 18; lvl = 1 + (r() - 0.5) * 2 * step; seg++; }
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const t = i / (n - 1), ends = Math.min(1, t * (n - 1) / 3, (1 - t) * (n - 1) / 3), end = tail + (1 - tail) * ends;          // a knife end barely thins: it is CUT
    const wv = (w / 2) * lvl * end * (1 + wander * (fractal(seed, acc * 0.05, 0, 1, 1, 2) - 0.5) * 2);
    const jl = (fractal(seed + 3, acc * 0.4, 0, 1, 1, 1) - 0.5) * 0.5, jr = (fractal(seed + 5, acc * 0.4, 0, 1, 1, 1) - 0.5) * 0.5;
    L.push([c[i][0] + nx * (wv + jl), c[i][1] + ny * (wv + jl)]); R.push([c[i][0] - nx * (wv + jr), c[i][1] - ny * (wv + jr)]);
  }
  // chisel ends: slide one corner along the stroke so the end is a flat oblique facet
  const chisel = (i: number, j: number, k: number) => { const d = [c[j][0] - c[i][0], c[j][1] - c[i][1]], l = Math.hypot(d[0], d[1]) || 1, s = (r() < 0.5 ? 1 : -1) * w * (0.35 + r() * 0.5); (s > 0 ? L : R)[k] = [(s > 0 ? L : R)[k][0] + (d[0] / l) * Math.abs(s), (s > 0 ? L : R)[k][1] + (d[1] / l) * Math.abs(s)]; };
  chisel(0, Math.min(2, n - 1), 0); chisel(n - 1, Math.max(0, n - 3), n - 1);
  void seg; return [...L, ...R.reverse()];
};
// a solid carved area: its outline bitten by the knife at a small scale
export const gouged = (ctrl: P[], seed: number, closed = true, amp = 0.8): P[] => {
  const s = even(closed ? sample(ctrl, true, 8) : ctrl, 1.5);
  return s.map(([x, y]) => [x + (fractal(seed, x, y, 0.35, 0.35, 1) - 0.5) * amp, y + (fractal(seed + 9, x, y, 0.35, 0.35, 1) - 0.5) * amp] as P);
};
// fill a list of polygons on the current surface
export const fillAll = (c: Ctx, polys: P[][], color: string) => { c.fillStyle = color; c.beginPath(); for (const p of polys) { if (p.length < 3) continue; p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); } c.fill("nonzero"); };

// ---------------------------------------------------------------- the wood and the paper
// the plank's figure: growth rings as long wavy streaks, tileable, alpha = where pigment is thin.
export const grainTile = (env: Env): Layer => {
  const key = `woodcut:grain:${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const n = 512, k = env.scale, dn = Math.round(n * k); L = env.canvas(dn, dn); const img = L.ctx.createImageData(dn, dn), d = img.data;
  for (let y = 0; y < dn; y++) for (let x = 0; x < dn; x++) {
    const lx = x / k, ly = y / k, warp = (fractal(501, lx, ly, 1 / 128, 1 / 64, 2, n) - 0.5) * 34, ring = Math.sin((ly + warp) * 0.5 + (fractal(502, lx, ly, 1 / 256, 1 / 16, 3, n) - 0.5) * 26);  /* growth rings: uneven spacing, some close, some wide */
    const fleck = fractal(503, lx, ly, 0.9, 0.9, 1, n), v = clamp((ring - 0.55) * 2.2) * 0.75 + clamp((fleck - 0.64) * 5) * 0.8;
    const p = (y * dn + x) * 4; d[p] = d[p + 1] = d[p + 2] = 0; d[p + 3] = 255 * clamp(v);
  }
  L.ctx.putImageData(img, 0, 0); env.cache.set(key, L); return L;
};
// knock a block's pigment thin along its grain (and where the baren skipped: goma-zuri speckle)
export const grain = (c: Ctx, env: Env, strength: number, shift: P, rot = 0) => {
  if (strength <= 0) return; const t = grainTile(env), k = env.scale;
  c.save(); c.setTransform(Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), shift[0] * k, shift[1] * k); c.globalCompositeOperation = "destination-out"; c.globalAlpha = strength;
  c.fillStyle = c.createPattern(t.canvas, "repeat")!; c.fillRect(-shift[0] * k - 200 * k, -shift[1] * k - 200 * k, (env.W + 400) * k, (env.H + 400) * k); c.restore();
};
export const WASHI = "#efe6d1";
export const washi = (env: Env): Layer => {
  const key = `woodcut:washi:${env.W}x${env.H}@${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const W = env.W, H = env.H, k = env.scale, DW = Math.round(W * k), DH = Math.round(H * k); L = env.canvas(DW, DH); const c = L.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = WASHI; c.fillRect(0, 0, DW, DH);
  const img = c.getImageData(0, 0, DW, DH), d = img.data;
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { const v = fractal(511, x / k, y / k, 0.004, 0.004, 3) - 0.5, p = (y * DW + x) * 4, o = v * 12; d[p] += o; d[p + 1] += o; d[p + 2] += o * 1.3; }
  c.putImageData(img, 0, 0); c.setTransform(k, 0, 0, k, 0, 0);
  const r = rng(513);
  for (let i = 0; i < (W * H) / 2600; i++) { // kozo: long, soft, curling bast fibres lying in the sheet
    const x = r() * W, y = r() * H, len = 14 + Math.pow(r(), 2) * 70, a = r() * 6.283, b1 = (r() - 0.5) * 2, b2 = (r() - 0.5) * 2, pale = r() < 0.7;
    c.strokeStyle = pale ? `rgba(255,252,242,${0.35 + r() * 0.35})` : `rgba(150,128,96,${0.1 + r() * 0.14})`; c.lineWidth = 0.4 + r() * 0.6;
    c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + Math.cos(a + b1) * len * 0.35, y + Math.sin(a + b1) * len * 0.35, x + Math.cos(a + b2) * len * 0.7, y + Math.sin(a + b2) * len * 0.7, x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
  }
  env.cache.set(key, L); return L;
};

// ---------------------------------------------------------------- the baren
// The printer lays the damp sheet on the inked block (against the kento) and rubs its back with
// the baren in overlapping zig-zag strokes, working down the block. Pigment transfers where the
// baren has passed. `rubPath` returns that path over a block's box; `rubMask` draws the swept
// area up to `u` (0..1) as a coverage mask, the pad's edge a little ragged.
export const rubPath = (b: { x0: number; y0: number; x1: number; y1: number }, pad: number): P[] => {
  const band = pad * 0.72, rows = Math.max(1, Math.ceil((b.y1 - b.y0) / band)), out: P[] = [];
  for (let i = 0; i < rows; i++) { const y = b.y0 + band * (i + 0.5), l = b.x0 - pad * 0.2, rr = b.x1 + pad * 0.2; out.push(i % 2 ? [rr, y] : [l, y], i % 2 ? [l, y + band * 0.15] : [rr, y + band * 0.15]); }
  return out;
};
export const rubMask = (c: Ctx, pts: P[], u: number, pad: number, seed: number) => {
  if (u <= 0) return; const s = even(pts, 3), n = Math.max(1, Math.round((s.length - 1) * clamp(u)));
  c.fillStyle = "#000"; c.beginPath();
  for (let i = 0; i <= n && i < s.length; i++) { const [x, y] = s[i], rr = (pad / 2) * (0.9 + 0.2 * fractal(seed, x, y, 0.05, 0.05, 1)); c.moveTo(x + rr, y); c.arc(x, y, rr, 0, Math.PI * 2); }
  c.fill();
};

// ---------------------------------------------------------------- bokashi
// Ichimonji bokashi: the printer wipes the inked block with a damp cloth so the pigment runs
// from full at one edge to nothing a hand's width away. The fade is not a clean gradient: the
// cloth leaves its edge wavering across the block.
export const bokashi = (c: Ctx, x0: number, x1: number, yFull: number, yGone: number, color: string, seed: number, clip?: P[]) => {
  c.save(); if (clip) { path(c, clip); c.clip(); }
  const dir = Math.sign(yGone - yFull) || 1, span = Math.abs(yGone - yFull), steps = Math.ceil((x1 - x0) / 6);
  for (let i = 0; i < steps; i++) {
    const x = x0 + i * 6, wob = (fractal(seed, x, 0, 0.012, 0.012, 3) - 0.5) * span * 0.35, g = c.createLinearGradient(0, yFull, 0, yGone + wob * dir);
    g.addColorStop(0, color); g.addColorStop(0.45, color + "b0"); g.addColorStop(1, color + "00"); c.fillStyle = g;
    c.fillRect(x, Math.min(yFull, yGone + wob * dir) - (dir > 0 ? 400 : 0), 6.6, span + Math.abs(wob) + 400);
  }
  c.restore();
};
