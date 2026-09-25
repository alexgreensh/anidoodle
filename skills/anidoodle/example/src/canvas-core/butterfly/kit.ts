// THE DRAFTSMAN'S KIT. Every mark on the plate is made with one of these: a ruling pen that is
// never quite straight, a swung ring, section lines that start and stop inside the part, stipple,
// a gear, a leader with its arrow, a balloon. Bound to one Gfx target, so the same kit draws on
// the main canvas or into a cached layer without knowing the difference.
import { Ctx, Gfx, Medium, P, arc, jitter, line, oval, poly, rng } from "../core";
import { letter, width } from "../drafting";
import { bounds, inside } from "../riso";
import { CYAN, DIM, WHITE, lerp } from "./geom";

export const DRAFT: Medium = { nib: 1, taper: 0.6, pressure: 0.75, retrace: false, wobble: 0.5, rough: 0.55 }; // a ruling pen in a human hand
export type PenO = { color?: string; seed?: number; opacity?: number; closed?: boolean; taper?: number; wobble?: number; progress?: number };
export type Kit = ReturnType<typeof kit>;

// boil: 0 for everything the draftsman has already inked (spec 4: furniture is dead still).
// tint: the shadow pass paints the same linework in one flat colour (spec S11).
export const kit = (g: Gfx, o: { boil?: number; tint?: string | null } = {}) => {
  const boil = o.boil ?? 0, tint = o.tint ?? null, col = (c?: string) => tint ?? c ?? WHITE;
  const ink = (fn: () => void) => g.inkGroup(fn, { blur: 1.8, alpha: 0.28, textures: ["draftTooth"] }); // a faint halo under the line: white ink on blue always blooms a little
  const pen = (pts: P[], w: number, p: PenO = {}) => g.pen(pts, { w, color: col(p.color), seed: p.seed ?? 1, opacity: p.opacity ?? 0.95, closed: p.closed, taper: p.taper ?? 0.6, wobble: p.wobble ?? 0.5, boil, progress: p.progress });
  const ln = (a: P, b: P, w: number, p: PenO = {}) => pen(line(a, b, ((p.seed ?? 1) % 3) - 1), w, p); // nobody rules a dead straight line freehand
  const dash = (a: P, b: P, on: number, off: number, w: number, p: PenO = {}) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0, i = 0; d < L; d += on + off, i++) ln(lerp(a, b, d / L), lerp(a, b, Math.min(1, (d + on) / L)), w, { ...p, seed: (p.seed ?? 1) + i, taper: 0.3 }); };
  const chain = (a: P, b: P, w: number, p: PenO = {}) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0, i = 0; d < L; d += 40, i++) { ln(lerp(a, b, d / L), lerp(a, b, Math.min(1, (d + 24) / L)), w, { ...p, seed: (p.seed ?? 1) + i * 2, taper: 0.3 }); if (d + 35 < L) ln(lerp(a, b, (d + 30) / L), lerp(a, b, (d + 35) / L), w, { ...p, seed: (p.seed ?? 1) + i * 2 + 1, taper: 0.2 }); } };
  const arrow = (tip: P, ang: number, size = 13, color = WHITE) => g.fill([tip, [tip[0] - Math.cos(ang - 0.17) * size, tip[1] - Math.sin(ang - 0.17) * size], [tip[0] - Math.cos(ang) * size * 0.82, tip[1] - Math.sin(ang) * size * 0.82], [tip[0] - Math.cos(ang + 0.17) * size, tip[1] - Math.sin(ang + 0.17) * size]], col(color), 0.95);
  const fill = (pts: P[], color: string, alpha = 1) => g.fill(pts, tint ?? color, alpha);
  const ring = (cx: number, cy: number, r: number, w: number, seed: number, p: PenO = {}) => pen(jitter(oval(cx, cy, r, r * (0.96 + (seed % 5) * 0.015), 12, -1.9 + seed), r * 0.035, seed), w, { ...p, seed, closed: true, taper: 0.4 }); // hand-swung, never a true circle
  // section lines / cross-hatch: parallel strokes that start and stop inside the part
  const hatch = (pts: P[], ang: number, gap: number, w: number, seed: number, p: { color?: string; opacity?: number; progress?: number } = {}) => {
    const c = Math.cos(ang), s = Math.sin(ang), r = rng(seed), proj = pts.map(([x, y]) => -s * x + c * y), lo = Math.min(...proj), hi = Math.max(...proj), segs: [P, P, number][] = [];
    for (let off = lo + gap * 0.5, n = 0; off < hi; off += gap * (0.86 + r() * 0.28), n++) {
      const ox = -s * off, oy = c * off, ts: number[] = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[j], b = pts[i], ex = b[0] - a[0], ey = b[1] - a[1], den = c * ey - s * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - ox) * ey - (a[1] - oy) * ex) / den, u = ((a[0] - ox) * s - (a[1] - oy) * c) / den; if (u >= 0 && u < 1) ts.push(t); }
      ts.sort((a, b) => a - b);
      for (let k = 0; k + 1 < ts.length; k += 2) { const t0 = ts[k] + r() * 2.5, t1 = ts[k + 1] - r() * 2.5; if (t1 - t0 < 3) continue; segs.push([[ox + c * t0, oy + s * t0], [ox + c * t1, oy + s * t1], seed + n * 7 + k]); }
    }
    const vis = (p.progress ?? 1) * segs.length; /* section lines run on one stroke at a time, the last one half made */
    segs.forEach(([a, b, sd], i) => { const q = Math.min(1, vis - i); if (q > 0) ln(a, b, w, { seed: sd, color: p.color ?? CYAN, opacity: p.opacity ?? 0.8, taper: 0.7, progress: q }); });
  };
  const stipple = (pts: P[], n: number, seed: number, dens: (x: number, y: number) => number, color = WHITE) => { const b = bounds(pts), r = rng(seed), c = g.cur; g.touch(b.x0, b.y0, b.x1, b.y1); c.fillStyle = col(color); for (let i = 0; i < n; i++) { const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0); if (!inside(pts, x, y) || r() > dens(x, y)) continue; c.globalAlpha = 0.6 + r() * 0.35; c.beginPath(); c.ellipse(x, y, 0.7 + r() * 0.7, 0.6 + r() * 0.5, r() * 3, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; };
  const gearPts = (cx: number, cy: number, rp: number, teeth: number, ph: number, seed: number, spike = false): P[] => { const r = rng(seed), out: P[] = [], add = rp * (spike ? 0.24 : 0.13), ded = rp * 0.13; for (let i = 0; i < teeth; i++) { const a = ph + (i / teeth) * Math.PI * 2, st = (Math.PI * 2) / teeth, q = (da: number, rr: number): P => [cx + Math.cos(a + da * st) * (rr + (r() - 0.5) * 0.7), cy + Math.sin(a + da * st) * (rr + (r() - 0.5) * 0.7)]; if (spike) out.push(q(0, rp - ded), q(0.62, rp - ded), q(0.92, rp + add)); else out.push(q(0, rp - ded), q(0.16, rp - ded), q(0.3, rp + add), q(0.56, rp + add), q(0.7, rp - ded)); } return out; };
  const gear = (cx: number, cy: number, rp: number, teeth: number, ph: number, seed: number, p: { spokes?: number; spike?: boolean; w?: number; progress?: number } = {}) => {
    const q = p.progress ?? 1; if (q <= 0) return;
    const n = 4 + (p.spokes ?? 5), st = (i: number) => (q >= 1 ? 1 : Math.max(0, Math.min(1, q * n - i))); /* rim, then the hub rings, then the spokes: a wheel is drawn from the outside in */
    pen(poly(gearPts(cx, cy, rp, teeth, ph, seed, p.spike), 2), p.w ?? 1.9, { seed, closed: true, taper: 0.3, wobble: 0.15, progress: st(0) });
    ring(cx, cy, rp * 0.74, 1.2, seed + 1, { color: CYAN, progress: st(1) }); ring(cx, cy, rp * 0.26, 1.6, seed + 2, { progress: st(2) }); ring(cx, cy, rp * 0.1, 1.3, seed + 3, { progress: st(3) });
    for (let i = 0; i < (p.spokes ?? 5); i++) { const a = ph + 0.3 + (i / (p.spokes ?? 5)) * Math.PI * 2, nn = a + Math.PI / 2, wv = rp * 0.06, sq = st(4 + i); [-1, 1].forEach((sd) => ln([cx + Math.cos(a) * rp * 0.27 + Math.cos(nn) * wv * sd, cy + Math.sin(a) * rp * 0.27 + Math.sin(nn) * wv * sd], [cx + Math.cos(a) * rp * 0.73 + Math.cos(nn) * wv * 0.7 * sd, cy + Math.sin(a) * rp * 0.73 + Math.sin(nn) * wv * 0.7 * sd], 1.2, { seed: seed + 10 + i * 2 + sd, progress: sq })); }
    if (q >= 1) { ln([cx - rp * 0.2, cy], [cx + rp * 0.2, cy], 0.9, { color: DIM, seed: seed + 30 }); ln([cx, cy - rp * 0.2], [cx, cy + rp * 0.2], 0.9, { color: DIM, seed: seed + 31 }); } /* centre marks go on when the wheel is finished */
  };
  const spiral = (cx: number, cy: number, r0: number, r1: number, turns: number, ph = 0): P[] => Array.from({ length: Math.ceil(turns * 14) + 1 }, (_, i) => { const t = i / (turns * 14), a = ph + t * turns * Math.PI * 2, rr = r0 + (r1 - r0) * t; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.97] as P; });
  const text = (s: string, x: number, y: number, p: { cap?: number; color?: string; seed?: number; align?: "left" | "center" | "right"; w?: number; opacity?: number; progress?: number } = {}) => letter(g, s, x, y, { ...p, color: col(p.color ?? "#eef6fb") });
  const balloon = (n: string, at: P, to: P, seed: number, q = 1) => { if (q <= 0) return; const a = Math.atan2(to[1] - at[1], to[0] - at[0]), s3 = (i: number) => Math.min(1, Math.max(0, q * 3 - i)); ring(at[0], at[1], 13.5, 1.6, seed, { progress: s3(0) }); text(n, at[0] - 0.5, at[1] - 6.5, { cap: 13, align: "center", seed, w: 1.7, progress: s3(1) }); ln([at[0] + Math.cos(a) * 14, at[1] + Math.sin(a) * 14], to, 1.1, { seed: seed + 1, color: CYAN, progress: s3(2) }); if (q >= 1) fill(oval(to[0], to[1], 2.6, 2.6, 7), WHITE, 0.95); };
  const callout = (t: string, at: P, to: P, seed: number, align: "left" | "right" = "left", q = 1) => { if (q <= 0) return; const wd = width(t, 10.5), x0 = align === "left" ? at[0] : at[0] - wd, s3 = (i: number) => Math.min(1, Math.max(0, q * 3 - i)); /* the word first, then the rule under it, then the leader out to the part */ text(t, x0, at[1] - 11, { cap: 10.5, seed, color: WHITE, progress: s3(0) }); ln([x0 - 2, at[1] + 4], [x0 + wd + 2, at[1] + 4], 1, { seed: seed + 1, color: CYAN, progress: s3(1) }); ln(align === "left" ? [x0 - 2, at[1] + 4] : [x0 + wd + 2, at[1] + 4], to, 1, { seed: seed + 2, color: CYAN, progress: s3(2) }); if (q >= 1) arrow(to, Math.atan2(to[1] - at[1] - 4, to[0] - (align === "left" ? x0 - 2 : x0 + wd + 2)), 10, CYAN); };
  const raw = (): Ctx => g.cur;
  return { g, ink, pen, ln, dash, chain, arrow, fill, ring, hatch, stipple, gear, spiral, text, balloon, callout, raw, arc, poly, oval, jitter, rng, tint };
};
