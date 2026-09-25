// PLATE GEOMETRY. The authored control points of MECHANICAL LEPIDOPTERA, and the pose that
// moves them. Nothing here draws. A pose transforms CONTROL POINTS only (spec 6.4), so line
// weight never changes when a wing foreshortens.
import { P, jitter } from "../core";

export const WHITE = "#f1f7fb", CYAN = "#a7d8ec", DIM = "#7fbcd8", GROUND = "#123a63";
export const CX = 540, CY = 418, K = 0.9;
export const FW: P[] = [[26, -52], [120, -132], [232, -216], [332, -272], [402, -286], [430, -250], [434, -190], [412, -120], [374, -60], [300, -18], [200, 2], [100, -6], [30, -20]];
export const HW: P[] = [[24, 2], [100, 22], [220, 30], [322, 62], [362, 122], [352, 192], [304, 252], [236, 292], [204, 342], [172, 302], [122, 262], [72, 182], [36, 92]];
export const FW_H: P = [28, -38], HW_H: P = [26, 14];
export const FW_T: P[] = [[402, -286], [433, -222], [424, -150], [392, -86], [318, -26], [208, 1]], HW_T: P[] = [[322, 62], [362, 150], [330, 226], [236, 292], [204, 342], [122, 262], [60, 150]];
export const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const cen = (pts: P[]): P => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

// A wing pose. flap 1 = spread flat on the sheet (the approved plate), 0.35 = raised and
// foreshortened; sweep = the in-plane rotation the plate dimensions as "57o SWEEP", radians.
export type Pose = { flap: number; sweep: number };
export const REST: Pose = { flap: 1, sweep: 0 };
export const posed = (pose: Pose): boolean => pose.flap !== 1 || pose.sweep !== 0;
const SPAN = 420 * K, RISE = 44; // a raised wing also rides UP the sheet a little: the tip is nearer the eye

export type Wing = { h: P; ends: P[]; out: P[]; panels: P[][]; spar: (i: number, t: number) => P; sparLine: (i: number, a?: number, b?: number, n?: number) => P[] };
export const wingGeom = (side: number, outline: P[], hinge: P, tips: P[], seed: number, pose: Pose = REST): Wing => {
  const place = (pts: P[]): P[] => jitter(pts, 1.6, seed).map(([x, y]) => [CX + side * x * K, CY + y * K] as P); /* each side is placed by hand, so the two never quite match */
  const h = place([hinge])[0];
  const move = (pts: P[]): P[] => {
    if (!posed(pose)) return pts;
    const c = Math.cos(side * pose.sweep), s = Math.sin(side * pose.sweep);
    return pts.map(([x0, y0]) => {
      const rx = pose.sweep ? h[0] + (x0 - h[0]) * c - (y0 - h[1]) * s : x0, ry = pose.sweep ? h[1] + (x0 - h[0]) * s + (y0 - h[1]) * c : y0;
      return [h[0] + (rx - h[0]) * pose.flap, ry - (1 - pose.flap) * RISE * Math.min(1, Math.abs(rx - h[0]) / SPAN)] as P; /* foreshorten about the hinge, lift with the tip */
    });
  };
  const out = move(place(outline)), ends = move(place(tips));
  const spar = (i: number, t: number): P => { const e = ends[i], m = lerp(h, e, 0.5), nx = -(e[1] - h[1]), ny = e[0] - h[0], l = Math.hypot(nx, ny) || 1, bow = (i === 0 ? -22 : 5 - i * 2.4) * side * K, b: P = [m[0] + (nx / l) * bow, m[1] + (ny / l) * bow]; return lerp(lerp(h, b, t), lerp(b, e, t), t); };
  const sparLine = (i: number, a = 0, b = 1, n = 7): P[] => Array.from({ length: n }, (_, k) => spar(i, a + ((b - a) * k) / (n - 1)));
  const panels = ends.slice(0, -1).map((_, i) => { const raw = [spar(i, 0.16), spar(i, 0.55), spar(i, 0.97), lerp(lerp(ends[i], ends[i + 1], 0.5), cen(out), -0.04), spar(i + 1, 0.97), spar(i + 1, 0.55), spar(i + 1, 0.16)], c0 = cen(raw); return raw.map((p) => lerp(p, c0, 0.075)); });
  return { h, ends, out, panels, spar, sparLine };
};

// the body, drawn in sheet space: thorax, head, the broken-out window, the key's centre
export const B = (pts: P[], seed: number): P[] => jitter(pts, 1.1, seed).map(([x, y]) => [CX + x * K, CY + y * K] as P);
export const THORAX = B([[0, -92], [30, -84], [48, -52], [52, -8], [44, 36], [24, 62], [0, 70], [-24, 62], [-45, 34], [-52, -10], [-47, -54], [-28, -85]], 31);
export const HEAD = B([[0, -130], [16, -124], [23, -109], [15, -95], [0, -91], [-15, -96], [-23, -110], [-14, -125]], 32);
export const WINDOW = B([[-30, -62], [-8, -72], [10, -66], [32, -50], [40, -8], [30, 30], [8, 36], [-6, 44], [-32, 26], [-40, -18]], 33);
export const KC: P = [CX, CY + 322 * K]; // the key at rest, withdrawn on the centre line
export const SPINDLE: P = [CX, CY + 262 * K]; // the squared end of the winding spindle it slides onto
