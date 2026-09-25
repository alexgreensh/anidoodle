// RUBBER HOSE KIT. The cel-and-film machinery for the 1930s plate: a scene is a z-ordered list of
// PARTS; each part has painted fills (the back of the cel), a union outline, and ink details. The
// inker's line is uniform (a brush-held pen at one pressure) with a slight wobble, and it stops
// where a nearer shape sits: every part knocks its own interior out of the ink beneath it.
// Also: the film look (toning, per-frame grain, flicker, dust, gate weave, the rounded gate).
import { fractal, rng, type Ctx, type Env, type Layer, type P } from "./core";
import { clamp } from "./gallery";
import { cut } from "./koiDrawKit";

export type Fill = { pts: P[]; col: string; alpha?: number; touch?: P; rank: number };
export type Line = { pts: P[]; w: number; closed?: boolean; rank: number; col?: string };
export type Part = { fills: Fill[]; outline: P[][]; ow: number; orank: number; details: Line[]; knock?: boolean };

// ---------------------------------------------------------------- geometry
export const cb = (a: P, c1: P, c2: P, b: P, n = 16): P[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]] as P; });
export const qb = (a: P, c: P, b: P, n = 16): P[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as P; });
export const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 28): P[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as P; });
export const capsule = (a: P, b: P, r: number, n = 10): P[] => {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), out: P[] = [];
  for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + (i / n) * Math.PI; out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]); }
  for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + (i / n) * Math.PI; out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]); }
  return out;
};
export const rect = (x0: number, y0: number, x1: number, y1: number): P[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// a noodle: a quadratic arc from a to b, bowed `bend` px off the chord (rubber hose has no elbow)
export const noodle = (a: P, b: P, bend: number, n = 18): P[] => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return qb(a, [(a[0] + b[0]) / 2 - (dy / l) * bend, (a[1] + b[1]) / 2 + (dx / l) * bend], b, n); };
// place local points: mirror, squash (sx, sy), rotate, translate
export const place = (pts: P[], o: P, ang = 0, sx = 1, sy = 1, mirror = false): P[] => { const c = Math.cos(ang), s = Math.sin(ang); return pts.map(([x0, y0]) => { const x = (mirror ? -x0 : x0) * sx, y = y0 * sy; return [o[0] + x * c - y * s, o[1] + x * s + y * c] as P; }); };
// the inker's slight wobble: a slow displacement field, reseeded per drawing when animated
export const wob = (pts: P[], amp: number, seed: number): P[] => { const ox = (seed * 97.31) % 5000, oy = (seed * 57.17) % 5000; return pts.map(([x, y]) => [x + (fractal(1930, x + ox, y + oy, 0.035, 0.035, 2) - 0.5) * amp, y + (fractal(1931, x + oy, y + ox, 0.035, 0.035, 2) - 0.5) * amp]); }; // two noise tables only: a new drawing samples elsewhere in them
const len = (s: P[]) => s.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : a), 0);
const polyArea = (s: P[]) => Math.abs(s.reduce((a, p, i) => { const q = s[(i + 1) % s.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

// ---------------------------------------------------------------- the schedule of marks
// Each stage is one sequence: marks of lower rank first, then z order; a mark's time is its
// length (lines: long ones go fast per px, a fixed lift for each) or its size (fills).
export type Schedule = Map<string, [number, number]>;
export const schedule = (parts: Part[]): { ink: Schedule; fill: Schedule } => {
  const inkItems: [string, number, number, number][] = [], fillItems: [string, number, number, number][] = [];
  parts.forEach((pt, z) => {
    pt.outline.forEach((o, i) => inkItems.push([`${z}:o${i}`, pt.orank, z * 100 + i, 5 + len(o) / 55]));
    pt.details.forEach((d, i) => inkItems.push([`${z}:d${i}`, d.rank, z * 100 + 50 + i, 4 + len(d.pts) / 55]));
    pt.fills.forEach((f, i) => fillItems.push([`${z}:f${i}`, f.rank, z * 100 + i, 0.8 + Math.sqrt(polyArea(f.pts)) / 30]));
  });
  const lay = (items: [string, number, number, number][]): Schedule => {
    items.sort((a, b) => a[1] - b[1] || a[2] - b[2]); const tot = items.reduce((a, b) => a + b[3], 0), m: Schedule = new Map(); let t = 0;
    items.forEach(([k, , , w]) => { m.set(k, [t / tot, (t + w) / tot]); t += w; }); return m;
  };
  return { ink: lay(inkItems), fill: lay(fillItems) };
};
const at = (m: Schedule, k: string, p: number) => { if (p >= 1) return 1; const w = m.get(k)!; return clamp((p - w[0]) / (w[1] - w[0])); };

// ---------------------------------------------------------------- painting the cel
const trace = (c: Ctx, pts: P[], close = true) => { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (close) c.closePath(); };
export const INK = "#16130f";
// fills: paint flooded from where the brush touched, stopped by the inked line
export const paintFills = (c: Ctx, parts: Part[], sch: Schedule, p: number) => {
  parts.forEach((pt, z) => pt.fills.forEach((f, i) => {
    const q = at(sch, `${z}:f${i}`, p); if (q <= 0) return;
    c.save(); c.globalAlpha = f.alpha ?? 1; c.fillStyle = f.col;
    if (q < 1) {
      const t = f.touch ?? f.pts.reduce((a, b) => [a[0] + b[0] / f.pts.length, a[1] + b[1] / f.pts.length] as P, [0, 0] as P);
      const R = Math.max(...f.pts.map(([x, y]) => Math.hypot(x - t[0], y - t[1]))) * (1 - (1 - q) ** 2) + 2;
      c.beginPath(); for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2, rr = R * (1 + 0.06 * Math.sin(a * 5 + z)); k ? c.lineTo(t[0] + Math.cos(a) * rr, t[1] + Math.sin(a) * rr) : c.moveTo(t[0] + Math.cos(a) * rr, t[1] + Math.sin(a) * rr); } c.clip();
    }
    c.beginPath(); trace(c, f.pts); c.fill(); c.restore();
  }));
};
// ink: nearer parts knock out what they cover; a union outline is stroked double and its own
// interior removed, so overlapping pieces (glove fingers, a cuff) read as ONE silhouette
export const inkCel = (c: Ctx, parts: Part[], sch: Schedule, p: number) => {
  c.lineCap = "round"; c.lineJoin = "round";
  parts.forEach((pt, z) => {
    const knock = () => { if (pt.knock === false) return; c.save(); c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000"; c.beginPath(); (pt.outline.length ? pt.outline : pt.fills.filter((f) => (f.alpha ?? 1) >= 1).map((f) => f.pts)).forEach((o) => trace(c, o)); c.fill("nonzero"); c.restore(); };
    knock();
    if (pt.outline.length) {
      c.strokeStyle = INK;
      pt.outline.forEach((o, i) => { const q = at(sch, `${z}:o${i}`, p); if (q <= 0) return; c.lineWidth = pt.ow * 2; c.beginPath(); trace(c, q >= 1 ? o : cut([...o, o[0]], q), q >= 1); c.stroke(); });
      knock();
    }
    pt.details.forEach((d, i) => { const q = at(sch, `${z}:d${i}`, p); if (q <= 0) return; c.strokeStyle = d.col ?? INK; c.lineWidth = d.w; c.beginPath(); trace(c, q >= 1 ? d.pts : cut(d.closed ? [...d.pts, d.pts[0]] : d.pts, q), !!d.closed && q >= 1); c.stroke(); });
  });
};

// ---------------------------------------------------------------- film
// a grain tile: independent speckle per device pixel, mid-grey centred, built once per scale
export const grainTile = (env: Env): Layer => {
  const key = `rubberHose:grain:${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const n = Math.round(256 * env.scale); L = env.canvas(n, n); const img = L.ctx.createImageData(n, n), d = img.data, r = rng(1931);
  for (let i = 0; i < n * n; i++) { const v = (r() + r() + r()) / 3, g = Math.round(clamp(0.5 + (v - 0.5) * 2.2) * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255; }
  L.ctx.putImageData(img, 0, 0); env.cache.set(key, L); return L;
};
// the print: toned, grained, flickering, dusty, vignetted by the lamp, cut to the rounded gate.
// `seed` picks this frame's grain, dust and flicker; the still uses seed 0.
export const filmPrint = (c: Ctx, env: Env, seed: number) => {
  const { W, H } = env, r = rng(7000 + seed * 13);
  c.save();
  c.globalCompositeOperation = "multiply"; c.fillStyle = "#ecdfc6"; c.fillRect(0, 0, W, H);                 // a warm silver print
  const g = grainTile(env), pat = c.createPattern(g.canvas as CanvasImageSource, "repeat")!;
  c.globalCompositeOperation = "overlay"; c.globalAlpha = 0.34; c.setTransform(1, 0, 0, 1, Math.floor(r() * 256 * env.scale), Math.floor(r() * 256 * env.scale)); c.fillStyle = pat; c.fillRect(-256 * env.scale, -256 * env.scale, (W + 512) * env.scale, (H + 512) * env.scale);
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over"; c.fillStyle = `rgba(20,14,8,${(0.02 + r() * 0.05).toFixed(3)})`; c.fillRect(0, 0, W, H); // the lamp flickers
  // dust on the print: black flecks (dirt on the positive) and white ones (dirt on the negative)
  const nd = 5 + Math.floor(r() * 5);
  for (let i = 0; i < nd; i++) { const x = r() * W, y = r() * H, s = 1 + r() * 2.6, dark = r() < 0.6; c.fillStyle = dark ? "rgba(18,12,8,0.7)" : "rgba(255,250,236,0.75)"; c.beginPath(); ell(x, y, s, s * (0.5 + r()), r() * 3, 8).forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py))); c.fill(); }
  if (r() < 0.55) { const x = r() * W, y = r() * H, a = r() * 6; c.strokeStyle = "rgba(20,14,8,0.55)"; c.lineWidth = 1; c.beginPath(); trace(c, qb([x, y], [x + Math.cos(a) * 30, y + Math.sin(a) * 30 + 12], [x + Math.cos(a + 1) * 44, y + Math.sin(a + 1) * 40]), false); c.stroke(); } // a hair
  const sx = W * (0.62 + r() * 0.3); c.strokeStyle = "rgba(255,250,236,0.35)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx + (r() - 0.5) * 6, H); c.stroke(); // the scratch the sprocket made
  const vg = c.createRadialGradient(W * 0.48, H * 0.44, W * 0.2, W / 2, H / 2, W * 0.78); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(22,14,6,0.55)"); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  c.fillStyle = "#0b0907"; c.beginPath(); c.rect(0, 0, W, H); const m = 16, R = 46; c.moveTo(m + R, m); c.arcTo(m, m, m, m + R, R); c.arcTo(m, H - m, m + R, H - m, R); c.arcTo(W - m, H - m, W - m, H - m - R, R); c.arcTo(W - m, m, W - m - R, m, R); c.closePath(); c.fill("evenodd"); // the projector's gate
  c.restore();
};
