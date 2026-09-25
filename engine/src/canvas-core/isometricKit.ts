// ISOMETRIC KIT. True 2:1 isometric (dimetric) projection and the pen-tool marks of a flat
// vector iso illustration: planes with three face tones per material, crisp edges, no blur.
//
// World: x runs to screen lower-right, y to screen lower-left, z up. One unit of x or y moves
// (u, u/2) on screen: every horizontal edge is a 2:1 line. One unit of z moves 1.2247u up (the
// true vertical of a 30-degree-elevation dimetric view), so a cube reads as a cube.
// Visible faces of an axis box are its top (+z), its left face (+y) and its right face (+x).
import type { Ctx } from "./core";

export type P3 = [number, number, number];
export type P2 = [number, number];
export type Mat = { top: string; left: string; right: string };
export const ZK = 1.2247;

export class Iso {
  constructor(public ctx: Ctx, public u: number, public ox: number, public oy: number) {}
  p(x: number, y: number, z: number): P2 { return [this.ox + (x - y) * this.u, this.oy + ((x + y) * this.u) / 2 - z * ZK * this.u]; }
  // ---- raw marks
  poly(pts: P2[], fill: string, alpha = 1) { const c = this.ctx; c.globalAlpha = alpha; c.fillStyle = fill; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.globalAlpha = 1; }
  line(a: P2, b: P2, color: string, w: number, alpha = 1) { const c = this.ctx; c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = w; c.lineCap = "butt"; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.globalAlpha = 1; }
  // a plane given as world points, filled flat
  face(pts: P3[], fill: string, alpha = 1) { this.poly(pts.map((q) => this.p(...q)), fill, alpha); }
  // the three visible faces of a box
  boxFaces(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: Mat): { pts: P2[]; fill: string }[] {
    const P = (x: number, y: number, z: number) => this.p(x, y, z);
    return [
      { pts: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], fill: m.left },   // +y face
      { pts: [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], fill: m.right },  // +x face
      { pts: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], fill: m.top },    // top
    ];
  }
  // A plane being MADE: the pen traces its outline (kept inside the plane), then the fill
  // sweeps down from the traced top edge. p in [0,1]; at 1 only the clean fill remains.
  make(faces: { pts: P2[]; fill: string }[], p: number, edge: string) {
    if (p <= 0) return; const c = this.ctx;
    if (p >= 1) { faces.forEach((f) => this.poly(f.pts, f.fill)); return; }
    const pe = Math.min(1, p / 0.45), pf = Math.max(0, (p - 0.45) / 0.55);
    faces.forEach((f) => {
      const ys = f.pts.map((q) => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
      if (pf > 0) { c.save(); c.beginPath(); c.rect(-1e4, y0 - 1, 2e4, (y1 - y0 + 2) * pf); c.clip(); this.poly(f.pts, f.fill); c.restore(); }
      // traced outline: length-proportional progress round the perimeter, clipped to the plane
      c.save(); c.beginPath(); f.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
      const segs = f.pts.map((a, i) => [a, f.pts[(i + 1) % f.pts.length]] as [P2, P2]), L = segs.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
      let left = L * pe; c.strokeStyle = edge; c.lineWidth = 3; c.beginPath();
      for (const [a, b] of segs) { if (left <= 0) break; const l = Math.hypot(b[0] - a[0], b[1] - a[1]), t = Math.min(1, left / l); c.moveTo(a[0], a[1]); c.lineTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); left -= l; }
      c.stroke(); c.restore();
    });
  }
}

export const clamp01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
export const ease = (t: number) => { t = clamp01(t); return t >= 1 ? 1 : 1 - (1 - t) ** 2; };
// progress of an item scheduled [a, b) in frames
export const span = (f: number, a: number, b: number) => (f >= b ? 1 : f <= a ? 0 : (f - a) / (b - a));
